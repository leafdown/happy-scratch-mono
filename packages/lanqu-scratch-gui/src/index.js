/**
 * @lanqu/scratch-gui — B-plan wrapper around @scratch/scratch-gui (v15).
 *
 * Port of easy-scratch3's customization model: host pages inject
 * `window.scratchConfig` (declarative) and call `window.scratch.*` (imperative).
 *
 * Public API:
 *   - createEasyRoot(scratchConfig, container): mount the editor into a DOM node
 *   - EasyScratch: React component form (for hosts that prefer JSX)
 */
import React from 'react';
import ReactDOM from 'react-dom';
import {
    EditorState,
    createStandaloneRoot,
    setCustomLayout
} from '@scratch/scratch-gui/standalone';
import {configToGui} from './config/config-to-gui.js';
import {scratchApiHOC} from './api/scratch-api.js';

/**
 * Build the wrapper HOC array. scratchApiHOC injects patch-driven props
 * (customButtons, blocksOptions, etc.) and registers window.scratch.* on mount.
 */
const buildWrappers = (config, store) => [
    scratchApiHOC(config, store)
];

/**
 * Mount the Lanqu-wrapped Scratch editor into `container`.
 *
 * @param {object} hostConfig scratchConfig (merged with defaults internally)
 * @param {HTMLElement} container DOM node to mount into
 * @returns {{render: Function, unmount: Function}} standalone root handle
 */
const createEasyRoot = (hostConfig, container) => {
    const {config, editorStateParams, guiConfigFactory} = configToGui(hostConfig);

    // Inject global style overrides for Lanqu visual tweaks (avatar shape,
    // dropdown colors). These are additive CSS rules that don't change layout.
    injectCustomStyles(config);

    // Patch P11: apply stage size/scale overrides before the editor boots.
    if (config.stageArea) {
        setCustomLayout({
            stageScale: config.stageArea.scale,
            stageWidth: config.stageArea.width,
            stageHeight: config.stageArea.height
        });
    }

    const state = new EditorState(editorStateParams, guiConfigFactory);
    const root = createStandaloneRoot(state, container, {
        wrappers: buildWrappers(config, state.store)
    });

    // Expose the original render but pre-bind the patch-driven props derived from
    // scratchConfig, so hosts get easy-scratch3-style behavior out of the box.
    const originalRender = root.render;
    const render = props => originalRender(buildPatchProps(config, props));
    return {
        ...root,
        render,
        config,
        store: state.store
    };
};

/**
 * Derive the patch-driven props from scratchConfig. These map to the scratch-gui
 * source patches (P1..P16) — each is an optional extension point that defaults to
 * no-op when undefined.
 */
