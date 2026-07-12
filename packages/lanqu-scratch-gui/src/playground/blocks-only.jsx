/**
 * Playground entry: blocks-only mode (just the blocks editor + controls, no stage).
 * Uses isPlayerOnly=false but the host layout hides the stage wrapper via CSS.
 *
 * Note: v14's GUIComponent doesn't expose a native "blocks only" toggle, so this
 * mode renders the full editor; hosts that want a true blocks-only view should
 * apply CSS to hide the stage/target pane. This matches easy-scratch3's approach.
 */
import 'es6-object-assign/auto';
import {createEasyRoot} from '../index.js';
import {mergeConfig} from '../config/default-config.js';

import './render-gui.css';

const appTarget = document.getElementById('scratch');
if (appTarget) {
    appTarget.className = 'app';
}

const hostConfig = (typeof window !== 'undefined' && window.scratchConfig) || {};
const config = mergeConfig(hostConfig);

const root = createEasyRoot(config, appTarget);
root.render({});

window.scratch = window.scratch || {};
window.scratch._root = root;
