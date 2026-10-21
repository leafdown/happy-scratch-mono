import PropTypes from 'prop-types';
import React from 'react';
import {connect} from 'react-redux';
import bindAll from 'lodash.bindall';

import VM from '@scratch/scratch-vm';

import {
    getIsShowingWithId
} from '../reducers/project-state';

import {
    showAlertWithTimeout
} from '../reducers/alerts';
import {GUIStoragePropType} from '../gui-config';

const getCloudControl = props => props.cloudControl || {};

const getCloudProjectId = props => {
    const control = getCloudControl(props);
    return Object.prototype.hasOwnProperty.call(control, 'projectId') ?
        control.projectId : props.projectId;
};

const getCloudUsername = props => {
    const control = getCloudControl(props);
    return Object.prototype.hasOwnProperty.call(control, 'username') ?
        control.username : props.username;
};

const isCloudEnabled = props => getCloudControl(props).enabled !== false;

/*
 * Higher Order Component to manage the connection to the cloud server.
 * @param {React.Component} WrappedComponent component to manage VM events for
 * @returns {React.Component} connected component with vm events bound to redux
 */
const cloudManagerHOC = function (WrappedComponent) {
    class CloudManager extends React.Component {
        constructor (props) {
            super(props);

            this.cloudProvider = null;
            bindAll(this, [
                'handleCloudDataUpdate',
                'handleExtensionAdded'
            ]);

            this.props.vm.on('HAS_CLOUD_DATA_UPDATE', this.handleCloudDataUpdate);
            this.props.vm.on('EXTENSION_ADDED', this.handleExtensionAdded);
        }
        componentDidMount () {
            if (this.shouldConnect(this.props)) {
                this.connectToCloud();
            }
        }
        componentDidUpdate (prevProps) {
            if (this.shouldDisconnect(this.props, prevProps)) {
                this.disconnectFromCloud();
            }
            // A project/user change makes the existing connection stale.
            // Reconnect immediately when the new props are still valid.
            if (this.shouldConnect(this.props)) {
                this.connectToCloud();
            }
        }
        componentWillUnmount () {
            // Make sure to clean up old handlers as otherwise we end up with multiple connections at the same time
            this.props.vm.off('HAS_CLOUD_DATA_UPDATE', this.handleCloudDataUpdate);
            this.props.vm.off('EXTENSION_ADDED', this.handleExtensionAdded);

            this.disconnectFromCloud();
        }
        canConnectCloud (props) {
            return !!(
                isCloudEnabled(props) &&
                props.storage.cloudVariables &&
                props.cloudHost &&
                getCloudUsername(props) &&
                props.vm &&
                getCloudProjectId(props) &&
                props.hasCloudPermission
            );
        }
        canUseCloud (props) {
            // Writing is a UI concern. Keep the connection alive for read-only
            // sessions (for example an anonymous player).
            const control = getCloudControl(props);
            return this.canConnectCloud(props) && control.canWrite !== false;
        }
        shouldConnect (props) {
            const control = getCloudControl(props);
            // A host-managed project ID means the project is ready for cloud
            // data even if the redux project state still says "without id".
            const projectReady = control.projectId ? true : props.isShowingWithId;
            return !this.isConnected() && this.canConnectCloud(props) &&
                projectReady && props.vm.runtime.hasCloudData() &&
                props.canModifyCloudData;
        }
        shouldDisconnect (props, prevProps) {
            return this.isConnected() &&
                ( // Can no longer use cloud or cloud provider info is now stale
                    !this.canConnectCloud(props) ||
                    !props.vm.runtime.hasCloudData() ||
                    (getCloudProjectId(props) !== getCloudProjectId(prevProps)) ||
                    (getCloudUsername(props) !== getCloudUsername(prevProps)) ||
                    // Editing someone else's project
                    !props.canModifyCloudData
                );
        }
        isConnected () {
            return this.cloudProvider && this.cloudProvider.isConnectedOrConnecting();
        }
        connectToCloud () {
            // Clean up old connection if there was one
            this.disconnectFromCloud();

            if (!this.props.storage.cloudVariables) {
                return;
            }

            this.cloudProvider = this.props.storage.cloudVariables.createProvider(
                this.props.cloudHost,
                this.props.vm,
                getCloudUsername(this.props),
                getCloudProjectId(this.props)
            );

            this.props.vm.setCloudProvider(this.cloudProvider);
        }
        disconnectFromCloud () {
            if (this.cloudProvider) {
                this.cloudProvider.requestCloseConnection();
                this.cloudProvider = null;
                this.props.vm.setCloudProvider(null);
            }
        }
        handleCloudDataUpdate (projectHasCloudData) {
            if (this.isConnected() && !projectHasCloudData) {
                this.disconnectFromCloud();
            } else if (this.shouldConnect(this.props)) {
                this.props.onShowCloudInfo();
                this.connectToCloud();
            }
        }
        handleExtensionAdded (categoryInfo) {
            // Note that props.vm.extensionManager.isExtensionLoaded('videoSensing') is still false
            // at the point of this callback, so it is difficult to reuse the canModifyCloudData logic.
            if (
                (categoryInfo.id === 'videoSensing' ||
                    categoryInfo.id === 'faceSensing') &&
                this.isConnected()
            ) {
                this.disconnectFromCloud();
            }
        }
        render () {
            const {

                canModifyCloudData,
                cloudControl,
                cloudHost,
                projectId,
                hasCloudPermission,
                isShowingWithId,
                onShowCloudInfo,


                vm,

                // Intentionally propagating this one since it's used in MenuBar
                // username,

                ...componentProps
            } = this.props;
            return (
                <WrappedComponent
                    canUseCloud={this.canUseCloud(this.props)}
                    vm={vm}
                    {...componentProps}
                />
            );
        }
    }

    CloudManager.propTypes = {
        storage: GUIStoragePropType,
        canModifyCloudData: PropTypes.bool.isRequired,
        cloudControl: PropTypes.shape({
            enabled: PropTypes.bool,
            projectId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
            username: PropTypes.string,
            canModifyCloudData: PropTypes.bool,
            canWrite: PropTypes.bool
        }),
        cloudHost: PropTypes.string,
        hasCloudPermission: PropTypes.bool,
        isShowingWithId: PropTypes.bool.isRequired,
        onShowCloudInfo: PropTypes.func,
        projectId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
        username: PropTypes.string,
        vm: PropTypes.instanceOf(VM).isRequired
    };

    CloudManager.defaultProps = {
        cloudHost: null,
        hasCloudPermission: false,
        onShowCloudInfo: () => {},
        username: null
    };

    const mapStateToProps = (state, ownProps) => {
        const loadingState = state.scratchGui.projectState.loadingState;
        const cloudControl = ownProps.cloudControl || {};
        const canModifyCloudData = Object.prototype.hasOwnProperty.call(
            cloudControl, 'canModifyCloudData'
        ) ? cloudControl.canModifyCloudData : (!state.scratchGui.mode.hasEverEnteredEditor ||
            ownProps.canSave);
        return {
            storage: state.scratchGui.config.storage,

            isShowingWithId: getIsShowingWithId(loadingState),
            projectId: state.scratchGui.projectState.projectId,
            // if you're editing someone else's project, you can't modify cloud data
            canModifyCloudData:
                canModifyCloudData &&
                // possible security concern if the program attempts to encode webcam data over cloud variables
                !(
                    ownProps.vm.extensionManager.isExtensionLoaded(
                        'videoSensing'
                    ) ||
                    ownProps.vm.extensionManager.isExtensionLoaded(
                        'faceSensing'
                    )
                )
        };
    };

    const mapDispatchToProps = dispatch => ({
        onShowCloudInfo: () => showAlertWithTimeout(dispatch, 'cloudInfo')
    });

    // Allow incoming props to override redux-provided props. Used to mock in tests.
    const mergeProps = (stateProps, dispatchProps, ownProps) => Object.assign(
        {}, stateProps, dispatchProps, ownProps
    );

    return connect(
        mapStateToProps,
        mapDispatchToProps,
        mergeProps
    )(CloudManager);
};

export default cloudManagerHOC;
