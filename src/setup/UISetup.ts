import { Plugin, WorkspaceLeaf, FileView, TFile, Modal, App, Setting, Notice } from 'obsidian';
import type { AppStore } from '@/state';
import { thunks } from '@/state';
import { VIEW_TYPE_VERSION_CONTROL } from '@/constants';
import { VersionControlView } from '@/ui/version-control-view';
import { ServiceRegistry } from '@/services-registry';
import { generateUniqueFilePath } from '@/utils/file';
import { AiGenerationService } from '@/services/ai-generation-service';

export interface VersionPromptResult {
    name: string;
    description: string;
}

export class PromptVersionNameModal extends Modal {
    private versionName = '';
    private versionDesc = '';
    private isNameDirty = false;
    private isDescDirty = false;
    private isModalClosed = false;
    private isGenerating = false;
    private nameInputEl: HTMLInputElement | null = null;
    private descInputEl: HTMLTextAreaElement | null = null;
    private aiBtnEl: HTMLButtonElement | null = null;
    private statusEl: HTMLElement | null = null;

    constructor(
        app: App,
        private plugin: Plugin,
        private store: AppStore,
        private onSubmit: (result: VersionPromptResult) => void
    ) {
        super(app);
    }

    override onOpen(): void {
        const { contentEl } = this;
        contentEl.empty();
        this.isModalClosed = false;
        contentEl.createEl('h3', { text: 'Save new version' });

        const state = this.store.getState().app;
        const aiEnabled = Boolean(state.settings?.enableAiGeneration);
        const autoAi = Boolean(state.settings?.autoGenerateAiOnSave ?? true);
        const aiProvider = state.settings?.aiProvider || 'gemini';
        const aiModel = state.settings?.aiModel || 'gemini-3.5-flash-lite';
        const aiCustomEndpoint = state.settings?.aiCustomEndpoint || '';

        new Setting(contentEl)
            .setName('Version name')
            .setDesc('Milestone title (press Enter to save; typing locks field from AI overwrite)')
            .addText((text) => {
                this.nameInputEl = text.inputEl;
                text.setPlaceholder('e.g., Added nozzle pressure drop equations');
                text.inputEl.style.width = '100%';
                text.inputEl.addEventListener('input', () => {
                    this.isNameDirty = true;
                    this.versionName = text.inputEl.value;
                });
                text.inputEl.addEventListener('keydown', (e: KeyboardEvent) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        this.submitAndClose();
                    } else if (e.key.length === 1 || e.key === 'Backspace' || e.key === 'Delete') {
                        this.isNameDirty = true;
                    }
                });
                setTimeout(() => text.inputEl.focus({ preventScroll: true }), 30);
            });

        const descSetting = new Setting(contentEl)
            .setName('Description (Markdown)')
            .setDesc('Bulleted diff summary (Ctrl+Enter to save; typing locks field from AI overwrite)');

        const descArea = descSetting.controlEl.createEl('textarea', {
            attr: { rows: '5', placeholder: '- Summary of changes...' }
        });
        descArea.style.width = '100%';
        descArea.style.minWidth = '280px';
        descArea.style.fontFamily = 'var(--font-monospace)';
        descArea.style.fontSize = 'var(--font-ui-smaller)';
        descArea.addEventListener('input', () => {
            this.isDescDirty = true;
            this.versionDesc = descArea.value;
        });
        descArea.addEventListener('keydown', (e: KeyboardEvent) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                this.submitAndClose();
            } else if (e.key.length === 1 || e.key === 'Backspace' || e.key === 'Delete') {
                this.isDescDirty = true;
            }
        });
        this.descInputEl = descArea;

        this.statusEl = contentEl.createEl('div', {
            attr: { style: 'font-size: var(--font-ui-smaller); color: var(--text-muted); margin: 4px 0 8px;' }
        });

        const btnSetting = new Setting(contentEl);

        if (aiEnabled) {
            btnSetting.addButton((btn) => {
                this.aiBtnEl = btn.buttonEl;
                btn.setButtonText('Generate with AI (' + aiModel + ')')
                    .onClick(() => {
                        void this.runAiGeneration(aiProvider, aiModel, aiCustomEndpoint, true);
                    });
            });
        }

        btnSetting
            .addButton((btn) =>
                btn
                    .setButtonText('Save version')
                    .setCta()
                    .onClick(() => {
                        this.submitAndClose();
                    })
            )
            .addButton((btn) =>
                btn
                    .setButtonText('Cancel')
                    .onClick(() => {
                        this.close();
                    })
            );

        const hasKeyOrLocal = Boolean(AiGenerationService.getApiKey(this.app) || /^https?:\/\/(localhost|127\.0\.0\.1)/i.test(aiCustomEndpoint));
        if (aiEnabled && autoAi && hasKeyOrLocal) {
            void this.runAiGeneration(aiProvider, aiModel, aiCustomEndpoint, false);
        }
    }

    private async runAiGeneration(
        provider: 'gemini' | 'openai-compatible',
        modelId: string,
        customEndpointUrl: string,
        isManualClick: boolean
    ): Promise<void> {
        if (this.isGenerating || this.isModalClosed) return;
        const activeFile = this.app.workspace.getActiveFile();
        if (!activeFile) return;

        this.isGenerating = true;
        if (this.aiBtnEl) {
            this.aiBtnEl.disabled = true;
            this.aiBtnEl.textContent = 'Generating diff summary...';
        }
        if (this.statusEl) {
            this.statusEl.textContent = 'Analyzing diff with ' + modelId + '...';
        }

        try {
            const services = ServiceRegistry.getInstance(this.plugin as any);
            const currentContent = await AiGenerationService.readLiveOrDiskContent(this.app, activeFile.path);
            const noteId = await services.noteManager.getNoteId(activeFile);
            let latestContent: string | null = null;
            if (noteId) {
                const manifest = await services.manifestManager.loadNoteManifest(noteId);
                if (manifest) {
                    latestContent = await services.versionContentRepo.getLatestVersionContent(noteId, manifest);
                }
            }

            const summary = await AiGenerationService.generateSummary({
                app: this.app,
                noteTitle: activeFile.basename,
                oldContent: latestContent,
                newContent: currentContent,
                provider,
                modelId,
                customEndpointUrl
            });

            if (this.isModalClosed) return;

            let skippedFields: string[] = [];

            const canFillName = !this.isNameDirty || (isManualClick && this.versionName.trim().length === 0);
            if (canFillName && this.nameInputEl) {
                this.versionName = summary.name;
                this.nameInputEl.value = summary.name;
                if (!this.isDescDirty) {
                    this.nameInputEl.focus({ preventScroll: true });
                    this.nameInputEl.select();
                }
            } else {
                skippedFields.push('title');
            }

            const canFillDesc = !this.isDescDirty || (isManualClick && this.versionDesc.trim().length === 0);
            if (canFillDesc && this.descInputEl) {
                this.versionDesc = summary.description;
                this.descInputEl.value = summary.description;
            } else {
                skippedFields.push('description');
            }

            if (this.statusEl) {
                if (skippedFields.length > 0) {
                    this.statusEl.textContent = 'AI summary ready (preserved your manual input in ' + skippedFields.join(' & ') + ').';
                } else {
                    this.statusEl.textContent = 'AI diff summary populated. Press Enter to confirm.';
                }
            }
        } catch (err) {
            if (!this.isModalClosed) {
                console.error('VC: AI summary generation failed', err);
                const msg = err instanceof Error ? err.message : String(err);
                if (this.statusEl) this.statusEl.textContent = 'AI summary failed: ' + msg;
                new Notice('AI summary failed: ' + msg);
            }
        } finally {
            this.isGenerating = false;
            if (!this.isModalClosed && this.aiBtnEl) {
                this.aiBtnEl.disabled = false;
                this.aiBtnEl.textContent = 'Regenerate with AI';
            }
        }
    }

    private submitAndClose(): void {
        this.isModalClosed = true;
        const name = this.versionName.trim();
        const description = this.versionDesc.trim();
        this.close();
        this.onSubmit({ name, description });
    }

    override onClose(): void {
        this.isModalClosed = true;
        this.contentEl.empty();
    }
}

