import { Plugin, WorkspaceLeaf, FileView, TFile, Modal, App, Setting, Notice } from 'obsidian';
import type { AppStore } from '@/state';
import { thunks } from '@/state';
import { VIEW_TYPE_VERSION_CONTROL } from '@/constants';
import { VersionControlView } from '@/ui/version-control-view';
import { ServiceRegistry } from '@/services-registry';
import { generateUniqueFilePath } from '@/utils/file';

export class PromptVersionNameModal extends Modal {
    private versionName = '';

    constructor(app: App, private onSubmit: (name: string) => void) {
        super(app);
    }

    override onOpen(): void {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.createEl('h3', { text: 'Save new version' });

        new Setting(contentEl)
            .setName('Version name')
            .setDesc('Enter an optional milestone name (press Enter to save)')
            .addText((text) => {
                text.setPlaceholder('e.g., First complete draft');
                text.onChange((val) => {
                    this.versionName = val;
                });
                text.inputEl.addEventListener('keydown', (e: KeyboardEvent) => {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        this.close();
                        this.onSubmit(this.versionName.trim());
                    }
                });
                setTimeout(() => text.inputEl.focus({ preventScroll: true }), 30);
            });

        new Setting(contentEl)
            .addButton((btn) =>
                btn
                    .setButtonText('Save version')
                    .setCta()
                    .onClick(() => {
                        this.close();
                        this.onSubmit(this.versionName.trim());
                    })
            )
            .addButton((btn) =>
                btn
                    .setButtonText('Cancel')
                    .onClick(() => {
                        this.close();
                    })
            );
    }

    override onClose(): void {
        this.contentEl.empty();
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
                    const state = store.getState().app;
                    const shouldPrompt = state.effectiveSettings?.enableVersionNaming ?? true;
                    if (shouldPrompt) {
                        new PromptVersionNameModal(plugin.app, (name) => {
                            store.dispatch(thunks.saveNewVersion(name ? { name } : {}));
                        }).open();
                    } else {
                        store.dispatch(thunks.saveNewVersion({}));
                    }
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
