import React from 'react';
import styles from './menu-bar.css';
import classNames from 'classnames';
import PropTypes from 'prop-types';
import bindAll from 'lodash.bindall';

import editIcon from './icon--edit.svg';
import {FormattedMessage} from 'react-intl';
import MenuBarMenu from './menu-bar-menu.jsx';
import {MenuItem, MenuSection} from '../menu/menu.jsx';
import {BaseMenu} from './base-menu';
import dropdownCaret from './dropdown-caret.svg';
import DeletionRestorer from '../../containers/deletion-restorer.jsx';
import TurboMode from '../../containers/turbo-mode.jsx';

export class EditMenu extends BaseMenu {
    constructor (props) {
        super(props);

        bindAll(this, ['handleOnClose', 'handleKeyPress', 'handleOnOpen']);
        
        this.state = {focusedIndex: -1};

        this.restoreRef = React.createRef();
        this.turboRef = React.createRef();
        
        this.itemRefs = [
            this.restoreRef,
            this.turboRef
        ];
    }

    render () {
        return (
            <div
                className={classNames(styles.menuBarItem, styles.hoverable, {
                    [styles.active]: this.context.isOpenMenu(this.props.focusedRef)
                })}
                onClick={this.handleOnOpen}
                role="button"
                aria-label="Edit Menu"
                tabIndex={0}
                onKeyDown={this.handleKeyPress}
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
                    open={this.context.isOpenMenu(this.props.focusedRef)}
                    place={this.props.isRtl ? 'left' : 'right'}
                    onRequestClose={this.handleOnClose}
                >
                    <DeletionRestorer>{(handleRestore, {restorable, deletedItem}) => (
                        <MenuItem
                            className={classNames({[styles.disabled]: !restorable})}
                            onClick={this.props.onRestoreOption(handleRestore)}
                            focusedRef={this.restoreRef}
                            onParentKeyPress={this.handleKeyPress}
                        >
                            {this.props.restoreOptionMessage(deletedItem)}
                        </MenuItem>
                    )}</DeletionRestorer>
                    <MenuSection>
                        <TurboMode>{(toggleTurboMode, {turboMode}) => (
                            <MenuItem
                                onClick={toggleTurboMode}
                                focusedRef={this.turboRef}
                                onParentKeyPress={this.handleKeyPress}
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
    }
}

EditMenu.propTypes = {
    focusedRef: PropTypes.shape({current: PropTypes.instanceOf(Element)}),
    isRtl: PropTypes.bool,
    restoreOptionMessage: PropTypes.func,
    onRestoreOption: PropTypes.func
};