const buildPatchProps = (config, extraProps = {}) => {
    const props = {...extraProps};

    // 允许编辑作品名(显示 ProjectTitleInput)
    props.canEditTitle = true;
    // 禁止从 scratch 菜单直接保存(交由自定义提交按钮)
    props.canSave = false;
    // 传递素材 host 地址,否则 GUI 组件挂载后会 setAssetHost 到默认 MIT
    if (config.assets && config.assets.assetHost) {
        props.assetHost = config.assets.assetHost;
    }

    // MenuBar (P1/P2): customButtons + background style
    if (config.menuBar) {
        if (config.menuBar.customButtons) {
            props.customButtons = config.menuBar.customButtons;
        }
        if (config.menuBar.style && Object.keys(config.menuBar.style).length) {
            props.menuBarStyle = config.menuBar.style;
        }
        // Language button visibility is a native prop (no patch needed).
        if (config.menuBar.languageButton) {
            props.canChangeLanguage = config.menuBar.languageButton.show !== false;
        }
        // Tutorials button visibility (helpButton.show). Debug button hidden
        // by default (Lanqu editor doesn't expose it) unless menuBar.debugButton.show.
        if (config.menuBar.helpButton) {
            props.showTutorialsButton = config.menuBar.helpButton.show !== false;
        }
        props.showDebugButton = !!(config.menuBar.debugButton && config.menuBar.debugButton.show === true);
        if (config.menuBar.newButton && config.menuBar.newButton.handleBefore) {
            props.onBeforeNewProject = config.menuBar.newButton.handleBefore;
        }
        if (config.menuBar.loadFileButton && config.menuBar.loadFileButton.handleBefore) {
            props.onBeforeProjectUpload = config.menuBar.loadFileButton.handleBefore;
        }
        if (config.menuBar.loadFileButton && config.menuBar.loadFileButton.handleAfter) {
            props.onAfterProjectUpload = config.menuBar.loadFileButton.handleAfter;
        }
        if (config.menuBar.loadFileButton && config.menuBar.loadFileButton.handleFailure) {
            props.onProjectUploadFailed = config.menuBar.loadFileButton.handleFailure;
        }
        if (config.menuBar.saveFileButton && config.menuBar.saveFileButton.handleBefore) {
            props.onBeforeSaveToComputer = config.menuBar.saveFileButton.handleBefore;
        }
        if (config.menuBar.helpButton && config.menuBar.helpButton.handleBefore) {
            props.onBeforeHelp = config.menuBar.helpButton.handleBefore;
        }
        // File menu item visibility (P8): hide individual New/Load/Save entries.
        props.showNewButton = !config.menuBar.newButton || config.menuBar.newButton.show !== false;
        props.showLoadButton = !config.menuBar.loadFileButton || config.menuBar.loadFileButton.show !== false;
        props.showSaveButton = !config.menuBar.saveFileButton || config.menuBar.saveFileButton.show !== false;
        props.showTurboModeButton = !config.menuBar.turboModeButton ||
            config.menuBar.turboModeButton.show !== false;
    }

    // Blocks (P3/P4): scale + hide config
    if (config.blocks) {
        props.blocksOptions = {
            zoom: {startScale: config.blocks.scale}
        };
        if (config.blocks.hideCatagorys?.length || config.blocks.hideBlocks?.length) {
            props.blocksHideConfig = {
                categories: config.blocks.hideCatagorys || [],
                blocks: config.blocks.hideBlocks || []
            };
        }
    }

    // StageArea (P5/P12/P13): button visibility + intercept hooks
    if (config.stageArea) {
        const sa = config.stageArea;
        props.controlsConfig = {
            showStartButton: sa.startButton?.show !== false,
            showStopButton: sa.stopButton?.show !== false,
            onBeforeStart: sa.startButton?.handleBeforeStart,
            onBeforeStop: sa.stopButton?.handleBeforeStop
        };
        props.stageHeaderConfig = {
            showFullscreenButton: sa.fullscreenButton?.show !== false,
            onBeforeSetStageFull: sa.fullscreenButton?.handleBeforeSetStageFull,
            onBeforeSetStageUnFull: sa.fullscreenButton?.handleBeforeSetStageUnFull
        };
    }

    // Logo (native props: logo URL + onClickLogo, patch: showLogo)
    if (config.logo) {
        props.showLogo = config.logo.show !== false;
        if (config.logo.url) {
            props.logo = config.logo.url;
        }
        if (config.logo.handleClickLogo) {
            props.onClickLogo = config.logo.handleClickLogo;
        }
    }

    // Account menu (native accountMenuOptions prop): user avatar + my stuff link.
    // Maps scratchConfig.menuBar.userAvatar / myStuff to v14's AccountMenuOptions.
    if (config.menuBar && (config.menuBar.userAvatar || config.menuBar.myStuff)) {
        const ua = config.menuBar.userAvatar || {};
        const ms = config.menuBar.myStuff || {};
        props.accountMenuOptions = {
            canHaveSession: ua.show !== false,
            avatarUrl: ua.avatar || (config.projectInfo && config.projectInfo.authorAvatar),
            myStuffUrl: ms.show !== false ? (ms.url || '') : undefined,
            accountSettingsUrl: '/account/settings/BaseSetting'
        };
        if (ua.handleClick) {
            // Replaces the default "open account menu" click on the avatar.
            props.accountMenuOptions.onClick = ua.handleClick;
        }
        if (ua.username) {
            props.username = ua.username;
        }
    }

    // Backpack (native props): show UI when enabled. backpackConfigured reflects
    // whether a storage backend exists (HTTP api or localStorage fallback).
    if (config.backpack && config.backpack.enable) {
        props.backpackVisible = true;
        props.backpackConfigured = true;
        if (config.backpack.api) {
            props.backpackHost = config.backpack.api;
        }
    }

    // Cloud host (native prop, consumed by cloudManagerHOC). Keep these wired
    // even when cloud data starts disabled so setEnableCouldData(true) can
    // establish a connection at runtime.
    if (config.cloudData && config.cloudData.api) {
        props.cloudHost = config.cloudData.api;
        props.hasCloudPermission = true;
    }

    // handleProjectLoaded is driven by the VM's PROJECT_LOADED event inside
    // scratchApiHOC, so it fires for window.scratch.loadProject() too (the GUI
    // redux isShowingProject flag does not change for direct VM loads).

    return props;
};

/** Copy the props that belong to the editor root, dropping EasyScratch's own. */
const getEditorProps = props => {
    const editorProps = {...props};
    delete editorProps.scratchConfig;
    delete editorProps.config;
    delete editorProps.className;
    delete editorProps.style;
    delete editorProps.children;
    return editorProps;
};

