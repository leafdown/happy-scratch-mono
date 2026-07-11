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
    createStandaloneRoot
} from '@scratch/scratch-gui/standalone';
import {configToGui} from './config/config-to-gui.js';
import {scratchApiHOC} from './api/scratch-api.js';

/**
 * Build the wrapper HOC array. scratchApiHOC injects patch-driven props
 * (customButtons, blocksOptions, etc.) and registers window.scratch.* on mount.
 */
const buildWrappers = config => [
    scratchApiHOC(config)
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
    const state = new EditorState(editorStateParams, guiConfigFactory);
    const root = createStandaloneRoot(state, container, {
        wrappers: buildWrappers(config)
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

    // Logo (native onClickLogo prop)
    if (config.logo) {
        if (config.logo.handleClickLogo) {
            props.onClickLogo = config.logo.handleClickLogo;
        }
    }

    // Cloud host (native prop, consumed by cloudManagerHOC)
    if (config.cloudData && config.cloudData.enable && config.cloudData.api) {
        props.cloudHost = config.cloudData.api;
        props.hasCloudPermission = true;
    }

    // VM init / project loaded callbacks (native props)
    if (config.handleVmInitialized) {
        props.onVmInit = config.handleVmInitialized;
    }
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

export {
    createEasyRoot,
    EasyScratch,
    buildPatchProps
};
