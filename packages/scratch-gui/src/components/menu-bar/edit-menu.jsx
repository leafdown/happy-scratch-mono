import React, {useRef} from 'react';
import styles from './menu-bar.css';
import classNames from 'classnames';
import PropTypes from 'prop-types';

import editIcon from './icon--edit.svg';
import {FormattedMessage, defineMessage} from 'react-intl';
import MenuBarMenu from './menu-bar-menu.jsx';
import {MenuItem, MenuSection} from '../menu/menu.jsx';
import useMenuNavigation from '../../hooks/use-menu-navigation.jsx';
import dropdownCaret from './dropdown-caret.svg';
import DeletionRestorer from '../../containers/deletion-restorer.jsx';
import TurboMode from '../../containers/turbo-mode.jsx';
import intlShape from '../../lib/intlShape.js';

const editMenu = defineMessage({
    id: 'editMenu.aria.editMenu',
    defaultMessage: 'Edit menu',
    description: 'ARIA label for edit menu'
});

/**
 * EditMenu component – the "Edit" dropdown menu in the menu bar.
 *
 * Handles opening/closing the menu, keyboard navigation, and rendering
 * menu items like Restore and Turbo Mode toggles.
 * @param {object} props - Component props.
 * @param {object} props.intl - React Intl object for formatting messages.
 * @param {boolean} [props.isRtl] - Whether the UI is right-to-left.
 * @param {(deletedItem: {id: string, [key: string]: unknown}) => string} props.restoreOptionMessage
 *   Function that returns the label for the restore menu item.
 * @param {(handleRestore: () => void) => () => void} props.onRestoreOption
 *   Function that takes a restore callback and returns a click handler.
 * @returns {React.ReactNode} The Edit menu button with dropdown items.
 */
const EditMenu = props => {
    const restoreRef = useRef(null);
    const turboRef = useRef(null);

    const itemRefs = [restoreRef, turboRef];

    const {
        isExpanded,
        handleKeyPress,
        handleKeyPressOpenMenu,
        handleOnOpen,
        handleOnClose
    } = useMenuNavigation({
        menuRef: props.menuRef,
        itemRefs,
        depth: 1
    });

    return (
        <div
            className={classNames(styles.menuBarItem, styles.hoverable, {
                [styles.active]: isExpanded()
            })}
            onClick={handleOnOpen}
            role="button"
            aria-label={props.intl.formatMessage(editMenu)}
            aria-expanded={isExpanded()}
            tabIndex={0}
            onKeyDown={handleKeyPress}
        >
            <img src={editIcon} />
            <span className={styles.collapsibleLabel}>
                <FormattedMessage
                    defaultMessage="Edit"
                    description="Text for edit dropdown menu"
                    id="gui.menuBar.edit"
                />
            </span>
            <img src={dropdownCaret} />
            <MenuBarMenu
                className={classNames(styles.menuBarMenu)}
                open={isExpanded()}
                place={props.isRtl ? 'left' : 'right'}
                onRequestClose={handleOnClose}
            >
                <DeletionRestorer>{(handleRestore, {restorable, deletedItem}) => (
                    <MenuItem
                        className={classNames({[styles.disabled]: !restorable})}
                        onClick={props.onRestoreOption(handleRestore)}
                        menuRef={restoreRef}
                        onParentKeyPress={handleKeyPressOpenMenu}
                        isDisabled={!restorable}
                    >
                        {props.restoreOptionMessage(deletedItem)}
                    </MenuItem>
                )}</DeletionRestorer>
                <MenuSection>
                    <TurboMode>{(toggleTurboMode, {turboMode}) => (
                        <MenuItem
                            onClick={toggleTurboMode}
                            menuRef={turboRef}
                            onParentKeyPress={handleKeyPressOpenMenu}
                        >
                            {turboMode ? (
                                <FormattedMessage
                                    defaultMessage="Turn off Turbo Mode"
                                    description="Menu bar item for turning off turbo mode"
                                    id="gui.menuBar.turboModeOff"
                                />
                            ) : (
                                <FormattedMessage
                                    defaultMessage="Turn on Turbo Mode"
                                    description="Menu bar item for turning on turbo mode"
                                    id="gui.menuBar.turboModeOn"
                                />
                            )}
                        </MenuItem>
                    )}</TurboMode>
                </MenuSection>
            </MenuBarMenu>
        </div>
    );
};

EditMenu.propTypes = {
    intl: intlShape.isRequired,
    menuRef: PropTypes.shape({current: PropTypes.instanceOf(Element)}),
    isRtl: PropTypes.bool,
    restoreOptionMessage: PropTypes.func,
    onRestoreOption: PropTypes.func
};

export default EditMenu;
