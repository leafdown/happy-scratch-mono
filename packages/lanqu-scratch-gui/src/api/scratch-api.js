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
            if (config.handleVmInitialized) config.handleVmInitialized(vm);
        }

        registerApi () {
            window.scratch._config = config;
            const dispatch = store.dispatch;
            window.scratch.setPlayerOnly = isPlayerOnly => dispatch(setPlayer(isPlayerOnly));
            window.scratch.setFullScreen = isFullScreen => dispatch(setFullScreen(isFullScreen));
            window.scratch.setLocale = locale => dispatch(selectLocale(locale));
            // Trigger default project load (mirrors HashParserHOC's setProjectId('0')).
            // Without this the editor boots with an empty target list.
            dispatch(setProjectId(defaultProjectId));
        }

        registerVmApi () {
            const vm = this.vm;
            window.scratch.loadProject = (url, callback) => {
                fetch(url)
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
                return state.scratchGui?.projectState?.projectId || '';
            };
            window.scratch.setProjectName = name => {
                if (vm.renameProject) vm.renameProject(vm.editingTarget && vm.editingTarget.id, name);
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
