/**
 * @jest-environment jsdom
 */
const React = require('react');
const {act} = React;
const {createRoot} = require('react-dom/client');
const {scratchApiHOC} = require('../src/api/scratch-api.js');
const {mergeConfig} = require('../src/config/default-config.js');

global.IS_REACT_ACT_ENVIRONMENT = true;

const createStore = () => {
    let state = {
        scratchGui: {
            dynamicAssets: {sprites: [], costumes: [], backdrops: [], sounds: []}
        },
        locales: {messagesByLocale: {}}
    };
    return {
        dispatch: jest.fn(action => {
            if (action.type === 'scratch-gui/dynamic-assets/SET_DYNAMIC_ASSETS') {
                state = {
                    ...state,
                    scratchGui: {...state.scratchGui, dynamicAssets: action.dynamicAssets}
                };
            }
            return action;
        }),
        getState: jest.fn(() => state)
    };
};

const createVm = () => {
    const listeners = {};
    return {
        emitWorkspaceUpdate: jest.fn(),
        on: jest.fn((event, fn) => { (listeners[event] = listeners[event] || []).push(fn); }),
        emit: jest.fn(event => (listeners[event] || []).forEach(fn => fn())),
        loadProject: jest.fn(() => Promise.resolve()),
        postIOData: jest.fn(),
        renderer: {},
        runtime: {on: jest.fn(), off: jest.fn()},
        saveProjectSb3: jest.fn(() => Promise.resolve(new Blob()))
    };
};

const flushPromises = () => new Promise(resolve => setTimeout(resolve, 0));

