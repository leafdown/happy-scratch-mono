/**
 * Playground entry: full editor mode.
 *
 * Reads window.scratchConfig (host-injected) and mounts the Lanqu-wrapped editor.
 * This is the default mode; player.jsx and blocks-only.jsx are the other two modes.
 */
import 'es6-object-assign/auto';
import React from 'react';
import ReactDOM from 'react-dom';

import {createEasyRoot} from '../index.js';
import {mergeConfig} from '../config/default-config.js';
import {defaultConfig} from '../config/default-config.js';

import './render-gui.raw.css';

const appTarget = document.getElementById('scratch');
if (appTarget) {
    appTarget.className = 'app';
}

const hostConfig = (typeof window !== 'undefined' && window.scratchConfig) || {};
const config = mergeConfig(hostConfig);

// Mount the editor. createEasyRoot handles EditorState, GUIConfig, and patch props.
const root = createEasyRoot(config, appTarget);
root.render({});

// Expose for debugging / host scripts.
window.scratch = window.scratch || {};
window.scratch._root = root;
