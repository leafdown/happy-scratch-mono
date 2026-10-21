/**
 * @jest-environment jsdom
 */
const React = require('react');
const {act} = React;
const {createRoot} = require('react-dom/client');
const {EasyScratch} = require('../src/index.js');
const {createStandaloneRoot} = require('@scratch/scratch-gui/standalone');

global.IS_REACT_ACT_ENVIRONMENT = true;

describe('EasyScratch', () => {
    let container;
    let reactRoot;
    let fakeRoot;

    beforeEach(() => {
        jest.clearAllMocks();
        fakeRoot = {render: jest.fn(), unmount: jest.fn()};
        createStandaloneRoot.mockReturnValue(fakeRoot);
        container = document.createElement('div');
        document.body.appendChild(container);
        reactRoot = createRoot(container);
    });

    afterEach(() => {
        act(() => reactRoot.unmount());
        document.body.removeChild(container);
    });

    const render = element => act(() => reactRoot.render(element));

    it('mounts the editor into its own container and forwards editor props', () => {
        const ref = React.createRef();
        render(React.createElement(EasyScratch, {
            ref,
            scratchConfig: {logo: {show: false}},
            className: 'easy-scratch',
            style: {height: '50vh'},
            intl: 'intl-object'
        }));

        expect(createStandaloneRoot).toHaveBeenCalledTimes(1);
        const [state, mountNode] = createStandaloneRoot.mock.calls[0];
        expect(state.params).toEqual({locale: 'en', isPlayerOnly: false, isFullScreen: false});
        expect(container.contains(mountNode)).toBe(true);
        expect(mountNode.className).toBe('easy-scratch');
        expect(mountNode.style.height).toBe('50vh');
        expect(mountNode.style.width).toBe('100%');

        // buildPatchProps is applied before the editor render, and config-only
        // props are not forwarded to the editor root.
        expect(fakeRoot.render).toHaveBeenCalledTimes(1);
        const editorProps = fakeRoot.render.mock.calls[0][0];
        expect(editorProps.intl).toBe('intl-object');
        expect(editorProps.showLogo).toBe(false);
        expect(editorProps.canSave).toBe(false);
        expect(editorProps.scratchConfig).toBeUndefined();
        expect(editorProps.className).toBeUndefined();
        expect(editorProps.style).toBeUndefined();

        expect(ref.current.getRoot().config.logo.show).toBe(false);
        expect(ref.current.getRoot().store).toBe(state.store);
    });

    it('folds the isPlayerOnly prop into the boot config', () => {
        render(React.createElement(EasyScratch, {
            scratchConfig: {menuBar: {languageButton: {defaultLanguage: 'zh-cn'}}},
            isPlayerOnly: true
        }));

        const [state] = createStandaloneRoot.mock.calls[0];
        expect(state.params).toEqual({locale: 'zh-cn', isPlayerOnly: true, isFullScreen: false});
    });

    it('skips redundant editor renders and forwards changed props', () => {
        const config = {logo: {url: '//cdn/logo.png'}};
        render(React.createElement(EasyScratch, {scratchConfig: config, intl: 'one'}));
        expect(fakeRoot.render).toHaveBeenCalledTimes(1);

        render(React.createElement(EasyScratch, {scratchConfig: config, intl: 'one'}));
        expect(fakeRoot.render).toHaveBeenCalledTimes(1);

        render(React.createElement(EasyScratch, {scratchConfig: config, intl: 'two'}));
        expect(fakeRoot.render).toHaveBeenCalledTimes(2);
        expect(fakeRoot.render.mock.calls[1][0].intl).toBe('two');
    });

    it('unmounts the editor when the component unmounts', () => {
        render(React.createElement(EasyScratch, {scratchConfig: {}}));
        expect(fakeRoot.unmount).not.toHaveBeenCalled();

        act(() => reactRoot.unmount());
        expect(fakeRoot.unmount).toHaveBeenCalledTimes(1);

        // afterEach unmounts again; recreate so its cleanup does not double-call
        reactRoot = createRoot(container);
    });
});
