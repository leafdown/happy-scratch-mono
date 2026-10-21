const {buildPatchProps} = require('../src/index.js');
const {mergeConfig} = require('../src/config/default-config.js');

describe('buildPatchProps', () => {
    describe('defaults', () => {
        const props = buildPatchProps(mergeConfig({}));

        it('keeps title editing and disables the built-in server save', () => {
            expect(props.canEditTitle).toBe(true);
            expect(props.canSave).toBe(false);
        });

        it('shows every menu entry that the GUI supports natively', () => {
            expect(props.showLogo).toBe(true);
            expect(props.showNewButton).toBe(true);
            expect(props.showLoadButton).toBe(true);
            expect(props.showSaveButton).toBe(true);
            expect(props.showTurboModeButton).toBe(true);
            expect(props.showTutorialsButton).toBe(true);
            expect(props.showDebugButton).toBe(false);
            expect(props.canChangeLanguage).toBe(true);
        });

        it('passes stage visibility flags', () => {
            expect(props.controlsConfig.showStartButton).toBe(true);
            expect(props.controlsConfig.showStopButton).toBe(true);
            expect(props.stageHeaderConfig.showFullscreenButton).toBe(true);
        });

        it('applies the default block scale and no hidden blocks', () => {
            expect(props.blocksOptions).toEqual({zoom: {startScale: 0.675}});
            expect(props.blocksHideConfig).toBeUndefined();
        });

        it('does not depend on GUI project-state events for handleProjectLoaded', () => {
            expect(props.onProjectLoaded).toBeUndefined();
        });

        it('does not set an asset host when none is configured', () => {
            expect(props.assetHost).toBeUndefined();
        });
    });

    describe('host overrides', () => {
        const beforeNew = jest.fn(() => true);
        const beforeLoad = jest.fn(() => true);
        const afterLoad = jest.fn();
        const failureLoad = jest.fn();
        const beforeSave = jest.fn(() => true);
        const beforeHelp = jest.fn(() => true);
        const onAvatarClick = jest.fn();
        const onLogoClick = jest.fn();
        const beforeStart = jest.fn(() => true);
        const beforeStop = jest.fn(() => true);
        const beforeFull = jest.fn(() => true);
        const beforeUnFull = jest.fn(() => true);

        const config = mergeConfig({
            assets: {assetHost: '//storage.lanqu.vip'},
            menuBar: {
                style: {background: '#123456'},
                customButtons: [{title: '提交'}],
                languageButton: {show: false},
                newButton: {show: false, handleBefore: beforeNew},
                loadFileButton: {
                    show: false,
                    handleBefore: beforeLoad,
                    handleAfter: afterLoad,
                    handleFailure: failureLoad
                },
                saveFileButton: {show: false, handleBefore: beforeSave},
                turboModeButton: {show: false},
                helpButton: {show: false, handleBefore: beforeHelp},
                debugButton: {show: true},
                myStuff: {show: true, url: 'https://example.com/mystuff'},
                userAvatar: {avatar: '//cdn/avatar.png', handleClick: onAvatarClick}
            },
            logo: {show: false, url: '//cdn/logo.png', handleClickLogo: onLogoClick},
            blocks: {scale: 0.9, hideCatagorys: ['motion'], hideBlocks: ['motion_move']},
            stageArea: {
                startButton: {show: false, handleBeforeStart: beforeStart},
                stopButton: {show: false, handleBeforeStop: beforeStop},
                fullscreenButton: {
                    show: false,
                    handleBeforeSetStageFull: beforeFull,
                    handleBeforeSetStageUnFull: beforeUnFull
                }
            },
            backpack: {enable: true, api: 'https://backpack.example.com'},
            cloudData: {api: '//example.com/cloud'}
        });
        const props = buildPatchProps(config);

        it('maps the file menu visibility and hooks', () => {
            expect(props.showNewButton).toBe(false);
            expect(props.showLoadButton).toBe(false);
            expect(props.showSaveButton).toBe(false);
            expect(props.onBeforeNewProject).toBe(beforeNew);
            expect(props.onBeforeProjectUpload).toBe(beforeLoad);
            expect(props.onAfterProjectUpload).toBe(afterLoad);
            expect(props.onProjectUploadFailed).toBe(failureLoad);
            expect(props.onBeforeSaveToComputer).toBe(beforeSave);
        });

        it('maps the remaining menu bar fields', () => {
            expect(props.showTurboModeButton).toBe(false);
            expect(props.showTutorialsButton).toBe(false);
            expect(props.onBeforeHelp).toBe(beforeHelp);
            expect(props.showDebugButton).toBe(true);
            expect(props.canChangeLanguage).toBe(false);
            expect(props.customButtons).toEqual([{title: '提交'}]);
            expect(props.menuBarStyle).toEqual({background: '#123456'});
        });

        it('maps the logo fields', () => {
            expect(props.showLogo).toBe(false);
            expect(props.logo).toBe('//cdn/logo.png');
            expect(props.onClickLogo).toBe(onLogoClick);
        });

        it('maps the account menu and avatar click', () => {
            expect(props.accountMenuOptions).toEqual({
                canHaveSession: true,
                avatarUrl: '//cdn/avatar.png',
                myStuffUrl: 'https://example.com/mystuff',
                accountSettingsUrl: '/account/settings/BaseSetting',
                onClick: onAvatarClick
            });
        });

        it('falls back to projectInfo.authorAvatar when the avatar is not set', () => {
            const fallback = buildPatchProps(mergeConfig({
                menuBar: {userAvatar: {avatar: ''}},
                projectInfo: {authorAvatar: '//cdn/author.png'}
            }));
            expect(fallback.accountMenuOptions.avatarUrl).toBe('//cdn/author.png');
        });

        it('omits the avatar click handler when not configured', () => {
            const plain = buildPatchProps(mergeConfig({}));
            expect(plain.accountMenuOptions.onClick).toBeUndefined();
        });

        it('maps blocks scale and hidden blocks', () => {
            expect(props.blocksOptions).toEqual({zoom: {startScale: 0.9}});
            expect(props.blocksHideConfig).toEqual({
                categories: ['motion'],
                blocks: ['motion_move']
            });
        });

        it('maps stage button visibility and hooks', () => {
            expect(props.controlsConfig).toEqual({
                showStartButton: false,
                showStopButton: false,
                onBeforeStart: beforeStart,
                onBeforeStop: beforeStop
            });
            expect(props.stageHeaderConfig).toEqual({
                showFullscreenButton: false,
                onBeforeSetStageFull: beforeFull,
                onBeforeSetStageUnFull: beforeUnFull
            });
        });

        it('maps asset host, backpack, and cloud host', () => {
            expect(props.assetHost).toBe('//storage.lanqu.vip');
            expect(props.backpackVisible).toBe(true);
            expect(props.backpackConfigured).toBe(true);
            expect(props.backpackHost).toBe('https://backpack.example.com');
            expect(props.cloudHost).toBe('//example.com/cloud');
            expect(props.hasCloudPermission).toBe(true);
        });
    });

    it('keeps unrelated host props and still enforces wrapper defaults', () => {
        const props = buildPatchProps(mergeConfig({}), {
            locale: 'zh-cn',
            canSave: true,
            canEditTitle: false
        });
        expect(props.locale).toBe('zh-cn');
        expect(props.canSave).toBe(false);
        expect(props.canEditTitle).toBe(true);
    });
});
