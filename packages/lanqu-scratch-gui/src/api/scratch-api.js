/**
 * scratchApiHOC — registers window.scratch.* imperative API.
 *
 * Runs inside <Provider>. Captures the VM via the onVmInit prop, then binds all
 * easy-scratch3-style APIs. Reads redux state directly via the store passed in
 * (avoids importing react-redux, which would duplicate the instance bundled
 * inside scratch-gui's standalone dist).
 */
import React from 'react';
import bindAll from 'lodash.bindall';

import {
    setPlayer,
    setFullScreen,
    selectLocale,
    setProjectId,
    defaultProjectId
} from '@scratch/scratch-gui/standalone';

const getCloudProjectId = config => {
    const id = config.cloudData && config.cloudData.id;
    if (id == null || id === '') return '';
    const projectId = String(id);
    return projectId === defaultProjectId ? '' : projectId;
};

// An unsaved work gets its own cloud bucket. The session id is chosen by the
// browser and combined with the account name on the server, so two drafts of
// the same user never share variables. It is kept in localStorage so a reload
// of the same unsaved work keeps its values, while "new project" rotates it.
const DRAFT_SESSION_STORAGE_KEY = 'lanqu_scratch_draft_session';

const createDraftSession = () => {
    try {
        if (window.crypto && typeof window.crypto.getRandomValues === 'function') {
            const bytes = new Uint8Array(8);
            window.crypto.getRandomValues(bytes);
            let session = '';
            for (let i = 0; i < bytes.length; i++) {
                session += ('0' + bytes[i].toString(16)).slice(-2);
            }
            return session;
        }
    } catch (e) {
        // fall through to the non-crypto fallback
    }
    return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
};

const readDraftSession = key => {
    try {
        return window.localStorage.getItem(key) || '';
    } catch (e) {
        return '';
    }
};

const writeDraftSession = (key, value) => {
    try {
        window.localStorage.setItem(key, value);
    } catch (e) {
        // Storage may be unavailable (private mode, sandboxed iframe).
    }
};

const isDraftProjectId = projectId => (
    projectId === 'create' ||
    projectId.indexOf('create:') === 0 ||
    projectId.indexOf('draft:') === 0
);

const getCloudUsername = config => (
    (config.projectInfo && config.projectInfo.authorUsername) ||
    (config.session && config.session.username) ||
    (config.menuBar && config.menuBar.userAvatar && config.menuBar.userAvatar.username) ||
    'anonymous'
);

const isCloudEnabled = config => !!(config.cloudData && config.cloudData.enable);

const canWriteCloud = config => {
    const token = config.session && config.session.token;
    return !!(token && String(token).trim());
};

/**
 * Stable identity for a library asset. push*Library is a merge, so the same
 * asset pushed twice (for example on a retry or a second remote call) must not
 * appear twice in the drawer.
 */
const getAssetKey = asset => {
    if (!asset) return '';
    return asset.id || asset.assetId || `${asset.name || ''}|${asset.md5ext || ''}`;
};

const dedupeAssets = assets => {
    const seen = new Set();
    const result = [];
    for (const asset of assets) {
        const key = getAssetKey(asset);
        if (key && seen.has(key)) continue;
        if (key) seen.add(key);
        result.push(asset);
    }
    return result;
};

