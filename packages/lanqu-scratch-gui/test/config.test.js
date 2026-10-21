const {defaultConfig, mergeConfig} = require('../src/config/default-config.js');
const {buildEditorStateParams} = require('../src/config/config-to-gui.js');

describe('defaultConfig', () => {
    it('does not advertise configuration that the wrapper does not implement', () => {
        // These easy-scratch3 fields were removed rather than left as no-ops.
        expect(defaultConfig).not.toHaveProperty('defaultProjectURL');
        expect(defaultConfig.assets).not.toHaveProperty('defaultIndex');
        expect(defaultConfig.assets).not.toHaveProperty('handleBeforeSpriteLibraryOpen');
        expect(defaultConfig.assets).not.toHaveProperty('handleBeforeCostumesLibraryOpen');
        expect(defaultConfig.assets).not.toHaveProperty('handleBeforeBackdropsLibraryOpen');
        expect(defaultConfig.assets).not.toHaveProperty('handleBeforeSoundLibraryOpen');
    });
});

describe('mergeConfig', () => {
    it('returns the defaults when the host config is empty', () => {
        expect(mergeConfig({})).toEqual(defaultConfig);
        expect(mergeConfig()).toEqual(defaultConfig);
    });

    it('deep-merges nested objects and keeps sibling defaults', () => {
        const merged = mergeConfig({menuBar: {languageButton: {show: false}}});
        expect(merged.menuBar.languageButton.show).toBe(false);
        expect(merged.menuBar.languageButton.defaultLanguage).toBe('en');
        expect(merged.menuBar.helpButton.show).toBe(true);
    });

    it('replaces arrays instead of concatenating them', () => {
        const merged = mergeConfig({blocks: {hideCatagorys: ['motion', 'looks']}});
        expect(merged.blocks.hideCatagorys).toEqual(['motion', 'looks']);
        expect(merged.blocks.scale).toBe(defaultConfig.blocks.scale);
    });

    it('keeps host functions by identity', () => {
        const handleClickLogo = () => false;
        const merged = mergeConfig({logo: {handleClickLogo}});
        expect(merged.logo.handleClickLogo).toBe(handleClickLogo);
    });

    it('ignores undefined values so omitted fields keep their defaults', () => {
        const merged = mergeConfig({logo: {url: undefined, show: false}});
        expect(merged.logo.url).toBe(defaultConfig.logo.url);
        expect(merged.logo.show).toBe(false);
    });

    it('does not mutate the defaults', () => {
        const snapshot = JSON.stringify(defaultConfig);
        mergeConfig({assets: {assetHost: '//storage.lanqu.vip'}, blocks: {hideBlocks: ['motion_move']}});
        expect(JSON.stringify(defaultConfig)).toBe(snapshot);
    });

    it('does not mutate the host config', () => {
        const hostConfig = {menuBar: {userAvatar: {avatar: '//cdn/avatar.png'}}};
        const merged = mergeConfig(hostConfig);
        merged.menuBar.userAvatar.avatar = '//changed';
        expect(hostConfig.menuBar.userAvatar.avatar).toBe('//cdn/avatar.png');
    });
});

describe('buildEditorStateParams', () => {
    it('uses the configured language and player mode', () => {
        expect(buildEditorStateParams(mergeConfig({}))).toEqual({
            locale: 'en',
            isPlayerOnly: false,
            isFullScreen: false
        });
        expect(buildEditorStateParams(mergeConfig({
            menuBar: {languageButton: {defaultLanguage: 'zh-cn'}},
            isPlayerOnly: true
        }))).toEqual({
            locale: 'zh-cn',
            isPlayerOnly: true,
            isFullScreen: false
        });
    });
});
