import React, {useRef, useCallback, useEffect} from 'react';
import debounce from 'lodash.debounce';
import PropTypes from 'prop-types';
import ReactModal from 'react-modal';
import {defineMessages, FormattedMessage, useIntl} from 'react-intl';

import Box from '../box/box.jsx';

import arrowLeftIcon from './icon--arrow-left.svg';
import arrowRightIcon from './icon--arrow-right.svg';
import arrowDownIcon from './icon--arrow-down.svg';
import arrowUpIcon from './icon--arrow-up.svg';

import styles from './confirmation-prompt.css';

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

const modalWidth = 200;
const spaceForArrow = 16;
const arrowOffsetFromEnd = 7;
const arrowLongSide = 29;
const arrowShortSide = 13;

const calculateModalPosition = (relativeElemRef, modalRef, modalPosition) => {
    const arrowHeight = (modalPosition === 'left' || modalPosition === 'right') ?
        arrowLongSide : arrowShortSide;
    const arrowWidth = (modalPosition === 'left' || modalPosition === 'right') ?
        arrowShortSide : arrowLongSide;

    const el = relativeElemRef?.current;
    const modalEl = modalRef?.current;
    if (!el || !modalEl) {
        return {};
    }

    const buttonRect = el.getBoundingClientRect();
    const modalRect = modalEl.getBoundingClientRect();
    const modalHeight = modalRect.height;
    
    let top = 0;
    let left = 0;
    let arrowIcon = null;
    let arrowTop = 0;
    let arrowLeft = 0;

    switch (modalPosition) {
    case 'left':
        top = buttonRect.top - (modalHeight / 2) + (buttonRect.height / 2);
        left = buttonRect.left - modalWidth - spaceForArrow;
        arrowIcon = arrowRightIcon;
        arrowTop = buttonRect.top + (buttonRect.height / 2) - (arrowHeight / 2);
        arrowLeft = left + modalWidth;
        break;
    case 'right':
        top = buttonRect.top - (modalHeight / 2) + (buttonRect.height / 2);
        left = buttonRect.right + spaceForArrow;
        arrowIcon = arrowLeftIcon;
        arrowTop = buttonRect.top + (buttonRect.height / 2) - (arrowHeight / 2);
        arrowLeft = left - arrowWidth;
        break;
    case 'up':
        top = buttonRect.top - modalHeight - spaceForArrow;
        left = buttonRect.left - ((modalWidth - buttonRect.width) / 2);
        arrowIcon = arrowDownIcon;
        arrowTop = top + modalHeight;
        arrowLeft = buttonRect.left + (buttonRect.width / 2) - (arrowWidth / 2);
        break;
    case 'down':
        top = buttonRect.bottom + spaceForArrow;
        left = buttonRect.left - ((modalWidth - buttonRect.width) / 2);
        arrowIcon = arrowUpIcon;
        arrowTop = top - arrowHeight;
        arrowLeft = buttonRect.left + (buttonRect.width / 2) - (arrowWidth / 2);
        break;
    case 'down left':
        top = buttonRect.bottom + spaceForArrow;
        left = buttonRect.left - modalWidth + buttonRect.width + arrowOffsetFromEnd;
        arrowIcon = arrowUpIcon;
        arrowTop = top - arrowHeight;
        arrowLeft = buttonRect.left + (buttonRect.width / 2) - (arrowWidth / 2);
        break;
    case 'down right':
        top = buttonRect.bottom + spaceForArrow;
        left = buttonRect.left - arrowOffsetFromEnd;
        arrowIcon = arrowUpIcon;
        arrowTop = top - arrowHeight;
        arrowLeft = buttonRect.left + (buttonRect.width / 2) - (arrowWidth / 2);
        break;
    case 'up left':
        top = buttonRect.top - modalHeight - spaceForArrow;
        left = buttonRect.left - modalWidth + buttonRect.width + arrowOffsetFromEnd;
        arrowIcon = arrowDownIcon;
        arrowTop = top + modalHeight;
        arrowLeft = buttonRect.left + (buttonRect.width / 2) - (arrowWidth / 2);
        break;
    case 'up right':
        top = buttonRect.top - modalHeight - spaceForArrow;
        left = buttonRect.left - arrowOffsetFromEnd;
        arrowIcon = arrowDownIcon;
        arrowTop = top + modalHeight;
        arrowLeft = buttonRect.left + (buttonRect.width / 2) - (arrowWidth / 2);
        break;
    }
    
    return {top, left, arrowIcon, arrowTop, arrowLeft};
};