const scratchApiHOC = (config, store) => WrappedComponent => {
    class ScratchApiWrapper extends React.Component {
        constructor (props) {
            super(props);
            this.vm = null;
            this.draftSessionKey = `${DRAFT_SESSION_STORAGE_KEY}:${getCloudUsername(config)}`;
            this.draftSession = readDraftSession(this.draftSessionKey) || createDraftSession();
            writeDraftSession(this.draftSessionKey, this.draftSession);
            this.state = {
                cloudEnabled: isCloudEnabled(config),
                cloudProjectId: this.resolveCloudProjectId(getCloudProjectId(config)),
                cloudUsername: getCloudUsername(config),
                cloudWritable: canWriteCloud(config)
            };
            bindAll(this, ['handleVmInit', 'handleProjectLoaded']);
        }

        componentDidMount () {
            window.scratch = window.scratch || {};
            this.registerApi();
        }

        componentDidUpdate () {
            if (this.vm && !this._apiRegisteredWithVm) {
                this._apiRegisteredWithVm = true;
                this.registerVmApi();
            }
        }

        handleVmInit (vm) {
            this.vm = vm;
            window.vm = vm;
            this.registerVmApi();
            if (vm.runtime) {
                // PROJECT_LOADED fires for every project load, including direct
                // window.scratch.loadProject() calls (which do not update the
                // GUI's redux project state).
                vm.runtime.on('PROJECT_LOADED', this.handleProjectLoaded);
                // Fire handleDefaultProjectLoaded once the first project (the
                // default one) finishes loading — easy-scratch3 uses this hook
                // to load a workId/workFile project over the default.
                if (config.handleDefaultProjectLoaded) {
                    const onFirstLoad = () => {
                        vm.runtime.off('PROJECT_LOADED', onFirstLoad);
                        try { config.handleDefaultProjectLoaded(); } catch (e) { console.error(e); } // eslint-disable-line no-console
                    };
                    vm.runtime.on('PROJECT_LOADED', onFirstLoad);
                }
            }
            if (config.handleVmInitialized) config.handleVmInitialized(vm);
        }

        handleProjectLoaded () {
            const hiddenCategories = (config.blocks && config.blocks.hideCatagorys) || [];
            const hiddenBlocks = (config.blocks && config.blocks.hideBlocks) || [];
            // The initial toolbox is built before this config is known. Ask
            // blocks.jsx to regenerate it so hidden categories/blocks apply
            // without the host calling vm.emitWorkspaceUpdate() manually.
            if (this.vm && (hiddenCategories.length || hiddenBlocks.length)) {
                try {
                    this.vm.emitWorkspaceUpdate();
                } catch (e) {
                    console.warn('failed to refresh toolbox with hide config', e); // eslint-disable-line no-console
                }
            }
            if (config.projectInfo && config.projectInfo.projectName) {
                this.setProjectTitle(config.projectInfo.projectName);
            }
            if (config.handleProjectLoaded) {
                try { config.handleProjectLoaded(); } catch (e) { console.error(e); } // eslint-disable-line no-console
            }
        }

        // "create" means "the work that is not saved yet". The server derives
        // the bucket from the logged-in account, the session id only tells the
        // server which of that account's drafts is meant.
        resolveCloudProjectId (rawProjectId) {
            if (rawProjectId === 'create') return `create:${this.draftSession}`;
            return rawProjectId;
        }

        rotateDraftSession () {
            this.draftSession = createDraftSession();
            writeDraftSession(this.draftSessionKey, this.draftSession);
            return this.draftSession;
        }

        registerApi () {
            window.scratch._config = config;
            const dispatch = store.dispatch;
            // Merge Chinese translations for messages scratch-l10n's zh-cn pack
            // is missing (Settings menu and its sub-items). Dispatched as
            // UPDATE_LOCALES so the merged messagesByLocale takes effect.
            this.applyLocaleOverrides();
            // 暴露 store state 读取接口,供宿主页调试/观测播放器状态
            window.scratch.getState = () => store.getState();
            window.scratch.setPlayerOnly = isPlayerOnly => dispatch(setPlayer(isPlayerOnly));
            window.scratch.setFullScreen = isFullScreen => dispatch(setFullScreen(isFullScreen));
            window.scratch.setLocale = locale => dispatch(selectLocale(locale));
            // Trigger default project load (mirrors HashParserHOC's setProjectId('0')).
            // Without this the editor boots with an empty target list.
            dispatch(setProjectId(defaultProjectId));
        }

        applyLocaleOverrides () {
            // Chinese translations for messages scratch-l10n's zh-cn pack is
            // missing (mainly the Settings menu and sub-items). Merged into
            // messagesByLocale via UPDATE_LOCALES so react-intl picks them up.
            const zhOverrides = {
                'gui.menuBar.settings': '设置',
                'gui.aria.settingsMenu': '设置菜单',
                'gui.menuBar.theme': '主题',
                'gui.menuBar.colorMode': '色彩模式',
                'gui.blockTheme.default': '默认',
                'gui.blockTheme.catBlocks': '猫咪积木',
                'gui.theme.default': '默认',
                'gui.theme.dark': '深色',
                'gui.theme.highContrast': '高对比度',
                'gui.aria.languageMenu': '语言菜单',
                'gui.sharedMessages.loadFromComputerTitle': '从电脑中加载',
                // Default names for new sprites/costumes/backdrops. scratch-l10n's
                // zh-cn pack lacks gui.sharedMessages.sprite/costume/backdrop/pop, so
                // react-intl falls back to the English defaultMessage
                // (Sprite{index}/costume{index}/backdrop{index}) and the editor shows
                // "Sprite1"/"backdrop1" instead of "角色1"/"背景1".
                'gui.sharedMessages.sprite': '角色{index}',
                'gui.sharedMessages.costume': '造型{index}',
                'gui.sharedMessages.backdrop': '背景{index}',
                'gui.sharedMessages.pop': '啵',
                'gui.defaultProject.meow': '喵',
                'gui.defaultProject.variable': '我的变量'
            };
            try {
                const state = store.getState();
                const localesState = state.locales;
                if (!localesState) return;
                const mb = {...localesState.messagesByLocale};
                if (mb['zh-cn']) {
                    mb['zh-cn'] = {...mb['zh-cn'], ...zhOverrides};
                }
                store.dispatch({
                    type: 'scratch-gui/locales/UPDATE_LOCALES',
                    messagesByLocale: mb
                });
            } catch (e) {
                // non-fatal: falls back to default translations
            }
        }

        registerVmApi () {
            const vm = this.vm;
            window.scratch.loadProject = (url, callback) => {
                // Local-dev only: route storage CDN through /storage-cdn/ proxy to
                // avoid CORS. Skipped in production (non-localhost origins).
                // Matches http://, https://, and protocol-relative // storage.lanqu.vip.
                let proxied = url;
                if (typeof url === 'string' &&
                    /^(https?:)?\/\/storage\.lanqu\.vip/.test(url) &&
                    /^https?:\/\/(localhost|127\.0\.0\.1)/.test(location.href)) {
                    proxied = url.replace(/^(https?:)?\/\/storage\.lanqu\.vip/, '/storage-cdn');
                }
                fetch(proxied)
                    .then(response => {
                        if (!response.ok) {
                            throw new Error(
                                `failed to load project: HTTP ${response.status} ${response.statusText || ''}`.trim()
                            );
                        }
                        return response.blob();
                    })
                    .then(blob => {
                        const reader = new FileReader();
                        reader.onload = () => {
                            vm.loadProject(reader.result)
                                .then(() => callback && callback())
                                .catch(e => callback && callback(e));
                        };
                        reader.onerror = () => callback && callback(new Error('failed to read project file'));
                        reader.readAsArrayBuffer(blob);
                    })
                    .catch(e => callback && callback(e));
            };
            window.scratch.getProjectFile = callback => {
                vm.saveProjectSb3()
                    .then(res => callback && callback(res))
                    .catch(e => callback && callback(null, e));
            };
            window.scratch.getProjectCover = callback => {
                vm.postIOData('video', {forceTransparentPreview: true});
                vm.renderer.requestSnapshot(dataURI => {
                    vm.postIOData('video', {forceTransparentPreview: false});
                    callback && callback(dataURI);
                });
                vm.renderer.draw();
            };
            window.scratch.getProjectCoverBlob = callback => {
                vm.renderer.draw();
                vm.renderer.canvas.toBlob(blob => callback && callback(blob));
            };
            window.scratch.getProjectName = () => {
                const state = store.getState();
                return state.scratchGui?.projectTitle || state.scratchGui?.projectState?.projectId || '';
            };
            window.scratch.setProjectName = name => this.setProjectTitle(name);
            window.scratch.setEnableCouldData = enable => {
                if (!config.cloudData) return;
                config.cloudData.enable = !!enable;
                this.setState({cloudEnabled: !!enable});
            };
            window.scratch.setCloudId = id => {
                // Ignore empty / default project ids so a transient load cannot
                // disconnect a live cloud session.
                if (id == null || id === '') return;
                let projectId = String(id);
                if (projectId === defaultProjectId) return;
                if (projectId === 'create') {
                    // A new unsaved work must not reuse the previous draft's
                    // bucket, otherwise it inherits its variables and values.
                    this.rotateDraftSession();
                    projectId = this.resolveCloudProjectId('create');
                }
                if (!config.cloudData) config.cloudData = {};
                config.cloudData.id = projectId;
                this.setState({cloudProjectId: projectId});
            };
            // Lets a host restore the exact cloud project it had before, for
            // example when loading a local project file failed.
            window.scratch.getCloudId = () => this.state.cloudProjectId;
            window.scratch.setAuthorUsername = username => {
                if (!config.projectInfo) return;
                config.projectInfo.authorUsername = username == null ? '' : String(username);
                this.setState({cloudUsername: getCloudUsername(config)});
            };
            window.scratch.pushSpriteLibrary = data => this.pushAssets('sprites', data);
            window.scratch.pushCostumesLibrary = data => this.pushAssets('costumes', data);
            window.scratch.pushBackdropsLibrary = data => this.pushAssets('backdrops', data);
            window.scratch.pushSoundsLibrary = data => this.pushAssets('sounds', data);
        }

        pushAssets (type, data) {
            // setDynamicAssets is a full replace; merge with current state.
            const current = (store.getState().scratchGui && store.getState().scratchGui.dynamicAssets) || {};
            const merged = {
                sprites: current.sprites || [],
                costumes: current.costumes || [],
                backdrops: current.backdrops || [],
                sounds: current.sounds || []
            };
            merged[type] = dedupeAssets([...(merged[type] || []), ...(data || [])]);
            store.dispatch({
                type: 'scratch-gui/dynamic-assets/SET_DYNAMIC_ASSETS',
                dynamicAssets: merged
            });
        }

        setProjectTitle (name) {
            // The title input (ProjectTitleInput) reads redux
            // state.scratchGui.projectTitle, initialized by titled-hoc to a
            // localized default. scratch-vm has no renameProject, so dispatch
            // the reducer action directly; its type is defined in
            // @scratch/scratch-gui/src/reducers/project-title.js.
            store.dispatch({
                type: 'projectTitle/SET_PROJECT_TITLE',
                title: name == null ? '' : String(name)
            });
        }

        render () {
            const projectId = this.state.cloudProjectId;
            const isDraft = isDraftProjectId(projectId);
            const cloudControl = {
                // Draft buckets are per-user and require login; anonymous players
                // can still connect read-only to a saved work id.
                enabled: this.state.cloudEnabled && !!projectId &&
                    (this.state.cloudWritable || !isDraft),
                projectId,
                username: this.state.cloudUsername,
                // Lanqu saves projects through the host (canSave is false), but
                // cloud variables must still be writable in the editor.
                canModifyCloudData: true,
                canWrite: this.state.cloudWritable
            };
            return (
                <WrappedComponent
                    {...this.props}
                    cloudControl={cloudControl}
                    onVmInit={this.handleVmInit}
                />
            );
        }
    }

    return ScratchApiWrapper;
};

export {
    dedupeAssets,
    scratchApiHOC
};
