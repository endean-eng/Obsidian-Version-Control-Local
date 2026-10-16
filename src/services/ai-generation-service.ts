import { App, MarkdownView, requestUrl } from 'obsidian';
import { diffLines, diffWordsWithSpace, createPatch } from 'diff';

const SECRET_STORAGE_ID = 'vc-ai-api-key';
const FALLBACK_STORAGE_KEY = 'vc_encrypted_ai_key_v1';
const MAX_DIFF_CHARS = 12000;

export type AiProviderType = 'gemini' | 'openai-compatible';

export interface AiVersionSummary {
    name: string;
    description: string;
}

export class AiGenerationService {
    public static getApiKey(app?: App): string {
        try {
            const secretStorage = (app as any)?.secretStorage;
            if (secretStorage && typeof secretStorage.getSecret === 'function') {
                const val = secretStorage.getSecret(SECRET_STORAGE_ID);
                if (typeof val === 'string' && val.length > 0) return val;
            }
        } catch {}

        try {
            const stored = window.localStorage.getItem(FALLBACK_STORAGE_KEY);
            if (!stored) return '';
            if (stored.startsWith('dpapi:')) {
                const base64 = stored.slice(6);
                const electron = (window as any).require?.('electron');
                const safeStorage = electron?.remote?.safeStorage || electron?.safeStorage;
                const BufferCtor = (window as any).require?.('buffer')?.Buffer;
                if (safeStorage?.isEncryptionAvailable?.() && BufferCtor) {
                    return safeStorage.decryptString(BufferCtor.from(base64, 'base64'));
                }
                return '';
            }
            if (stored.startsWith('raw:')) {
                return stored.slice(4);
            }
            return '';
        } catch {
            return '';
        }
    }

    public static setApiKey(app: App | undefined, rawKey: string): void {
        const trimmed = rawKey.trim();
        try {
            const secretStorage = (app as any)?.secretStorage;
            if (secretStorage && typeof secretStorage.setSecret === 'function') {
                secretStorage.setSecret(SECRET_STORAGE_ID, trimmed);
                window.localStorage.removeItem(FALLBACK_STORAGE_KEY);
                return;
            }
        } catch {}

        try {
            if (!trimmed) {
                window.localStorage.removeItem(FALLBACK_STORAGE_KEY);
                return;
            }
            const electron = (window as any).require?.('electron');
            const safeStorage = electron?.remote?.safeStorage || electron?.safeStorage;
            if (safeStorage?.isEncryptionAvailable?.()) {
                const encryptedBuf = safeStorage.encryptString(trimmed);
                window.localStorage.setItem(FALLBACK_STORAGE_KEY, 'dpapi:' + encryptedBuf.toString('base64'));
            } else {
                window.localStorage.setItem(FALLBACK_STORAGE_KEY, 'raw:' + trimmed);
            }
        } catch (e) {
            console.error('VC: Failed to store API key in local secret store', e);
        }
    }

    /**
     * Reads live in-memory editor content if open, falling back to disk adapter.
     */
    public static async readLiveOrDiskContent(app: App, filePath: string): Promise<string> {
        const leaves = app.workspace.getLeavesOfType('markdown');
        for (const leaf of leaves) {
            if (leaf.view instanceof MarkdownView && leaf.view.file?.path === filePath) {
                return leaf.view.editor.getValue();
            }
        }
        return await app.vault.adapter.read(filePath);
    }

    /**
     * Uses standard 'diff' createPatch with 1 line of context for plain-text HISTORY.md logs.
     */
    public static buildCompactDiff(oldText: string | null, newText: string, maxChars = MAX_DIFF_CHARS): string {
        if (oldText === null) {
            return '+ ' + newText.slice(0, maxChars).split(/\r?\n/).join('\n+ ');
        }
        const normOld = oldText.replace(/\r\n/g, '\n');
        const normNew = newText.replace(/\r\n/g, '\n');
        if (normOld === normNew) return '(No text changes)';

        const patch = createPatch('note.md', normOld, normNew, 'previous', 'current', { context: 1 });
        // Strip the 4-line unified diff file header
        const bodyLines = patch.split('\n').slice(4);
        return bodyLines.join('\n').trim().slice(0, maxChars);
    }

