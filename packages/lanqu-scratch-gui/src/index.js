/**
 * @lanqu/scratch-gui — B-plan wrapper around @scratch/scratch-gui (v14).
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
        config
    };
};

/**
 * Derive the patch-driven props from scratchConfig. These map to the scratch-gui
 * source patches (P1..P13) — each is an optional extension point that defaults to
 * no-op when undefined.
 */
const buildPatchProps = (config, extraProps = {}) => {
    const props = {...extraProps};

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

    // Logo (native props: logo URL + onClickLogo)
    if (config.logo) {
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
            avatarUrl: ua.avatar,
            myStuffUrl: ms.show !== false ? (ms.url || '') : undefined,
            accountSettingsUrl: '/account/settings/BaseSetting'
        };
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

    // Cloud host (native prop, consumed by cloudManagerHOC)
    if (config.cloudData && config.cloudData.enable && config.cloudData.api) {
        props.cloudHost = config.cloudData.api;
        props.hasCloudPermission = true;
    }

    // Project loaded callback (native prop). onVmInit is intercepted by
    // scratchApiHOC, which forwards to config.handleVmInitialized.
    if (config.handleProjectLoaded) {
        props.onProjectLoaded = config.handleProjectLoaded;
    }

    return props;
};

/**
 * React component form. For hosts that mount via JSX rather than createEasyRoot.
 */
const EasyScratch = props => {
    // Component form defers to createEasyRoot on mount. Stage 6 will flesh this
    // out; for now the imperative createEasyRoot is the primary entry point.
    throw new Error('EasyScratch component form is not implemented yet; use createEasyRoot');
};

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
    // User avatar: white background, fully round.
    // Dropdown menus: inherit the menu bar background instead of the default
    // purple ($looks-secondary) so they match the customized menu bar color.
    style.textContent = `
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
           default purple ($looks-secondary = rgb(133,92,214)). */
        [class*="menu_menu"] {
            background-color: ${menuBg} !important;
        }
    `;
    document.head.appendChild(style);
};

export {
    createEasyRoot,
    EasyScratch,
    buildPatchProps
};
