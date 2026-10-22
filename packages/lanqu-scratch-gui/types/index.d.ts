/**
 * Type declarations for @lanqu/scratch-gui.
 *
 * The wrapper exposes two host-facing surfaces, matching easy-scratch3's model:
 *
 *   1. Declarative: set `window.scratchConfig` before the editor bundle loads.
 *   2. Imperative: call `window.scratch.*` after the editor mounts.
 *
 * These declarations describe the merged scratchConfig schema (see
 * src/config/default-config.js for the authoritative defaults) and the
 * runtime API (see src/api/scratch-api.js).
 */
import {ReactNode, CSSProperties} from 'react';

// ---------------------------------------------------------------------------
// scratchConfig (declarative)
// ---------------------------------------------------------------------------

export interface ScratchSessionConfig {
    /** Auth token. Its presence determines cloud-variable write permission. */
    token?: string;
    /** Display username; anonymous hosts use 'anonymous'. */
    username?: string;
}

export interface ScratchBackpackConfig {
    enable?: boolean;
    /** Backpack API host. */
    api?: string;
}

export interface ScratchCloudDataConfig {
    enable?: boolean;
    /** 'create' (unsaved draft) or a saved work id. */
    id?: string;
    /** Cloud WebSocket host. */
    api?: string;
}

export interface ScratchProjectInfoConfig {
    projectName?: string;
    authorUsername?: string;
    authorAvatar?: string;
}

export interface ScratchLogoConfig {
    show?: boolean;
    url?: string;
    handleClickLogo?: () => void;
}

export interface ScratchMenuBarConfig {
    style?: CSSProperties & Record<string, string>;
    languageButton?: {
        show?: boolean;
        defaultLanguage?: string;
    };
    newButton?: {
        show?: boolean;
        handleBefore?: () => boolean;
    };
    loadFileButton?: {
        show?: boolean;
        handleBefore?: () => boolean;
        handleAfter?: () => void;
        handleFailure?: () => void;
    };
    saveFileButton?: {
        show?: boolean;
        handleBefore?: () => boolean;
    };
    turboModeButton?: {show?: boolean};
    helpButton?: {
        show?: boolean;
        handleBefore?: () => boolean;
    };
    debugButton?: {show?: boolean};
    myStuff?: {
        show?: boolean;
        url?: string;
    };
    userAvatar?: {
        show?: boolean;
        username?: string;
        avatar?: string;
        handleClick?: () => void;
    };
    /** Extra buttons rendered after the first divider in the menu bar. */
    customButtons?: Array<{
        show?: boolean;
        buttonName?: string;
        style?: CSSProperties & Record<string, string>;
        handleClick?: () => void;
    }>;
}

export interface ScratchBlocksConfig {
    /** Canvas zoom scale (e.g. 0.675). */
    scale?: number;
    /** Categories hidden from the toolbox (e.g. ['sensing']). */
    hideCatagorys?: string[];
    /** Individual blocks hidden from the toolbox. */
    hideBlocks?: string[];
}

export interface ScratchStageAreaConfig {
    fullscreenButton?: {
        show?: boolean;
        handleBeforeSetStageFull?: () => boolean;
        handleBeforeSetStageUnFull?: () => boolean;
    };
    startButton?: {
        show?: boolean;
        handleBeforeStart?: () => boolean;
    };
    stopButton?: {
        show?: boolean;
        handleBeforeStop?: () => boolean;
    };
    scale?: number;
    width?: number;
    height?: number;
}

export interface ScratchAssetsConfig {
    /** Host prefix for project and asset URLs (e.g. //storage.lanqu.vip). */
    assetHost?: string;
}

export interface ScratchConfig {
    session?: ScratchSessionConfig;
    backpack?: ScratchBackpackConfig;
    cloudData?: ScratchCloudDataConfig;
    projectInfo?: ScratchProjectInfoConfig;
    logo?: ScratchLogoConfig;
    menuBar?: ScratchMenuBarConfig;
    blocks?: ScratchBlocksConfig;
    stageArea?: ScratchStageAreaConfig;
    assets?: ScratchAssetsConfig;
    /** Boot in player-only mode (only the stage renders). */
    isPlayerOnly?: boolean;
    /** Read-only editor: blocks workspace locked, edit affordances hidden. */
    readOnly?: boolean;
    /** Blocks-only layout: stage and target pane hidden. */
    blocksOnly?: boolean;
    /** Called once the VM is available. */
    handleVmInitialized?: (vm: unknown) => void;
    /** Called after a project (re)loads. */
    handleProjectLoaded?: () => void;
    /** Called after the default project loads. */
    handleDefaultProjectLoaded?: () => void;
    /** Dirty-state callback: true on edit, false after markSaved/reload. */
    handleProjectChanged?: (changed: boolean) => void;
    /** Cloud connection status: 'connecting' | 'connected' | 'error' | 'disconnected'. */
    handleCloudStatusChange?: (status: CloudStatus) => void;
}

export type CloudStatus = 'connecting' | 'connected' | 'error' | 'disconnected';

// ---------------------------------------------------------------------------
// window.scratch.* (imperative)
// ---------------------------------------------------------------------------

export interface ScratchRuntimeApi {
    /** Read redux state (debugging / observation). */
    getState: () => unknown;
    /** Toggle player-only mode at runtime. */
    setPlayerOnly: (isPlayerOnly: boolean) => void;
    /** Toggle fullscreen at runtime. */
    setFullScreen: (isFullScreen: boolean) => void;
    /** Switch the editor locale. */
    setLocale: (locale: string) => void;
    /** Enable/disable cloud data at runtime (triggers a reconnect when on). */
    setEnableCouldData: (enable: boolean) => void;
    /** Point cloud variables at a saved work or 'create' draft. */
    setCloudId: (id: string) => void;
    /** Current cloud project/draft id ('' when none). */
    getCloudId: () => string;
    /** Override the account name used for cloud draft buckets. */
    setAuthorUsername: (username: string) => void;
    /** Load a project from a URL into the VM. callback(err?) */
    loadProject: (url: string, callback?: (err?: Error) => void) => void;
    /** Export the current project as an .sb3 Blob. callback(result?, err?) */
    getProjectFile: (callback: (result?: Blob, err?: Error) => void) => void;
    /** Export a PNG data-URI preview of the stage. */
    getProjectCover: (callback: (dataUri: string) => void) => void;
    /** Export a Blob preview of the stage. */
    getProjectCoverBlob: (callback: (blob: Blob) => void) => void;
    /** Current project title ('' before a name is set). */
    getProjectName: () => string;
    /** Set the project title (updates the title input + redux). */
    setProjectName: (name: string) => void;
    /** True once the project has been edited since the last save/load. */
    isDirty: () => boolean;
    /** Mark the project saved; clears the dirty flag and notifies the host. */
    markSaved: () => void;
    /** Merge assets into the sprite/costume/backdrop/sound library drawers. */
    pushSpriteLibrary: (items: unknown[]) => void;
    pushCostumesLibrary: (items: unknown[]) => void;
    pushBackdropsLibrary: (items: unknown[]) => void;
    pushSoundsLibrary: (items: unknown[]) => void;
    /**
     * Subscribe to cloud connection status. Replays the latest status on
     * registration so a late host gets the current state immediately.
     */
    onCloudStatusChange: (callback: (status: CloudStatus) => void) => void;
}

declare global {
    interface Window {
        scratchConfig?: ScratchConfig;
        scratch: ScratchRuntimeApi & {
            _config: ScratchConfig;
            _root?: unknown;
        };
        vm?: unknown;
    }
}