const ConfirmationPrompt = ({
    title,
    message,
    confirmLabel,
    cancelLabel,
    onConfirm,
    onCancel,
    isOpen,
    relativeElemRef,
    modalPosition
}) => {
    const intl = useIntl();

    const modalRef = useRef(null);
    const [modalPositionValues, setModalPositionValues] = React.useState({});

    const updatePosition = useCallback(() => {
        if (relativeElemRef.current && modalRef.current) {
            const pos = calculateModalPosition(relativeElemRef, modalRef, modalPosition);
            setModalPositionValues(pos);
        }
    }, [relativeElemRef, modalPosition]);

    useEffect(() => {
        if (!isOpen) return;

        const debouncedUpdate = debounce(updatePosition, 50, {leading: true});

        debouncedUpdate();

        window.addEventListener('resize', debouncedUpdate);
        return () => window.removeEventListener('resize', debouncedUpdate);
    }, [isOpen, relativeElemRef, modalPosition]);

    const onModalMount = useCallback(el => {
        if (!el || !isOpen) return;
        modalRef.current = el;

        updatePosition();
    }, [isOpen, relativeElemRef, modalPosition]);

    return (
        isOpen && (
            <ReactModal
                isOpen
                onRequestClose={onCancel}
                contentLabel={intl.formatMessage(title)}
                style={{
                    content: {
                        top: modalPositionValues.top,
                        left: modalPositionValues.left,
                        width: modalWidth,
                        border: 'none',
                        height: 'fit-content',
                        backgroundColor: 'transparent',
                        padding: 0,
                        margin: 0,
                        position: 'absolute',
                        overflowX: 'hidden',
                        zIndex: 1000
                    },
                    overlay: {
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        zIndex: 510,
                        backgroundColor: 'transparent'
                    }
                }}
            >
                {modalPositionValues.arrowIcon && (
                    <img
                        src={modalPositionValues.arrowIcon}
                        style={{
                            position: 'fixed',
                            top: modalPositionValues.arrowTop,
                            left: modalPositionValues.arrowLeft,
                            width: (modalPosition === 'left' || modalPosition === 'right') ?
                                arrowShortSide : arrowLongSide,
                            height: (modalPosition === 'left' || modalPosition === 'right') ?
                                arrowLongSide : arrowShortSide,
                            zIndex: 1001
                        }}
                    />
                )}
                <Box
                    className={styles.modalContainer}
                    componentRef={onModalMount}
                >
                    <Box className={styles.label}>
                        <FormattedMessage {...message} />
                    </Box>

                    <Box className={styles.buttonRow}>
                        <button
                            onClick={onCancel}
                            className={styles.cancelButton}
                        >
                            <FormattedMessage {...(cancelLabel ?? messages.defaultCancelLabel)} />
                        </button>

                        <button
                            onClick={onConfirm}
                            className={styles.confirmButton}
                        >
                            <FormattedMessage {...(confirmLabel ?? messages.defaultConfirmLabel)} />
                        </button>
                    </Box>
                </Box>
            </ReactModal>
        )
    );
};

ConfirmationPrompt.propTypes = {
    isOpen: PropTypes.bool.isRequired,
    title: PropTypes.string.isRequired,
    message: PropTypes.string.isRequired,
    confirmLabel: PropTypes.string,
    cancelLabel: PropTypes.string,
    onConfirm: PropTypes.func.isRequired,
    onCancel: PropTypes.func.isRequired,
    relativeElemRef: PropTypes.shape({current: PropTypes.instanceOf(Element)}),
    modalPosition: PropTypes.oneOf([
        'left',
        'right',
        'up',
        'down',
        'down left',
        'down right',
        'up left',
        'up right'
    ]).isRequired
};

export default ConfirmationPrompt;
