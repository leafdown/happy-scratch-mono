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

const scratchApiHOC = (config, store) => WrappedComponent => {
    class ScratchApiWrapper extends React.Component {
        constructor (props) {
            super(props);
            this.vm = null;
            bindAll(this, ['handleVmInit']);
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
            // hideCatagorys/hideBlocks take effect when blocks.jsx regenerates
            // the toolbox (on target switch / project load). Hosts can force a
            // refresh via window.vm.emitWorkspaceUpdate() once the VM is ready.
            this.registerVmApi();
            // Fire handleDefaultProjectLoaded once the first project (the default
            // one) finishes loading — easy-scratch3 uses this hook to load a
            // workId/workFile project over the default.
            if (config.handleDefaultProjectLoaded && vm.runtime) {
                const onFirstLoad = () => {
                    vm.runtime.off('PROJECT_LOADED', onFirstLoad);
                    try { config.handleDefaultProjectLoaded(); } catch (e) { console.error(e); } // eslint-disable-line no-console
                };
                vm.runtime.on('PROJECT_LOADED', onFirstLoad);
            }
            if (config.handleVmInitialized) config.handleVmInitialized(vm);
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
                    .then(r => r.blob())
                    .then(blob => {
                        const reader = new FileReader();
                        reader.onload = () => {
                            vm.loadProject(reader.result)
                                .then(() => callback && callback())
                                .catch(e => callback && callback(e));
                        };
                        reader.readAsArrayBuffer(blob);
                    })
                    .catch(e => callback && callback(e));
            };
            window.scratch.getProjectFile = callback => {
                vm.saveProjectSb3().then(res => callback && callback(res));
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
            window.scratch.setProjectName = name => {
                // 标题输入框(ProjectTitleInput)绑定 redux state.scratchGui.projectTitle,
                // 由 titled-hoc 初始化为本地化默认标题(zh-cn 下是"Scratch作品")。
                // scratch-vm 没有 renameProject(旧实现调用它是静默 no-op,标题永远
                // 停在默认值),这里直接派发 SET_PROJECT_TITLE 更新标题。action type
                // 字符串定义在 @scratch/scratch-gui/src/reducers/project-title.js。
                store.dispatch({
                    type: 'projectTitle/SET_PROJECT_TITLE',
                    title: name == null ? '' : String(name)
                });
            };
            window.scratch.setEnableCouldData = enable => {
                if (config.cloudData) config.cloudData.enable = enable;
            };
            window.scratch.setCloudId = id => {
                if (config.cloudData) config.cloudData.id = id;
            };
            window.scratch.setAuthorUsername = username => {
                if (config.projectInfo) config.projectInfo.authorUsername = username;
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
            merged[type] = [...(merged[type] || []), ...data];
            store.dispatch({
                type: 'scratch-gui/dynamic-assets/SET_DYNAMIC_ASSETS',
                dynamicAssets: merged
            });
        }

        render () {
            return (
                <WrappedComponent
                    {...this.props}
                    onVmInit={this.handleVmInit}
                />
            );
        }
    }

    return ScratchApiWrapper;
};

export {
    scratchApiHOC
};
