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
    isPlayerOnly: false,
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
