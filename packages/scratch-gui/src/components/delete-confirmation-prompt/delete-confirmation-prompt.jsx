import {defineMessages, FormattedMessage, useIntl} from 'react-intl';
import React, {useMemo, useRef} from 'react';
import PropTypes from 'prop-types';
import Box from '../box/box.jsx';
import {PopupSide, PopupAlign} from '../../lib/calculatePopupPosition.js';

import deleteIcon from './icon--delete.svg';
import undoIcon from './icon--undo.svg';
import arrowLeftIcon from './icon--arrow-left.svg';
import arrowRightIcon from './icon--arrow-right.svg';

import styles from './delete-confirmation-prompt.css';
import ModalWithArrow from '../modal-with-arrow/modal-with-arrow.jsx';
import modal from '../../containers/modal.jsx';

// TODO: Parametrize from outside if we want more custom messaging
const messages = defineMessages({
    shouldDeleteSpriteMessage: {
        defaultMessage: 'Are you sure you want to delete this sprite?',
        description: 'Message to indicate whether selected sprite should be deleted.',
        id: 'gui.gui.shouldDeleteSprite'
    },
    shouldDeleteCostumeMessage: {
        defaultMessage: 'Are you sure you want to delete this costume?',
        description: 'Message to indicate whether selected costume should be deleted.',
        id: 'gui.gui.shouldDeleteCostume'
    },
    shouldDeleteSoundMessage: {
        defaultMessage: 'Are you sure you want to delete this sound?',
        description: 'Message to indicate whether selected sound should be deleted.',
        id: 'gui.gui.shouldDeleteSound'
    },
    confirmOption: {
        defaultMessage: 'yes',
        description: 'Yes - should delete the sprite',
        id: 'gui.gui.confirm'
    },
    cancelOption: {
        defaultMessage: 'no',
        description: 'No - cancel deletion',
        id: 'gui.gui.cancel'
    },
    confirmDeletionHeading: {
        defaultMessage: 'Confirm Asset Deletion',
        description: 'Heading of confirmation prompt to delete asset',
        id: 'gui.gui.deleteAssetHeading'
    }
});

const modalWidth = 300;
const arrowWidth = 25;
const arrowHeight = 14;

const arrowConfig = {
    arrowDownIcon: null,
    arrowUpIcon: null,
    arrowLeftIcon,
    arrowRightIcon
};

const getMessage = entityType => {
    if (entityType === 'COSTUME') {
        return messages.shouldDeleteCostumeMessage;
    }

    if (entityType === 'SOUND') {
        return messages.shouldDeleteSoundMessage;
    }

    return messages.shouldDeleteSpriteMessage;
};

const MODAL_POSITION_TO_SIDE = {
    left: PopupSide.LEFT,
    right: PopupSide.RIGHT
};

const DeleteConfirmationPrompt = ({
    onCancel,
    onOk,
    modalPosition,
    entityType,
    relativeElemRef
}) => {
    const intl = useIntl();

    const relativeElementRef = useRef(relativeElemRef);
    relativeElementRef.current = relativeElemRef;

    const side = MODAL_POSITION_TO_SIDE[modalPosition] ?? PopupSide.RIGHT;

    const memorizedLayoutConfig = useMemo(() => ({
        modalWidth,
        spaceForArrow: 30,
        counterOffset: 0,
        arrowOffsetFromBottom: 2,
        arrowHeight,
        arrowWidth
    }), [modalWidth, arrowWidth, arrowHeight]);

    return (
        <ModalWithArrow
            isOpen
            onRequestClose={onCancel}
            relativeElementRef={relativeElementRef}
            side={side}
            align={PopupAlign.CENTER}
            title={intl.formatMessage(messages.confirmDeletionHeading)}
            layoutConfig={memorizedLayoutConfig}
            arrowConfig={arrowConfig}
        >
            <Box className={styles.modalContainer}>
                <Box className={styles.body}>
                    <Box className={styles.label}>
                        <FormattedMessage {...getMessage(entityType)} />
                    </Box>
                    <Box className={styles.buttonRow}>
                        <button
                            className={styles.okButton}
                            onClick={onOk}
                            role="button"
                        >
                            <img
                                className={styles.deleteIcon}
                                src={deleteIcon}
                            />
                            <div className={styles.message}>
                                <FormattedMessage {...messages.confirmOption} />
                            </div>
                        </button>
                        <button
                            className={styles.cancelButton}
                            onClick={onCancel}
                            role="button"
                        >
                            <img
                                className={styles.deleteIcon}
                                src={undoIcon}
                            />
                            <div className={styles.message}>
                                <FormattedMessage {...messages.cancelOption} />
                            </div>
                        </button>
                    </Box>
                </Box>
            </Box>
        </ModalWithArrow>
    );
};

DeleteConfirmationPrompt.propTypes = {
    onOk: PropTypes.func.isRequired,
    onCancel: PropTypes.func.isRequired,
    relativeElemRef: PropTypes.object,
    entityType: PropTypes.string,
    modalPosition: PropTypes.string
};

export default DeleteConfirmationPrompt;
