/**
 * Playground entry: blocks-only mode (just the blocks editor, no stage/target
 * pane). Uses isPlayerOnly=false but passes blocksOnly=true so GUIComponent
 * skips the whole stage-and-target aside (P22). This replaces the previous CSS
 * hiding approach and works without any host stylesheet.
 */
import 'es6-object-assign/auto';
import {createEasyRoot} from '../index.js';
import {mergeConfig} from '../config/default-config.js';

import './render-gui.raw.css';

const appTarget = document.getElementById('scratch');
if (appTarget) {
    appTarget.className = 'app';
}

const hostConfig = (typeof window !== 'undefined' && window.scratchConfig) || {};
const config = mergeConfig({...hostConfig, blocksOnly: true});

const root = createEasyRoot(config, appTarget);
root.render({});

window.scratch = window.scratch || {};
window.scratch._root = root;
