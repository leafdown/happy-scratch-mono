import React from 'react';
import PropTypes from 'prop-types';
import {defineMessages, FormattedMessage} from 'react-intl';

import Box from '../box/box.jsx';
import ModalWithArrow from '../modal-with-arrow/modal-with-arrow.jsx';

import arrowDownIcon from './icon--arrow-down.svg';
import arrowUpIcon from './icon--arrow-up.svg';
import arrowLeftIcon from './icon--arrow-left.svg';
import arrowRightIcon from './icon--arrow-right.svg';

import styles from './confirmation-prompt.css';
import {PopupAlign, PopupSide} from '../../lib/calculatePopupPosition.js';

const messages = defineMessages({
    defaultConfirmLabel: {
        defaultMessage: 'yes',
        description: 'Label for confirm button in confirmation prompt',
        id: 'gui.confirmationPrompt.confirm'
    },
    defaultCancelLabel: {
        defaultMessage: 'no',
        description: 'Label for cancel button in confirmation prompt',
        id: 'gui.confirmationPrompt.cancel'
    }
});

const defaultConfig = {
    modalWidth: 200,
    spaceForArrow: 16,
    counterOffset: 7,
    arrowOffsetFromBottom: 2,
    arrowWidth: 29,
    arrowHeight: 13
};

const arrowConfig = {
    arrowDownIcon,
    arrowUpIcon,
    arrowLeftIcon,
    arrowRightIcon
};

const ConfirmationPrompt = ({
    title,
    message,
    confirmLabel,
    cancelLabel,
    onConfirm,
    onCancel,
    isOpen,
    relativeElementRef,
    side,
    align,
    layoutConfig
}) => {
    const {
        modalWidth,
        spaceForArrow,
        counterOffset,
        arrowOffsetFromBottom,
        arrowHeight,
        arrowWidth
    } = {...defaultConfig, ...layoutConfig};

    const memoizedLayoutConfig = React.useMemo(() => ({
        modalWidth,
        spaceForArrow,
        counterOffset,
        arrowOffsetFromBottom,
        arrowHeight,
        arrowWidth
    }), [modalWidth,
        spaceForArrow,
        counterOffset,
        arrowOffsetFromBottom,
        arrowHeight,
        arrowWidth
    ]);

    return (
        <ModalWithArrow
            isOpen={isOpen}
            relativeElementRef={relativeElementRef}
            onRequestClose={onCancel}
            side={side}
            align={align}
            layoutConfig={memoizedLayoutConfig}
            arrowConfig={arrowConfig}
            title={title}
        >
            <Box className={styles.modalContainer}>
                <Box className={styles.label}>
                    {message}
                </Box>
                <Box className={styles.buttonRow}>
                    <button
                        onClick={onCancel}
                        className={styles.cancelButton}
                    >
                        {cancelLabel ?? <FormattedMessage {...messages.defaultCancelLabel} />}
                    </button>
                    <button
                        onClick={onConfirm}
                        className={styles.confirmButton}
                    >
                        {confirmLabel ?? <FormattedMessage {...messages.defaultConfirmLabel} />}
                    </button>
                </Box>
            </Box>
        </ModalWithArrow>
    );
};

ConfirmationPrompt.propTypes = {
    isOpen: PropTypes.bool.isRequired,
    title: PropTypes.string,
    message: PropTypes.node.isRequired,
    confirmLabel: PropTypes.node,
    cancelLabel: PropTypes.node,
    onConfirm: PropTypes.func.isRequired,
    onCancel: PropTypes.func.isRequired,
    relativeElementRef: PropTypes.shape({current: PropTypes.instanceOf(Element)}),
    side: PropTypes.oneOf(Object.values(PopupSide)).isRequired,
    align: PropTypes.oneOf(Object.values(PopupAlign)),
    layoutConfig: PropTypes.shape({
        modalWidth: PropTypes.number,
        spaceForArrow: PropTypes.number,
        arrowOffsetFromBottom: PropTypes.number,
        counterOffset: PropTypes.number,
        arrowHeight: PropTypes.number,
        arrowWidth: PropTypes.number
    })
};

export default ConfirmationPrompt;
