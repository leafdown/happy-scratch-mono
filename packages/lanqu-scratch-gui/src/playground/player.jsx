/**
 * Playground entry: player-only mode (no editor, just the stage).
 * Mounts the editor with isPlayerOnly so only the stage renders.
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
const config = mergeConfig(hostConfig);

const root = createEasyRoot(config, appTarget);
// isPlayerOnly is an EditorStateParams flag; createEasyRoot reads it from
// scratchConfig indirectly, so we also pass it as a prop for the GUI layer.
root.render({isPlayerOnly: true});

window.scratch = window.scratch || {};
window.scratch._root = root;
