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
    // 根因修复:player 舞台整体双轴居中。
    // 之前依赖手写 CSS `#scratch .app`(后代选择器),但 .app 落在 #scratch 自身
    // (这里 appTarget.className='app'),选择器永远匹配不上 → 未居中。
    // 直接用内联样式兜底,不依赖任意 CSS 选择器;GUI 全屏类名是哈希值,这里
    // 只处理非全屏基础布局(margin:auto 让舞台在 flex 容器内双轴居中)。
    Object.assign(appTarget.style, {
        width: '100%',
        height: '100%',
        minWidth: '0',
        minHeight: '0',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center'
    });
}

const hostConfig = (typeof window !== 'undefined' && window.scratchConfig) || {};
// 标记播放器模式:createEasyRoot → configToGui → buildEditorStateParams 据此把
// isPlayerOnly 注入 EditorStateParams,经 initPlayer 在 store 创建时即定为
// 播放器模式(运行时 dispatch 因 react-redux 实例重复不生效,故须在初始化确定)。
const config = mergeConfig({...hostConfig, isPlayerOnly: true});

const root = createEasyRoot(config, appTarget);
root.render({isPlayerOnly: true});

window.scratch = window.scratch || {};
window.scratch._root = root;
