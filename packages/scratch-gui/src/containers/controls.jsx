import bindAll from 'lodash.bindall';
import PropTypes from 'prop-types';
import React from 'react';
import VM from '@scratch/scratch-vm';
import {connect} from 'react-redux';

import ControlsComponent from '../components/controls/controls.jsx';

class Controls extends React.Component {
    constructor (props) {
        super(props);
        bindAll(this, [
            'handleGreenFlagClick',
            'handleStopAllClick'
        ]);
    }
    handleGreenFlagClick (e) {
        e.preventDefault();
        // Patch P12: allow host to intercept (return true to proceed).
        const before = this.props.controlsConfig && this.props.controlsConfig.onBeforeStart;
        if (before && !before()) return;
        if (e.shiftKey) {
            this.props.vm.setTurboMode(!this.props.turbo);
        } else {
            if (!this.props.isStarted) {
                this.props.vm.start();
            }
            this.props.vm.greenFlag();
        }
    }
    handleStopAllClick (e) {
        e.preventDefault();
        // Patch P12: allow host to intercept (return true to proceed).
        const before = this.props.controlsConfig && this.props.controlsConfig.onBeforeStop;
        if (before && !before()) return;
        this.props.vm.stopAll();
    }
    render () {
        const {
            vm,
            isStarted,
            projectRunning,
            turbo,
            isFullScreen,
            controlsConfig,
            ...props
        } = this.props;
        return (
            <ControlsComponent
                {...props}
                active={projectRunning}
                turbo={turbo}
                onGreenFlagClick={this.handleGreenFlagClick}
                onStopAllClick={this.handleStopAllClick}
                isFullScreen={isFullScreen}
                showStartButton={!controlsConfig || controlsConfig.showStartButton !== false}
                showStopButton={!controlsConfig || controlsConfig.showStopButton !== false}
            />
        );
    }
}

Controls.propTypes = {
    controlsConfig: PropTypes.shape({
        showStartButton: PropTypes.bool,
        showStopButton: PropTypes.bool,
        onBeforeStart: PropTypes.func,
        onBeforeStop: PropTypes.func
    }),
    isFullScreen: PropTypes.bool,
    isStarted: PropTypes.bool.isRequired,
    projectRunning: PropTypes.bool.isRequired,
    turbo: PropTypes.bool.isRequired,
    vm: PropTypes.instanceOf(VM)
};

const mapStateToProps = state => ({
    isStarted: state.scratchGui.vmStatus.running,
    projectRunning: state.scratchGui.vmStatus.running,
    turbo: state.scratchGui.vmStatus.turbo
});
// no-op function to prevent dispatch prop being passed to component
const mapDispatchToProps = () => ({});

export default connect(mapStateToProps, mapDispatchToProps)(Controls);
