import { useState, useContext } from 'react';
import type { App } from 'obsidian';
import { AppContext } from '@/ui/AppContext';
import { AiGenerationService, type AiProviderType } from '@/services/ai-generation-service';
import { memo, useEffect } from 'react';
import { useForm, type SubmitHandler } from 'react-hook-form';
import { valibotResolver } from '@hookform/resolvers/valibot';
import { useAppDispatch, useAppSelector } from '@/ui/hooks';
import { thunks } from '@/state';
import { SettingComponent } from '@/ui/components';
import { ValidatedInput } from './controls/ValidatedControls';
import {
    DatabasePathSchema,
    FrontmatterKeySchema,
    NoteIdFormatSchema,
    VersionIdFormatSchema
} from '@/ui/components/settings/utils';
import * as v from 'valibot';
import { AutoRegisterSettings } from './setting-controls/AutoRegisterSettings';
import type { ViewMode } from '@/types';

// --- Database Path Setting ---

const DatabasePathFormSchema = v.object({
    databasePath: DatabasePathSchema
});

type DatabasePathFormValues = v.InferOutput<typeof DatabasePathFormSchema>;

const DatabasePathSetting: React.FC = memo(() => {
    const dispatch = useAppDispatch();
    const databasePath = useAppSelector(state => state.app.settings.databasePath);

    const { control, handleSubmit, reset, formState: { isValid, isDirty } } = useForm<DatabasePathFormValues>({
        mode: 'onChange',
        resolver: valibotResolver(DatabasePathFormSchema),
        defaultValues: { databasePath }
    });

    useEffect(() => {
        reset({ databasePath });
    }, [databasePath, reset]);

    const onSubmit: SubmitHandler<DatabasePathFormValues> = (data) => {
        if (data.databasePath !== databasePath) {
            dispatch(thunks.renameDatabasePath(data.databasePath));
        }
    };

    return (
        <SettingComponent 
            name="Database path" 
            desc={`The vault-relative path for the version history database. Current: ${databasePath}`}
        >
            <form onSubmit={handleSubmit(onSubmit)} className="v-setting-form">
                <ValidatedInput 
                    name="databasePath" 
                    control={control} 
                    placeholder="e.g., .versiondb" 
                    maxLength={255}
                />
                <div className="v-settings-action-row">
                    <button 
                        type="submit"
                        aria-label="Apply database path change"
                        disabled={!isValid || !isDirty}
                    >
                        Apply
                    </button>
                </div>
            </form>
        </SettingComponent>
    );
});
DatabasePathSetting.displayName = 'DatabasePathSetting';

// --- Frontmatter Key Setting ---

const FrontmatterKeyFormSchema = v.object({
    key: FrontmatterKeySchema
});

type FrontmatterKeyFormValues = v.InferOutput<typeof FrontmatterKeyFormSchema>;

const FrontmatterKeySetting: React.FC = memo(() => {
    const dispatch = useAppDispatch();
    const frontmatterKey = useAppSelector(state => state.app.settings.noteIdFrontmatterKey);

    const { control, handleSubmit, reset, formState: { isValid, isDirty } } = useForm<FrontmatterKeyFormValues>({
        mode: 'onChange',
        resolver: valibotResolver(FrontmatterKeyFormSchema),
        defaultValues: { key: frontmatterKey }
    });

    useEffect(() => {
        reset({ key: frontmatterKey });
    }, [frontmatterKey, reset]);

    const onSubmit: SubmitHandler<FrontmatterKeyFormValues> = (data) => {
        if (data.key !== frontmatterKey) {
            dispatch(thunks.requestKeyUpdate(data.key));
        }
    };

    return (
        <SettingComponent
            name="Frontmatter key"
            desc={`The key used in note frontmatter to store the version control ID. Current: ${frontmatterKey}`}
        >
            <form onSubmit={handleSubmit(onSubmit)} className="v-setting-form">
                <ValidatedInput
                    name="key"
                    control={control}
                    placeholder="e.g., vc-id"
                    maxLength={50}
                />
                <div className="v-settings-action-row">
                    <button
                        type="submit"
                        aria-label="Apply frontmatter key change"
                        disabled={!isValid || !isDirty}
                    >
                        Apply
                    </button>
                </div>
            </form>
        </SettingComponent>
    );
});
FrontmatterKeySetting.displayName = 'FrontmatterKeySetting';

// --- Compression Setting ---

const CompressionSetting: React.FC = memo(() => {
    const dispatch = useAppDispatch();
    const enableCompression = useAppSelector(state => state.app.settings.enableCompression ?? true);

    const handleToggle = (checked: boolean) => {
        dispatch(thunks.updateGlobalSettings({ enableCompression: checked }));
    };

    return (
        <SettingComponent
            name="Enable compression"
            desc="Compress version files using GZIP to save space. Existing files will be migrated automatically when accessed."
        >
            <input
                type="checkbox"
                checked={enableCompression}
                onChange={(e) => handleToggle(e.target.checked)}
                aria-label="Toggle compression"
            />
        </SettingComponent>
    );
});
CompressionSetting.displayName = 'CompressionSetting';

