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
            handleBefore: () => true
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
            avatar: '',
            handleClick: () => {}
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
        assetHost: '',
        defaultIndex: {
            sprites: '',
            costumes: '',
            backdrops: '',
            sounds: ''
        },
        handleBeforeSpriteLibraryOpen: () => true,
        handleBeforeCostumesLibraryOpen: () => true,
        handleBeforeBackdropsLibraryOpen: () => true,
        handleBeforeSoundLibraryOpen: () => true
    },
    handleVmInitialized: () => {},
    handleProjectLoaded: () => {},
    handleDefaultProjectLoaded: () => {},
    defaultProjectURL: ''
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