    /**
     * Pinpoints exact modified lines via diffLines and marks inline word deltas
     * with [-removed-] and {+added+} so the AI never sees unrelated paragraphs.
     */
    public static buildSurgicalAiDiffPayload(oldText: string, newText: string): string {
        const normOld = oldText.replace(/\r\n/g, '\n');
        const normNew = newText.replace(/\r\n/g, '\n');
        if (normOld === normNew) return 'NO_CHANGES';

        const lineChanges = diffLines(normOld, normNew);
        const hunks: string[] = [];
        let hunkNum = 1;
        let totalLength = 0;
        const TRUNCATION_NOTICE = '\n\n[... Diff truncated: Remaining change hunks omitted to fit context window ...]';

        for (let i = 0; i < lineChanges.length; i++) {
            const curr = lineChanges[i]!;
            if (!curr.added && !curr.removed) continue;

            let hunkStr = '';
            const next = i + 1 < lineChanges.length ? lineChanges[i + 1] : undefined;
            
            if (curr.removed && next?.added) {
                // Modified paragraph/line block: compute inline word-level delta
                const wordDiffs = diffWordsWithSpace(curr.value.trim(), next.value.trim());
                const inlineMarkup = wordDiffs.map(w => {
                    if (w.removed) return '[-' + w.value + '-]';
                    if (w.added) return '{+' + w.value + '+}';
                    return w.value;
                }).join('');
                hunkStr = 'Change #' + (hunkNum++) + ' (Modified Line/Paragraph):\n' + inlineMarkup;
                i++; // Skip the paired added block
            } else if (curr.removed) {
                hunkStr = 'Change #' + (hunkNum++) + ' (Deleted Line/Paragraph):\n[-' + curr.value.trim() + '-]';
            } else if (curr.added) {
                hunkStr = 'Change #' + (hunkNum++) + ' (Added Line/Paragraph):\n{+' + curr.value.trim() + '+}';
            }

            const projectedLength = totalLength + (hunks.length > 0 ? 2 : 0) + hunkStr.length;
            
            if (projectedLength > MAX_DIFF_CHARS) {
                if (hunks.length === 0) {
                    // Single-Hunk Overflow Guard
                    let sliced = hunkStr.slice(0, MAX_DIFF_CHARS);
                    // Close dangling markers if any
                    const openAdded = (sliced.match(/\{\+/g) || []).length;
                    const closeAdded = (sliced.match(/\+\}/g) || []).length;
                    if (openAdded > closeAdded) sliced += '+}';
                    
                    const openRemoved = (sliced.match(/\[\-/g) || []).length;
                    const closeRemoved = (sliced.match(/\-\]/g) || []).length;
                    if (openRemoved > closeRemoved) sliced += '-]';
                    
                    hunks.push(sliced);
                }
                hunks.push(TRUNCATION_NOTICE.trim());
                break;
            }
            
            hunks.push(hunkStr);
            totalLength += (hunks.length > 1 ? 2 : 0) + hunkStr.length;
        }

        return hunks.join('\n\n');
    }