describe('scratchApiHOC', () => {
    const mounted = [];

    const mount = (hostConfig = {}) => {
        const config = mergeConfig(hostConfig);
        const store = createStore();
        let wrappedProps;
        const Dummy = props => {
            wrappedProps = props;
            return null;
        };
        const Wrapped = scratchApiHOC(config, store)(Dummy);
        const container = document.createElement('div');
        document.body.appendChild(container);
        const root = createRoot(container);
        act(() => root.render(React.createElement(Wrapped)));
        mounted.push({root, container});
        return {config, store, getProps: () => wrappedProps};
    };

    afterEach(() => {
        mounted.splice(0).forEach(({root, container}) => {
            act(() => root.unmount());
            container.remove();
        });
        delete global.fetch;
    });

    it('dispatches mode and locale changes to the same store', () => {
        const {store, getProps} = mount();
        act(() => getProps().onVmInit(createVm()));

        act(() => {
            window.scratch.setPlayerOnly(true);
            window.scratch.setFullScreen(true);
            window.scratch.setLocale('zh-cn');
            window.scratch.setProjectName('我的作品');
        });

        expect(store.dispatch).toHaveBeenCalledWith({
            type: 'scratch-gui/mode/SET_PLAYER',
            isPlayerOnly: true
        });
        expect(store.dispatch).toHaveBeenCalledWith({
            type: 'scratch-gui/mode/SET_FULL_SCREEN',
            isFullScreen: true
        });
        expect(store.dispatch).toHaveBeenCalledWith({
            type: 'scratch-gui/locales/SELECT_LOCALE',
            locale: 'zh-cn'
        });
        expect(store.dispatch).toHaveBeenCalledWith({
            type: 'projectTitle/SET_PROJECT_TITLE',
            title: '我的作品'
        });
    });

    it('merges and dedupes pushed library assets', () => {
        const {store, getProps} = mount();
        act(() => getProps().onVmInit(createVm()));

        act(() => {
            window.scratch.pushSpriteLibrary([
                {id: 'sprite-a', name: 'A'},
                {id: 'sprite-a', name: 'A again'}
            ]);
        });
        let action = store.dispatch.mock.calls[store.dispatch.mock.calls.length - 1][0];
        expect(action.type).toBe('scratch-gui/dynamic-assets/SET_DYNAMIC_ASSETS');
        expect(action.dynamicAssets.sprites).toEqual([{id: 'sprite-a', name: 'A'}]);

        act(() => {
            window.scratch.pushCostumesLibrary([{id: 'costume-a'}, {id: 'costume-a'}]);
        });
        action = store.dispatch.mock.calls[store.dispatch.mock.calls.length - 1][0];
        expect(action.dynamicAssets.sprites).toHaveLength(1);
        expect(action.dynamicAssets.costumes).toEqual([{id: 'costume-a'}]);
    });

    it('tracks project edits and resets the dirty flag on load', () => {
        const handleProjectChanged = jest.fn();
        const {getProps} = mount({handleProjectChanged});
        const vm = createVm();
        act(() => getProps().onVmInit(vm));

        // A brand-new project is not dirty until the first edit.
        expect(window.scratch.isDirty()).toBe(false);

        // VM report of an edit marks dirty + notifies the host.
        act(() => vm.emit('PROJECT_CHANGED'));
        expect(window.scratch.isDirty()).toBe(true);
        expect(handleProjectChanged).toHaveBeenCalledWith(true);

        // markSaved clears the flag and tells the host.
        act(() => window.scratch.markSaved());
        expect(window.scratch.isDirty()).toBe(false);
        expect(handleProjectChanged).toHaveBeenCalledWith(false);

        // A project reload resets the dirty flag (resetDirty is registered on
        // PROJECT_LOADED alongside handleProjectLoaded and the optional
        // handleDefaultProjectLoaded hook; firing all of them is equivalent to
        // the VM's load sequence and resets dirty).
        act(() => vm.emit('PROJECT_CHANGED'));
        expect(window.scratch.isDirty()).toBe(true);
        const loaded = vm.runtime.on.mock.calls
            .filter(([event]) => event === 'PROJECT_LOADED')
            .map(([, fn]) => fn);
        act(() => loaded.forEach(fn => fn()));
        expect(window.scratch.isDirty()).toBe(false);
    });

    it('reports loadProject HTTP failures to the callback', async () => {
        const {getProps} = mount();
        const vm = createVm();
        act(() => getProps().onVmInit(vm));

        global.fetch = jest.fn(() => Promise.resolve({
            ok: false,
            status: 404,
            statusText: 'Not Found'
        }));
        const callback = jest.fn();
        window.scratch.loadProject('https://example.com/missing.sb3', callback);
        await flushPromises();

        expect(callback).toHaveBeenCalledTimes(1);
        expect(callback.mock.calls[0][0]).toBeInstanceOf(Error);
        expect(callback.mock.calls[0][0].message).toContain('HTTP 404');
        expect(vm.loadProject).not.toHaveBeenCalled();
    });

    it('reports getProjectFile failures as the second callback argument', async () => {
        const {getProps} = mount();
        const vm = createVm();
        vm.saveProjectSb3.mockImplementation(() => Promise.reject(new Error('save failed')));
        act(() => getProps().onVmInit(vm));

        const callback = jest.fn();
        window.scratch.getProjectFile(callback);
        await flushPromises();

        expect(callback).toHaveBeenCalledWith(null, expect.objectContaining({message: 'save failed'}));
    });

    it('applies project metadata and toolbox config after a project loads', () => {
        const handleProjectLoaded = jest.fn();
        const {store, getProps} = mount({
            blocks: {hideCatagorys: ['motion']},
            projectInfo: {projectName: '作业名'},
            handleProjectLoaded
        });
        const vm = createVm();
        act(() => getProps().onVmInit(vm));

        const listener = vm.runtime.on.mock.calls.find(([event]) => event === 'PROJECT_LOADED')[1];
        act(() => listener());

        expect(vm.emitWorkspaceUpdate).toHaveBeenCalledTimes(1);
        expect(handleProjectLoaded).toHaveBeenCalledTimes(1);
        expect(store.dispatch).toHaveBeenCalledWith({
            type: 'projectTitle/SET_PROJECT_TITLE',
            title: '作业名'
        });
    });
});