/** Shallow equality for editor props; functions and objects compare by identity. */
const shallowEqual = (a, b) => {
    if (a === b) return true;
    const aKeys = Object.keys(a);
    const bKeys = Object.keys(b);
    if (aKeys.length !== bKeys.length) return false;
    return aKeys.every(key => Object.prototype.hasOwnProperty.call(b, key) && a[key] === b[key]);
};

/**
 * React component form of the editor. Mount it into a sized container:
 *
 *   <EasyScratch scratchConfig={config} style={{height: '100vh'}} />
 *
 * The config (`scratchConfig`, or its alias `config`) is read once when the
 * component mounts; remount the component (for example by changing its `key`)
 * to boot with a different config. Remaining props are forwarded to the editor
 * root's render(), and a ref receives this component instance, whose
 * getRoot()/unmount()/config/store expose the createEasyRoot() handle.
 *
 * Implemented as a class component on purpose: the UMD build bundles its own
 * React, so hooks in a function component would resolve the wrong dispatcher
 * when a host renders it with a different React copy.
 */
class EasyScratch extends React.Component {
    constructor (props) {
        super(props);
        const hostConfig = props.scratchConfig || props.config || {};
        // isPlayerOnly is a boot-time EditorState flag, so fold the prop (when
        // supplied) into the config before createEasyRoot() builds EditorState.
        this.hostConfig = props.isPlayerOnly === undefined ?
            hostConfig :
            {...hostConfig, isPlayerOnly: props.isPlayerOnly};
        this.containerRef = React.createRef();
        this.root = null;
        this.forwardedProps = null;
    }

    componentDidMount () {
        if (!this.containerRef.current) return;
        this.root = createEasyRoot(this.hostConfig, this.containerRef.current);
        this.forwardEditorProps();
    }

    componentDidUpdate () {
        this.forwardEditorProps();
    }

    componentWillUnmount () {
        if (this.root) this.root.unmount();
        this.root = null;
        this.forwardedProps = null;
    }

    /** Push non-config props into the editor root, skipping unchanged values. */
    forwardEditorProps () {
        if (!this.root) return;
        const editorProps = getEditorProps(this.props);
        if (this.forwardedProps && shallowEqual(this.forwardedProps, editorProps)) return;
        this.forwardedProps = editorProps;
        this.root.render(editorProps);
    }

    /** The createEasyRoot() handle for the mounted editor. */
    getRoot () {
        return this.root;
    }

    unmount () {
        if (this.root) this.root.unmount();
    }

    get config () {
        return this.root && this.root.config;
    }

    get store () {
        return this.root && this.root.store;
    }

    render () {
        return React.createElement('div', {
            ref: this.containerRef,
            className: this.props.className,
            style: {width: '100%', height: '100%', ...this.props.style}
        });
    }
}

EasyScratch.displayName = 'EasyScratch';

/**
 * Inject global CSS overrides for Lanqu visual tweaks. Additive — only adds
 * rules, doesn't remove scratch-gui defaults. Idempotent (guarded by a marker).
 */
const injectCustomStyles = config => {
    if (typeof document === 'undefined') return;
    if (document.getElementById('lanqu-custom-styles')) return;
    const style = document.createElement('style');
    style.id = 'lanqu-custom-styles';
    const menuBg = (config.menuBar && config.menuBar.style && config.menuBar.style.background) ||
        'hsla(215, 100%, 65%, 1)';
    const logoUrl = (config.logo && config.logo.url) || '';
    style.textContent = `
        /* Menu bar: apply configured background color */
        header[role="banner"], [class*="menu-bar"] {
            background: ${menuBg} !important;
        }
        /* Logo image */
        #logo_img {
            content: url(${logoUrl ? `"${logoUrl}"` : 'none'});
        }
        /* User avatar: white background, fully round */
        [class*="user-avatar"] [class*="user-thumbnail"],
        [class*="account-info"] img[src*="avatar"],
        [class*="account-menu"] [class*="avatar"] {
            border-radius: 50% !important;
            background: #fff !important;
            object-fit: cover;
            border: 2px solid #fff !important;
            box-shadow: 0 0 0 1px rgba(0,0,0,0.15) !important;
        }
        /* Dropdown menus: match the customized menu bar color instead of the
           default purple ($looks-secondary = rgb(133,92,214)).
           Only target the dropdown UL (menu_menu_xxx), NOT action-menu_menu-container
           (the sprite/backdrop add button) which also contains "menu_menu". */
        ul[class*="menu_menu"]:not([class*="container"]) {
            background-color: ${menuBg} !important;
        }
        /* Full height layout for the editor */
        [class*="gui_body-wrapper"] {
            height: calc(100vh - 48px) !important;
            min-height: calc(100vh - 48px) !important;
        }
    `;
    document.head.appendChild(style);
};

export {
    createEasyRoot,
    EasyScratch,
    buildPatchProps
};