    public static async generateSummary(params: {
        app: App;
        noteTitle: string;
        oldContent: string | null;
        newContent: string;
        provider: AiProviderType;
        modelId: string;
        customEndpointUrl?: string;
    }): Promise<AiVersionSummary> {
        const { app, noteTitle, oldContent, newContent, provider, modelId, customEndpointUrl } = params;

        const isFirstVersion = oldContent === null;
        if (!isFirstVersion && oldContent.replace(/\r\n/g, '\n') === newContent.replace(/\r\n/g, '\n')) {
            return {
                name: 'No content changes',
                description: '- Snapshot matches the previous version.'
            };
        }

        const apiKey = this.getApiKey(app);
        const isLocalhost = Boolean(customEndpointUrl && /^https?:\/\/(localhost|127\.0\.0\.1)/i.test(customEndpointUrl.trim()));

        if (!apiKey && !isLocalhost) {
            if (isFirstVersion) {
                return {
                    name: 'Initial baseline: ' + noteTitle,
                    description: '- Initial baseline snapshot created for ' + noteTitle + '.'
                };
            }
            throw new Error('Missing API key. Configure it in Version Control Global Settings.');
        }

        let systemPrompt: string;
        let userPayload: string;

        if (isFirstVersion) {
            systemPrompt = [
                'You are a technical version-control assistant for an Obsidian Markdown vault.',
                'This is the FIRST saved version (V1 Initial Baseline) of the note "' + noteTitle + '".',
                'Return ONLY a raw JSON object with two keys:',
                '1. "name": "Initial baseline: <3 to 5 word topic summary>".',
                '2. "description": A concise 2 to 3 bullet Markdown summary (using "- ") of the core sections and baseline scope of this document.'
            ].join('\n');
            userPayload = newContent.slice(0, MAX_DIFF_CHARS);
        } else {
            systemPrompt = [
                'You are a strict, literal diff-reporting assistant for an Obsidian Markdown vault.',
                'In the payload below, removed text is wrapped in [-...-] and added text is wrapped in {+...+}. Unchanged words in the same sentence are shown only for grammatical context.',
                'CRITICAL RULES:',
                '- Report ONLY the text inside [-...-] and {+...+}.',
                '- NEVER report surrounding unchanged words in the paragraph as if they were edited.',
                '- If only 1 word or phrase was removed/added, output ONLY 1 bullet point describing that single change.',
                'Return ONLY a raw JSON object with two keys:',
                '1. "name": A concise, literal title of the edit (3 to 7 words, no quotes).',
                '2. "description": Markdown bullet point(s) starting with "- " stating the exact change(s).'
            ].join('\n');
            userPayload = this.buildSurgicalAiDiffPayload(oldContent, newContent);
        }

        if (provider === 'openai-compatible') {
            const endpoint = (customEndpointUrl || 'https://api.openai.com/v1/chat/completions').trim();
            const headers: Record<string, string> = { 'Content-Type': 'application/json' };
            if (apiKey) headers['Authorization'] = 'Bearer ' + apiKey;

            const response = await requestUrl({
                url: endpoint,
                method: 'POST',
                throw: false,
                headers,
                body: JSON.stringify({
                    model: (modelId || 'gpt-4o-mini').trim(),
                    temperature: 0.1,
                    response_format: { type: 'json_object' },
                    messages: [
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: userPayload }
                    ]
                })
            });
            if (response.status < 200 || response.status >= 300) {
                throw new Error('AI endpoint error (HTTP ' + response.status + '): ' + (response.json?.error?.message || response.text || 'Unknown error'));
            }
            const content = response.json?.choices?.[0]?.message?.content || '';
            return this.parseJsonSummary(content);
        }

