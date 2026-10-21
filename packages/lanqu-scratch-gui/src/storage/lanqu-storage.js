/**
 * Lanqu storage adapter implementing scratch-gui's GUIStorage interface.
 *
 * Wraps a ScratchStorage instance and wires up backpack/cloud adapters based on
 * scratchConfig. Adapters are only created when the corresponding feature is
 * enabled in config.
 *
 * Web store registration mirrors scratch-gui's LegacyStorage
 * (packages/scratch-gui/src/lib/legacy-storage.ts). Stage 2 will refine asset/project
 * host configuration; stage 1 just needs a working storage so the editor renders.
 */
import {ScratchStorage} from '@scratch/scratch-storage';
import {buildDefaultProject} from '@scratch/scratch-gui/standalone';
import {LanquBackpackStorage} from './lanqu-backpack-storage.js';
import {LanquCloudProvider} from './lanqu-cloud-provider.js';

const createLanquStorage = config => {
    const scratchStorage = new ScratchStorage();
    // Hosts are mutable (set via GUIStorage setters); web store configs read them via refs.
    const projectHostRef = {value: 'https://projects.scratch.mit.edu'};
    const projectTokenRef = {value: null};
    const assetHostRef = {value: (config.assets && config.assets.assetHost) || 'https://assets.scratch.mit.edu'};

    const getProjectGetConfig = projectAsset => {
        const path = `${projectHostRef.value}/${projectAsset.assetId}`;
        return projectTokenRef.value ? `${path}?token=${projectTokenRef.value}` : path;
    };
    const getProjectCreateConfig = () => ({url: `${projectHostRef.value}/`, withCredentials: true});
    const getProjectUpdateConfig = projectAsset => ({url: `${projectHostRef.value}/${projectAsset.assetId}`, withCredentials: true});
    const buildAssetGetUrl = (assetId, dataFormat) => {
        // The MIT CDN (assets.scratch.mit.edu and its cdn. variant) expects a
        // /get/ suffix. Lanqu-style asset hosts (for example storage.lanqu.vip)
        // serve /internalapi/asset/<id>.<ext> directly.
        const suffix = assetHostRef.value.includes('assets.scratch.mit.edu') ? '/get/' : '';
        return `${assetHostRef.value}/internalapi/asset/${assetId}.${dataFormat}${suffix}`;
    };
    const getAssetGetConfig = asset => buildAssetGetUrl(asset.assetId, asset.dataFormat);
    const getAssetCreateConfig = asset => ({
        method: 'post',
        url: `${assetHostRef.value}/${asset.assetId}.${asset.dataFormat}`,
        withCredentials: true
    });

    scratchStorage.addWebStore(
        [scratchStorage.AssetType.Project],
        getProjectGetConfig,
        getProjectCreateConfig,
        getProjectUpdateConfig
    );
    scratchStorage.addWebStore(
        [scratchStorage.AssetType.ImageVector, scratchStorage.AssetType.ImageBitmap, scratchStorage.AssetType.Sound],
        getAssetGetConfig,
        getAssetCreateConfig,
        getAssetCreateConfig
    );
    scratchStorage.addWebStore(
        [scratchStorage.AssetType.Sound],
        asset => `static/extension-assets/scratch3_music/${asset.assetId}.${asset.dataFormat}`
    );

    // Cache the default project assets into the builtin helper so that
    // storage.load(Project, '0') resolves the default project (mirrors
    // LegacyStorage.cacheDefaultProject). Without this the editor boots with
    // an empty target list.
    const defaultProjectAssets = buildDefaultProject();
    defaultProjectAssets.forEach(asset => scratchStorage.builtinHelper._store(
        scratchStorage.AssetType[asset.assetType],
        scratchStorage.DataFormat[asset.dataFormat],
        asset.data,
        asset.id
    ));

    const backpackStorage = config.backpack && config.backpack.enable
        ? new LanquBackpackStorage({
            host: config.backpack.api,
            session: {
                username: config.session && config.session.username,
                token: config.session && config.session.token
            }
        })
        : undefined;

    // Keep the provider factory available even when cloud data starts disabled.
    // The GUI can enable it at runtime through setEnableCouldData.
    const cloudVariables = {
        createProvider: (cloudHost, vm, username, projectId) => new LanquCloudProvider({
            cloudHost: cloudHost || (config.cloudData && config.cloudData.api),
            vm,
            username,
            projectId,
            token: config.session && config.session.token,
            cloudId: config.cloudData && config.cloudData.id
        })
    };

    return {
        scratchStorage,
        backpackStorage,
        cloudVariables,

        setProjectHost: host => { projectHostRef.value = host; },
        setProjectToken: token => { projectTokenRef.value = token; },
        setProjectMetadata: () => {},
        setAssetHost: host => {
            // project-fetcher-hoc mounts with its MIT default and calls
            // setAssetHost; ignore those so a configured host is not lost.
            if (host && !host.includes('assets.scratch.mit.edu')) {
                assetHostRef.value = host;
            }
        },
        setTranslatorFunction: () => {},
        setBackpackHost: host => {
            if (backpackStorage) backpackStorage.setHost(host);
        },
        // 库缩略图地址:library 组件会优先调用此方法(scratch-gui library.jsx 的 getLibraryAssetUrl)
        getLibraryAssetUrl: buildAssetGetUrl,

        // easy-scratch3 uses local export (getProjectFile) rather than server save.
        saveProject: async () => ({id: null}),
        saveProjectThumbnail: () => {}
    };
};

export {
    createLanquStorage
};