// --- Opt-In AI Diff Summary Settings ---
const AiGenerationSettings: React.FC = memo(() => {
    const dispatch = useAppDispatch();
    const app = useContext(AppContext);
    const enableAiGeneration = useAppSelector(state => state.app.settings.enableAiGeneration ?? false);
    const aiProvider = useAppSelector(state => state.app.settings.aiProvider ?? 'gemini');
    const aiModel = useAppSelector(state => state.app.settings.aiModel ?? 'gemini-3.5-flash-lite');
    const aiCustomEndpoint = useAppSelector(state => state.app.settings.aiCustomEndpoint ?? '');
    const autoGenerateAiOnSave = useAppSelector(state => state.app.settings.autoGenerateAiOnSave ?? true);

    const [apiKeyInput, setApiKeyInput] = useState(() => AiGenerationService.getApiKey(app as unknown as App));
    const [modelInput, setModelInput] = useState(aiModel);
    const [endpointInput, setEndpointInput] = useState(aiCustomEndpoint);
    const [savedFeedback, setSavedFeedback] = useState(false);

    useEffect(() => { setModelInput(aiModel); }, [aiModel]);
    useEffect(() => { setEndpointInput(aiCustomEndpoint); }, [aiCustomEndpoint]);

    const handleSaveConfig = () => {
        AiGenerationService.setApiKey(app as unknown as App, apiKeyInput);
        dispatch(thunks.updateGlobalSettings({
            aiModel: modelInput.trim() || 'gemini-3.5-flash-lite',
            aiCustomEndpoint: endpointInput.trim()
        }));
        setSavedFeedback(true);
        setTimeout(() => setSavedFeedback(false), 2000);
    };

    return (
        <>
            <SettingComponent
                name="Enable AI diff titles & descriptions (Opt-in)"
                desc="Default OFF (100% air-gapped). When enabled, version titles and Markdown descriptions can be generated from your note diffs."
            >
                <input
                    type="checkbox"
                    checked={enableAiGeneration}
                    onChange={(e) => dispatch(thunks.updateGlobalSettings({ enableAiGeneration: e.target.checked }))}
                    aria-label="Toggle AI version generation"
                />
            </SettingComponent>
            {enableAiGeneration && (
                <>
                    <SettingComponent
                        name="Auto-generate when Save Version modal opens"
                        desc="Automatically request a title and Markdown diff summary when clicking + or running Save Version. Never overwrites fields once you begin typing."
                    >
                        <input
                            type="checkbox"
                            checked={autoGenerateAiOnSave}
                            onChange={(e) => dispatch(thunks.updateGlobalSettings({ autoGenerateAiOnSave: e.target.checked }))}
                            aria-label="Toggle auto-generate on save"
                        />
                    </SettingComponent>
                    <SettingComponent
                        name="AI Provider"
                        desc="Select Google Gemini (x-goog-api-key header) or any OpenAI-compatible / Local Ollama endpoint."
                    >
                        <select
                            className="dropdown"
                            value={aiProvider}
                            onChange={(e) => dispatch(thunks.updateGlobalSettings({ aiProvider: e.target.value as AiProviderType }))}
                        >
                            <option value="gemini">Google Gemini API</option>
                            <option value="openai-compatible">OpenAI-Compatible / Local Ollama</option>
                        </select>
                    </SettingComponent>
                    <SettingComponent
                        name="API Key (OS Keychain / SecretStorage Isolated)"
                        desc="Stored strictly in Obsidian SecretStorage / OS DPAPI Keychain on this machine. Never saved to data.json or vault files."
                    >
                        <input
                            type="password"
                            value={apiKeyInput}
                            onChange={(e) => setApiKeyInput(e.target.value)}
                            placeholder={aiProvider === 'gemini' ? 'AIzaSy...' : 'sk-... (or blank for localhost Ollama)'}
                        />
                    </SettingComponent>
                    <SettingComponent
                        name="Model ID"
                        desc="e.g., gemini-3.5-flash-lite, gemini-2.5-flash, gemini-4-argon, or local Ollama model name"
                    >
                        <input
                            type="text"
                            value={modelInput}
                            onChange={(e) => setModelInput(e.target.value)}
                            placeholder="gemini-3.5-flash-lite"
                        />
                    </SettingComponent>
                    <SettingComponent
                        name="Custom Endpoint URL (Optional)"
                        desc="Leave blank for default Gemini/OpenAI endpoint, or set e.g. http://localhost:11434/v1/chat/completions for 100% offline local Ollama."
                    >
                        <div className="v-setting-form">
                            <input
                                type="text"
                                value={endpointInput}
                                onChange={(e) => setEndpointInput(e.target.value)}
                                placeholder="Optional custom endpoint URL"
                            />
                            <div className="v-settings-action-row">
                                <button type="button" className="mod-cta" onClick={handleSaveConfig}>
                                    {savedFeedback ? 'Saved to Keychain!' : 'Save AI Configuration'}
                                </button>
                            </div>
                        </div>
                    </SettingComponent>
                </>
            )}
        </>
    );
});
AiGenerationSettings.displayName = 'AiGenerationSettings';