        const requestedModel = (modelId || 'gemini-3.5-flash-lite').trim().replace(/^models\//, '');
        const fallbackModels = [
            'gemini-3.5-flash-lite',
            'gemini-3.1-flash-lite',
            'gemini-flash-lite-latest',
            'gemini-3.8-flash',
            'gemini-flash-latest',
            'gemini-4-argon',
        ];
        const candidates = [requestedModel, ...fallbackModels.filter(m => m !== requestedModel)];
        const baseUrl = (customEndpointUrl || 'https://generativelanguage.googleapis.com/v1beta/models').trim().replace(/\/$/, '');

        let lastErrorMsg = '';
        for (const candidateModel of candidates) {
            const url = baseUrl + '/' + candidateModel + ':generateContent?key=' + encodeURIComponent(apiKey);
            const response = await requestUrl({
                url,
                method: 'POST',
                throw: false,
                headers: {
                    'Content-Type': 'application/json',
                    'x-goog-api-key': apiKey
                },
                body: JSON.stringify({
                    systemInstruction: { parts: [{ text: systemPrompt }] },
                    contents: [{ role: 'user', parts: [{ text: userPayload }] }],
                    generationConfig: {
                        temperature: 0.1,
                        maxOutputTokens: 350,
                        responseMimeType: 'application/json'
                    }
                })
            });

            if (response.status >= 200 && response.status < 300) {
                const rawText = response.json?.candidates?.[0]?.content?.parts?.[0]?.text || '';
                if (!rawText) {
                    throw new Error('Empty response from Gemini API (' + candidateModel + ').');
                }
                return this.parseJsonSummary(rawText);
            }

            const apiErrDetail = response.json?.error?.message || response.text || ('HTTP ' + response.status);
            lastErrorMsg = '[' + candidateModel + '] ' + apiErrDetail;

            if (response.status === 404) {
                console.warn('VC: Model ' + candidateModel + ' returned 404, trying next fallback...');
                continue;
            }
            throw new Error(lastErrorMsg);
        }
        throw new Error('All Gemini model endpoints returned 404. Last error: ' + lastErrorMsg);
    }

    private static parseJsonSummary(rawText: string): AiVersionSummary {
        try {
            const cleaned = rawText.trim().replace(/^```json\s*/i, '').replace(/\s*```$/, '');
            try {
                const parsed = JSON.parse(cleaned);
                return {
                    name: typeof parsed.name === 'string' ? parsed.name.trim().slice(0, 120) : 'Updated note',
                    description: typeof parsed.description === 'string' ? parsed.description.trim().slice(0, 2000) : '- Version updated.'
                };
            } catch {
                // Safe JSON Extraction: find outer {} bounds
                const firstBrace = cleaned.indexOf('{');
                const lastBrace = cleaned.lastIndexOf('}');
                if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
                    const extracted = cleaned.substring(firstBrace, lastBrace + 1);
                    const parsed = JSON.parse(extracted);
                    return {
                        name: typeof parsed.name === 'string' ? parsed.name.trim().slice(0, 120) : 'Updated note',
                        description: typeof parsed.description === 'string' ? parsed.description.trim().slice(0, 2000) : '- Version updated.'
                    };
                }
                throw new Error('No valid JSON object bounds found');
            }
        } catch (e) {
            console.warn('VC: Failed to parse JSON summary from LLM, using fallback.', e);
            return {
                name: 'Updated note',
                description: '- Version updated.'
            };
        }
    }

    public static formatMarkdownHistoryEntry(params: {
        versionId: string;
        versionNumber: number;
        branchName: string;
        timestamp: string;
        name?: string | undefined;
        description?: string | undefined;
        oldContent: string | null;
        newContent: string;
    }): string {
        const titleSuffix = params.name ? (' — ' + params.name) : '';
        const diffBlock = this.buildCompactDiff(params.oldContent, params.newContent, 25000);
        const lines: string[] = [
            '## V' + params.versionNumber + titleSuffix,
            '- **Version ID:** `' + params.versionId + '`',
            '- **Branch:** `' + params.branchName + '`',
            '- **Timestamp:** ' + params.timestamp,
            '- **Snapshot File:** `versions/' + params.versionId + '.md`',
            ''
        ];
        if (params.description && params.description.trim().length > 0) {
            lines.push('### Summary');
            lines.push(params.description.trim());
            lines.push('');
        }
        lines.push('### Diff vs Previous Version');
        lines.push('```diff');
        lines.push(diffBlock);
        lines.push('```');
        lines.push('');
        lines.push('---');
        lines.push('');
        return lines.join('\n');
    }
}
