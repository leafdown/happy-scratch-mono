import classNames from 'classnames';
import PropTypes from 'prop-types';
import React from 'react';
import {defineMessages, useIntl} from 'react-intl';

import GreenFlag from '../green-flag/green-flag.jsx';
import StopAll from '../stop-all/stop-all.jsx';
import TurboMode from '../turbo-mode/turbo-mode.jsx';

import styles from './controls.css';

const messages = defineMessages({
    goTitle: {
        id: 'gui.controls.go',
        defaultMessage: 'Go',
        description: 'Green flag button title'
    },
    stopTitle: {
        id: 'gui.controls.stop',
        defaultMessage: 'Stop',
        description: 'Stop button title'
    }
});

const Controls = function (props) {
    const {
        active,
        className,
        onGreenFlagClick,
        onStopAllClick,
        turbo,
        isFullScreen,
        showStartButton,
        showStopButton,
        ...componentProps
    } = props;
    const intl = useIntl();
    return (
        <div
            className={classNames(styles.controlsContainer, className)}
            {...componentProps}
        >
            {showStartButton !== false && (
                <GreenFlag
                    active={active}
                    title={intl.formatMessage(messages.goTitle)}
                    onClick={onGreenFlagClick}
                    isFullScreen={isFullScreen}
                />
            )}
            {showStopButton !== false && (
                <StopAll
                    active={active}
                    title={intl.formatMessage(messages.stopTitle)}
                    onClick={onStopAllClick}
                    isFullScreen={isFullScreen}
                />
            )}
            {turbo ? (
                <TurboMode />
            ) : null}
        </div>
    );
};

Controls.propTypes = {
    isFullScreen: PropTypes.bool,
    active: PropTypes.bool,
    className: PropTypes.string,
    onGreenFlagClick: PropTypes.func.isRequired,
    onStopAllClick: PropTypes.func.isRequired,
    showStartButton: PropTypes.bool,
    showStopButton: PropTypes.bool,
    turbo: PropTypes.bool
};

Controls.defaultProps = {
    active: false,
    turbo: false
};

export default Controls;
