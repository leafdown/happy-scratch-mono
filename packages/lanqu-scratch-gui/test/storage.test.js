const {buildDefaultProject} = require('@scratch/scratch-gui/standalone');
const {createLanquStorage} = require('../src/storage/lanqu-storage.js');

describe('createLanquStorage', () => {
    beforeEach(() => {
        buildDefaultProject.mockReset();
        buildDefaultProject.mockReturnValue([]);
    });

    it('registers project, asset, and sound web stores', () => {
        const storage = createLanquStorage({assets: {}});
        const {addWebStore} = storage.scratchStorage;

        expect(addWebStore).toHaveBeenCalledTimes(3);
        expect(addWebStore.mock.calls[0][0]).toEqual(['Project']);
        expect(addWebStore.mock.calls[1][0]).toEqual(['ImageVector', 'ImageBitmap', 'Sound']);
        expect(addWebStore.mock.calls[2][0]).toEqual(['Sound']);
    });

    it('builds project URLs from the project host and token', () => {
        const storage = createLanquStorage({assets: {}});
        const getProjectConfig = storage.scratchStorage.addWebStore.mock.calls[0][1];

        expect(getProjectConfig({assetId: 'abc'})).toBe('https://projects.scratch.mit.edu/abc');

        storage.setProjectHost('//projects.lanqu.vip');
        storage.setProjectToken('token-1');
        expect(getProjectConfig({assetId: 'abc'})).toBe('//projects.lanqu.vip/abc?token=token-1');
    });

    it('uses /get/ only for the official MIT asset CDN', () => {
        const defaultHost = createLanquStorage({assets: {}});
        expect(defaultHost.getLibraryAssetUrl('abc', 'svg')).toBe(
            'https://assets.scratch.mit.edu/internalapi/asset/abc.svg/get/'
        );

        const cdnHost = createLanquStorage({assets: {assetHost: 'https://cdn.assets.scratch.mit.edu'}});
        expect(cdnHost.getLibraryAssetUrl('abc', 'svg')).toBe(
            'https://cdn.assets.scratch.mit.edu/internalapi/asset/abc.svg/get/'
        );

        const customHost = createLanquStorage({assets: {assetHost: '//storage.lanqu.vip'}});
        expect(customHost.getLibraryAssetUrl('abc', 'svg')).toBe(
            '//storage.lanqu.vip/internalapi/asset/abc.svg'
        );
    });

    it('ignores MIT asset hosts sent by GUI defaults but accepts real overrides', () => {
        const storage = createLanquStorage({assets: {assetHost: '//storage.lanqu.vip'}});

        storage.setAssetHost('https://assets.scratch.mit.edu');
        expect(storage.getLibraryAssetUrl('abc', 'png')).toBe(
            '//storage.lanqu.vip/internalapi/asset/abc.png'
        );
        storage.setAssetHost('https://cdn.assets.scratch.mit.edu');
        expect(storage.getLibraryAssetUrl('abc', 'png')).toBe(
            '//storage.lanqu.vip/internalapi/asset/abc.png'
        );

        storage.setAssetHost('//cdn.lanqu.vip');
        expect(storage.getLibraryAssetUrl('abc', 'png')).toBe(
            '//cdn.lanqu.vip/internalapi/asset/abc.png'
        );
    });

    it('resolves extension sounds from the editor static assets', () => {
        const storage = createLanquStorage({assets: {}});
        const getSoundConfig = storage.scratchStorage.addWebStore.mock.calls[2][1];
        expect(getSoundConfig({assetId: 'kick', dataFormat: 'wav'})).toBe(
            'static/extension-assets/scratch3_music/kick.wav'
        );
    });

    it('caches the default project in the builtin helper', () => {
        buildDefaultProject.mockReturnValueOnce([
            {assetType: 'Project', dataFormat: 'JSON', data: 'project-data', id: '0'}
        ]);
        const storage = createLanquStorage({assets: {}});
        expect(storage.scratchStorage.builtinHelper._store).toHaveBeenCalledWith(
            'Project', 'json', 'project-data', '0'
        );
    });

    it('creates a backpack only when enabled', () => {
        expect(createLanquStorage({assets: {}}).backpackStorage).toBeUndefined();

        const enabled = createLanquStorage({
            assets: {},
            backpack: {enable: true, api: '//backpack.lanqu.vip'}
        });
        expect(typeof enabled.backpackStorage.list).toBe('function');
        expect(typeof enabled.backpackStorage.save).toBe('function');
        expect(typeof enabled.backpackStorage.delete).toBe('function');
    });

    it('exposes a lazy cloud provider factory even when cloud data is disabled', () => {
        const storage = createLanquStorage({assets: {}, cloudData: {enable: false, id: 'create'}});
        expect(typeof storage.cloudVariables.createProvider).toBe('function');
    });

    it('reports no server-side project id (the host owns saving)', async () => {
        const storage = createLanquStorage({assets: {}});
        await expect(storage.saveProject()).resolves.toEqual({id: null});
    });
});