export function openSaveVersionModalOrSave(plugin: Plugin, store: AppStore): void {
    const state = store.getState().app;
    const shouldPrompt = Boolean(
        state.effectiveSettings?.enableVersionNaming ||
        state.effectiveSettings?.enableVersionDescription ||
        state.settings?.enableAiGeneration
    );
    if (shouldPrompt) {
        new PromptVersionNameModal(plugin.app, plugin, store, ({ name, description }) => {
            store.dispatch(thunks.saveNewVersion({
                ...(name ? { name } : {}),
                ...(description ? { description } : {})
            }));
        }).open();
    } else {
        store.dispatch(thunks.saveNewVersion({}));
    }
}
export class RestoreDeletedNoteModal extends Modal {
    constructor(app: App, private plugin: Plugin, private store: AppStore) {
        super(app);
    }

    override async onOpen(): Promise<void> {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.createEl('h3', { text: 'Restore deleted note from version history' });

        const services = ServiceRegistry.getInstance(this.plugin as any);
        const manifestManager = services.manifestManager;
        const versionContentRepo = services.versionContentRepo;

        const central = await manifestManager.loadCentralManifest(true);
        const orphanedEntries: { noteId: string; notePath: string; lastModified: string }[] = [];

        for (const [noteId, entry] of Object.entries(central.notes)) {
            if (!entry || !entry.notePath) continue;
            const exists = this.app.vault.getAbstractFileByPath(entry.notePath);
            if (!exists) {
                orphanedEntries.push({
                    noteId,
                    notePath: entry.notePath,
                    lastModified: entry.lastModified
                });
            }
        }

        if (orphanedEntries.length === 0) {
            contentEl.createEl('p', { text: 'No deleted notes with retained version histories were found.' });
            return;
        }

        contentEl.createEl('p', {
            text: 'Found ' + orphanedEntries.length + ' deleted note(s) with recoverable snapshots:'
        });

        for (const item of orphanedEntries) {
            const noteManifest = await manifestManager.loadNoteManifest(item.noteId).catch(() => null);
            const branch = noteManifest?.branches?.[noteManifest.currentBranch];
            const versionCount = branch?.versions ? Object.keys(branch.versions).length : 0;

            new Setting(contentEl)
                .setName(item.notePath)
                .setDesc('ID: ' + item.noteId.substring(0, 12) + '... | Versions: ' + versionCount + ' | Last modified: ' + new Date(item.lastModified).toLocaleString())
                .addButton((btn) =>
                    btn
                        .setButtonText('Restore latest')
                        .setCta()
                        .onClick(async () => {
                            try {
                                if (!noteManifest) {
                                    new Notice('Manifest missing for this note.');
                                    return;
                                }
                                const content = await versionContentRepo.getLatestVersionContent(item.noteId, noteManifest);
                                if (content === null) {
                                    new Notice('Could not read latest version content.');
                                    return;
                                }
                                const targetPath = item.notePath;
                                const parentParts = targetPath.split('/');
                                const fileName = parentParts.pop() || 'Restored Note.md';
                                const folderPath = parentParts.join('/');
                                if (folderPath) {
                                    await services.storageService.ensureFolderExists(folderPath);
                                }
                                const baseName = fileName.toLowerCase().endsWith('.md') ? fileName.slice(0, -3) : fileName;
                                const finalPath = await generateUniqueFilePath(this.app, baseName, folderPath, 'md');
                                const restoredFile = await this.app.vault.create(finalPath, content);
                                await manifestManager.updateNotePath(item.noteId, restoredFile.path);
                                await services.noteManager.writeNoteIdToFrontmatter(restoredFile, item.noteId);
                                new Notice('Restored ' + restoredFile.path + ' with full version history!');
                                this.close();
                                const leaf = this.app.workspace.getLeaf(false);
                                if (leaf) await leaf.openFile(restoredFile);
                                this.store.dispatch(thunks.initializeView(undefined));
                            } catch (err) {
                                console.error('VC: Failed to restore deleted note', err);
                                new Notice('Failed to restore deleted note. Check console.');
                            }
                        })
                );
        }
    }

