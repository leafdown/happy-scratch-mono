/**
 * Test double for @scratch/scratch-gui/standalone: exposes the same entry
 * points the wrapper consumes without loading the built editor bundle.
 */
class EditorState {
    constructor (params, guiConfigFactory) {
        this.params = params;
        this.guiConfig = guiConfigFactory ? guiConfigFactory() : undefined;
        this.store = {
            dispatch: jest.fn(),
            getState: jest.fn(() => ({
                scratchGui: {
                    dynamicAssets: {sprites: [], costumes: [], backdrops: [], sounds: []},
                    projectTitle: ''
                },
                locales: {messagesByLocale: {'zh-cn': {}}}
            }))
        };
    }
}

const createStandaloneRoot = jest.fn(() => ({
    render: jest.fn(),
    unmount: jest.fn()
}));

const setCustomLayout = jest.fn();
const buildDefaultProject = jest.fn(() => []);
const setPlayer = jest.fn(isPlayerOnly => ({type: 'scratch-gui/mode/SET_PLAYER', isPlayerOnly}));
const setFullScreen = jest.fn(isFullScreen => ({type: 'scratch-gui/mode/SET_FULL_SCREEN', isFullScreen}));
const selectLocale = jest.fn(locale => ({type: 'scratch-gui/locales/SELECT_LOCALE', locale}));
const setProjectId = jest.fn(projectId => ({type: 'scratch-gui/project-state/SET_PROJECT_ID', projectId}));

module.exports = {
    EditorState,
    buildDefaultProject,
    createStandaloneRoot,
    defaultProjectId: '0',
    selectLocale,
    setCustomLayout,
    setFullScreen,
    setPlayer,
    setProjectId
};
