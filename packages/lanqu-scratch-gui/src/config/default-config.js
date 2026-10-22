/**
 * Default scratchConfig. Host pages inject `window.scratchConfig` to override
 * these values; any missing field falls back to the defaults here.
 *
 * This mirrors the contract documented in easy-scratch3/src/playground/index.ejs.
 */
const defaultConfig = {
    session: {
        token: '',
        username: ''
    },
    backpack: {
        enable: false,
        api: ''
    },
    cloudData: {
        enable: false,
        id: 'create',
        api: ''
    },
    projectInfo: {
        projectName: '',
        authorUsername: '',
        authorAvatar: ''
    },
    logo: {
        show: true,
        url: '',
        handleClickLogo: () => {}
    },
    menuBar: {
        style: {},
        languageButton: {
            show: true,
            defaultLanguage: 'en'
        },
        newButton: {
            show: true,
            handleBefore: () => true
        },
        loadFileButton: {
            show: true,
            handleBefore: () => true,
            handleAfter: () => {},
            handleFailure: () => {}
        },
        saveFileButton: {
            show: true,
            handleBefore: () => true
        },
        turboModeButton: {
            show: true
        },
        helpButton: {
            show: true,
            handleBefore: () => true
        },
        myStuff: {
            show: false,
            url: ''
        },
        userAvatar: {
            show: true,
            username: '',
            avatar: ''
        },
        customButtons: []
    },
    blocks: {
        scale: 0.675,
        hideCatagorys: [],
        hideBlocks: []
    },
    stageArea: {
        fullscreenButton: {
            show: true,
            handleBeforeSetStageFull: () => true,
            handleBeforeSetStageUnFull: () => true
        },
        startButton: {
            show: true,
            handleBeforeStart: () => true
        },
        stopButton: {
            show: true,
            handleBeforeStop: () => true
        },
        scale: 1,
        width: 480,
        height: 360
    },
    assets: {
        // Host prefix for project and asset URLs (for example //storage.lanqu.vip).
        // Custom library content is pushed at runtime via window.scratch.push*Library.
        assetHost: ''
    },
    // Boot in player-only mode. Only affects the initial EditorState; use
    // window.scratch.setPlayerOnly() to switch later.
    isPlayerOnly: false,
    // Read-only editor: disables block editing (workspace marked read-only),
    // hides the sprite/backdrop add, delete, duplicate and export affordances,
    // and disables the sprite property inputs. Stage runs untouched so projects
    // still play. Default false.
    readOnly: false,
    // Blocks-only layout: hides the stage and target pane entirely so the blocks
    // editor fills the window. Default false.
    blocksOnly: false,
    handleVmInitialized: () => {},
    handleProjectLoaded: () => {},
    handleDefaultProjectLoaded: () => {},
    // Dirty-state callback: fires with true whenever the VM reports the project
    // changed (blocks moved, costume uploaded, ...). Hosts pair it with
    // window.scratch.isDirty()/markSaved() to drive their own autosave and
    // beforeunload prompts. Default no-op keeps behavior unchanged.
    handleProjectChanged: () => {},
    // Cloud connection status callback: fires with 'connecting', 'connected',
    // 'error' or 'disconnected' as the Lanqu cloud WebSocket transitions state.
    // Hosts use this to surface "cloud variables are offline" instead of
    // failing silently.
    handleCloudStatusChange: () => {}
};

/**
 * Deep-merge the host-provided scratchConfig over the defaults.
 * Arrays and functions from the host replace defaults (no deep merge).
 */
const mergeConfig = (hostConfig = {}) => {
    const merge = (target, source) => {
        const result = {...target};
        for (const key of Object.keys(source)) {
            const sourceVal = source[key];
            if (
                sourceVal !== null &&
                typeof sourceVal === 'object' &&
                !Array.isArray(sourceVal) &&
                typeof target[key] === 'object' &&
                !Array.isArray(target[key])
            ) {
                result[key] = merge(target[key], sourceVal);
            } else if (sourceVal !== undefined) {
                result[key] = sourceVal;
            }
        }
        return result;
    };
    return merge(defaultConfig, hostConfig);
};

export {
    defaultConfig,
    mergeConfig
};