    override onClose(): void {
        this.contentEl.empty();
    }
}

export function registerViews(plugin: Plugin, store: AppStore): void {
    plugin.registerView(
        VIEW_TYPE_VERSION_CONTROL,
        (leaf: WorkspaceLeaf) => new VersionControlView(leaf, store)
    );
}

export function addRibbonIcon(plugin: Plugin, store: AppStore): void {
    plugin.addRibbonIcon('history', 'Open version control', (_evt: MouseEvent) => {
        activateViewAndDispatch(plugin, store);
    });
}

export function registerCommands(plugin: Plugin, store: AppStore): void {
    plugin.addCommand({
        id: 'open-version-control-view',
        name: 'Open version control view',
        callback: () => activateViewAndDispatch(plugin, store),
    });

    plugin.addCommand({
        id: 'save-new-version',
        name: 'Save a new version of the current note',
        checkCallback: (checking: boolean): boolean => {
            const activeFile = plugin.app.workspace.getActiveFile();
            if (isValidNoteFile(activeFile)) {
                if (!checking) {
                    openSaveVersionModalOrSave(plugin, store);
                }
                return true;
            }
            return false;
        }
    });

    plugin.addCommand({
        id: 'save-new-edit',
        name: 'Save a new edit of the current note',
        checkCallback: (checking: boolean): boolean => {
            const activeFile = plugin.app.workspace.getActiveFile();
            if (isValidNoteFile(activeFile)) {
                if (!checking) {
                    store.dispatch(thunks.saveNewEdit());
                }
                return true;
            }
            return false;
        }
    });

    plugin.addCommand({
        id: 'restore-deleted-note-version',
        name: 'Restore version from deleted / orphaned notes',
        callback: () => {
            new RestoreDeletedNoteModal(plugin.app, plugin, store).open();
        },
    });

    plugin.addCommand({
        id: 'cleanup-orphaned-versions',
        name: 'Clean up orphaned version data',
        callback: () => store.dispatch(thunks.cleanupOrphanedVersions()),
    });
}

