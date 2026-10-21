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
import {ScratchStorage} from 'scratch-storage';
import {buildDefaultProject} from '@scratch/scratch-gui/standalone';
import {LanquBackpackStorage} from './lanqu-backpack-storage.js';
import {LanquCloudProvider} from './lanqu-cloud-provider.js';

const createLanquStorage = config => {
    if (typeof console !== 'undefined') console.log('[storage] assetHost:', config.assets && config.assets.assetHost, 'fallback:', !config.assets || !config.assets.assetHost);
    const scratchStorage = new ScratchStorage();
    // Hosts are mutable (set via GUIStorage setters); web store configs read them via refs.
    const projectHostRef = {value: 'https://projects.scratch.mit.edu'};
    const projectTokenRef = {value: null};
    const assetHostRef = {value: (config.assets && config.assets.assetHost) || 'https://assets.scratch.mit.edu'};
    // setAssetHost 防 MIT 覆盖
    function safeSetAssetHost(host) {
        if (host && !host.includes('assets.scratch.mit.edu') && !host.includes('cdn.assets.scratch.mit.edu')) {
            assetHostRef.value = host;
        }
    }

    const getProjectGetConfig = projectAsset => {
        const path = `${projectHostRef.value}/${projectAsset.assetId}`;
        return projectTokenRef.value ? `${path}?token=${projectTokenRef.value}` : path;
    };
    const getProjectCreateConfig = () => ({url: `${projectHostRef.value}/`, withCredentials: true});
    const getProjectUpdateConfig = projectAsset => ({url: `${projectHostRef.value}/${projectAsset.assetId}`, withCredentials: true});
    const buildAssetGetUrl = (assetId, dataFormat) => {
        // 自定义 assetHost(如 storage.lanqu.vip)不走 /get/ 后缀
        // MIT 官方 CDN 才加 /get/ (https://assets.scratch.mit.edu)
        const suffix = assetHostRef.value === 'https://assets.scratch.mit.edu' ? '/get/' : '';
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

    // 强制重写 scratchStorage 内部已注册的 asset web store 的 getAssetGetConfig
    // 因为 project-fetcher-hoc 挂载后会用 defaultProps(MIT) 调用 setAssetHost 覆盖,
    // 且 scratch-gui 打包时内部引用的 ScratchStorage 可能与 lanqu 的不同实例。
    // 通过在 addWebStore 完成后直接篡改内部 store 的 getConfig 来兜底。
    if (scratchStorage._webStores) {
        const assetTypes = [scratchStorage.AssetType.ImageVector, scratchStorage.AssetType.ImageBitmap, scratchStorage.AssetType.Sound];
        for (const webStore of scratchStorage._webStores) {
            if (webStore.assetTypes && assetTypes.some(t => webStore.assetTypes.includes(t))) {
                const originalGetConfig = webStore.getConfig;
                webStore.getConfig = (asset) => {
                    const cfg = originalGetConfig(asset);
                    if (typeof cfg === 'string' && cfg.includes('assets.scratch.mit.edu')) {
                        return cfg.replace('https://assets.scratch.mit.edu', assetHostRef.value)
                                   .replace('/get/', '');
                    }
                    return cfg;
                };
            }
        }
    }

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
            // project-fetcher-hoc 挂载时用 defaultProps(MIT)覆盖,忽略 MIT 地址
            if (host && !host.includes('assets.scratch.mit.edu') && !host.includes('cdn.assets.scratch.mit.edu')) {
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
