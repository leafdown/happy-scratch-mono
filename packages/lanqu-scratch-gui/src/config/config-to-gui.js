/**
 * Convert a merged scratchConfig into:
 *   - EditorStateParams (locale, mode flags)
 *   - a GUIConfig factory (storage/backpack/cloud)
 *
 * The GUIConfig factory is deferred so storage adapters are only constructed
 * when the editor actually boots.
 */
import {mergeConfig} from './default-config.js';
import {createLanquStorage} from '../storage/lanqu-storage.js';

/**
 * Build EditorStateParams from scratchConfig.
 * Only the fields EditorState accepts (see scratch-gui src/lib/editor-state.tsx).
 */
const buildEditorStateParams = config => ({
    locale: config.menuBar.languageButton.defaultLanguage,
    // isPlayerOnly 由入口(player.jsx)经 hostConfig 传入;走 EditorState 的
    // initPlayer 初始化路径,使 store 首次创建即为播放器模式。运行时切换由
    // window.scratch.setPlayerOnly 派发 setPlayer 完成(与 store 同一实例)。
    isPlayerOnly: config.isPlayerOnly === true,
    isFullScreen: false
});

/**
 * Build a GUIConfig factory. Returns a function so storage is created lazily.
 */
const buildGuiConfigFactory = config => () => ({
    storage: createLanquStorage(config)
});

/**
 * Read window.scratchConfig (if any), merge with defaults, and return both
 * the editor params and the config factory.
 */
const configToGui = hostConfig => {
    const config = mergeConfig(hostConfig);
    return {
        config,
        editorStateParams: buildEditorStateParams(config),
        guiConfigFactory: buildGuiConfigFactory(config)
    };
};

export {
    buildEditorStateParams,
    buildGuiConfigFactory,
    configToGui
};