function isValidNoteFile(file: TFile | null): file is TFile {
    return Boolean(file && (file.extension === 'md' || file.extension === 'base'));
}

async function activateViewAndDispatch(plugin: Plugin, store: AppStore): Promise<void> {
    const contextLeaf = getContextLeaf(plugin.app.workspace);
    plugin.app.workspace.onLayoutReady(() => {
        store.dispatch(thunks.initializeView(contextLeaf || undefined));
    });
    const targetDocument = getTargetDocument(plugin.app.workspace);
    const existingLeaves = plugin.app.workspace.getLeavesOfType(VIEW_TYPE_VERSION_CONTROL);
    const leafInTargetWindow = existingLeaves.find(
        leaf => leaf.view?.containerEl?.ownerDocument === targetDocument
    );
    if (leafInTargetWindow) {
        await plugin.app.workspace.revealLeaf(leafInTargetWindow);
        return;
    }
    const newLeaf = await createTargetLeaf(plugin.app.workspace, targetDocument);
    if (newLeaf) {
        await newLeaf.setViewState({ type: VIEW_TYPE_VERSION_CONTROL, active: true });
        plugin.app.workspace.revealLeaf(newLeaf);
    } else {
        console.error('Version Control: Failed to create leaf');
        store.dispatch(thunks.showNotice('Error: Could not open version control view. Please try again.', 5000));
    }
}

function getContextLeaf(workspace: any): WorkspaceLeaf | null {
    const recentLeaf = workspace.getMostRecentLeaf();
    if (recentLeaf?.view instanceof FileView) return recentLeaf;
    const activeView = workspace.getActiveViewOfType(FileView);
    return activeView?.leaf ?? null;
}

function getTargetDocument(workspace: any): Document {
    const activeLeaf = workspace.getLeaf(false);
    return activeLeaf?.view?.containerEl?.ownerDocument ?? document;
}

async function createTargetLeaf(workspace: any, targetDocument: Document): Promise<WorkspaceLeaf | null> {
    if (targetDocument === document) {
        const rightLeaf = workspace.getRightLeaf(false);
        if (rightLeaf) return rightLeaf;
    } else {
        const splitLeaf = workspace.getLeaf('split', 'vertical');
        if (splitLeaf) return splitLeaf;
    }
    return workspace.getLeaf(true);
}