// --- ID Format Settings ---

const IdFormatFormSchema = v.object({
    noteIdFormat: NoteIdFormatSchema,
    versionIdFormat: VersionIdFormatSchema
});

type IdFormatFormValues = v.InferOutput<typeof IdFormatFormSchema>;

const IdFormatSettings: React.FC = memo(() => {
    const dispatch = useAppDispatch();
    const noteIdFormat = useAppSelector(state => state.app.settings.noteIdFormat);
    const versionIdFormat = useAppSelector(state => state.app.settings.versionIdFormat);
    
    const { control, handleSubmit, reset, formState: { isValid, isDirty } } = useForm<IdFormatFormValues>({
        mode: 'onChange',
        resolver: valibotResolver(IdFormatFormSchema),
        defaultValues: { noteIdFormat, versionIdFormat }
    });

    useEffect(() => {
        reset({ noteIdFormat, versionIdFormat });
    }, [noteIdFormat, versionIdFormat, reset]);

    const onSubmit: SubmitHandler<IdFormatFormValues> = (data) => {
        dispatch(thunks.requestUpdateIdFormats(data.noteIdFormat, data.versionIdFormat));
    };

    return (
        <form onSubmit={handleSubmit(onSubmit)} className="v-setting-form">
            <SettingComponent
                name="Note ID format"
                desc="Format for generating note IDs. Available variables: {path}, {uuid}, {timestamp}. Default: {uuid}"
            >
                <ValidatedInput
                    name="noteIdFormat"
                    control={control}
                    placeholder="{uuid}"
                    maxLength={100}
                />
            </SettingComponent>
            
            <SettingComponent
                name="Version ID format"
                desc="Format for generating version IDs. Available variables: {timestamp}, {version}, {name}. Default: {timestamp}_{version}"
            >
                <ValidatedInput
                    name="versionIdFormat"
                    control={control}
                    placeholder="{timestamp}_{version}"
                    maxLength={100}
                />
            </SettingComponent>

            {isDirty && (
                <div className="v-settings-action-row">
                    <button
                        type="submit"
                        aria-label="Apply ID format changes"
                        className="mod-cta"
                        disabled={!isValid}
                    >
                        Apply ID format changes
                    </button>
                </div>
            )}
        </form>
    );
});
IdFormatSettings.displayName = 'IdFormatSettings';

interface GlobalSettingsProps {
    showTitle?: boolean;
    showPluginSettings?: boolean;
    showDefaults?: boolean;
    activeViewMode?: ViewMode;
    headerAction?: React.ReactNode;
}

export const GlobalSettings: React.FC<GlobalSettingsProps> = memo(({ 
    showTitle = true, 
    showPluginSettings = true, 
    showDefaults = true,
    activeViewMode,
    headerAction
}) => {
    return (
        <div className="v-settings-section" role="region" aria-labelledby="global-settings-title">
            {showTitle && (
                <div className="v-settings-section-header-row">
                    <h2 id="global-settings-title">Global plugin settings</h2>
                    {headerAction}
                </div>
            )}
            
            {showPluginSettings && (
                <>
                    <DatabasePathSetting />
                    <FrontmatterKeySetting />
                    <CompressionSetting />
                    <AiGenerationSettings />
                    <IdFormatSettings />
                </>
            )}
            
            {showDefaults && (
                <>
                    {(!activeViewMode || activeViewMode === 'versions') && (
                        <div style={{marginTop: '20px', borderTop: showPluginSettings ? '1px solid var(--background-modifier-border)' : 'none', paddingTop: '10px'}}>
                            <h3 id="global-version-defaults-title">
                                Global version history defaults
                            </h3>
                            <p className="setting-item-description">
                                These settings apply to all notes using version history unless overridden.
                            </p>
                            <AutoRegisterSettings settingKey="versionHistorySettings" />
                        </div>
                    )}

                    {(!activeViewMode || activeViewMode === 'edits') && (
                        <div style={{marginTop: '20px', borderTop: (showPluginSettings || !activeViewMode) ? '1px solid var(--background-modifier-border)' : 'none', paddingTop: '10px'}}>
                            <h3 id="global-edit-defaults-title">
                                Global edit history defaults
                            </h3>
                            <p className="setting-item-description">
                                These settings apply to all notes using edit history unless overridden.
                            </p>
                            <AutoRegisterSettings settingKey="editHistorySettings" />
                        </div>
                    )}
                </>
            )}
        </div>
    );
});
GlobalSettings.displayName = 'GlobalSettings';
