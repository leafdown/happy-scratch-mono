import React from 'react';
import styles from './menu-bar.css';
import classNames from 'classnames';
import PropTypes from 'prop-types';
import bindAll from 'lodash.bindall';

import fileIcon from './icon--file.svg';
import {FormattedMessage} from 'react-intl';
import MenuBarMenu from './menu-bar-menu.jsx';
import {MenuItem, MenuSection} from '../menu/menu.jsx';
import {BaseMenu} from './base-menu';
import SB3Downloader from '../../containers/sb3-downloader.jsx';
import dropdownCaret from './dropdown-caret.svg';

import sharedMessages from '../../lib/shared-messages';
import intlShape from '../../lib/intlShape.js';

export class FileMenu extends BaseMenu {
    constructor (props) {
        super(props);

        bindAll(this, ['handleOnClose', 'handleKeyPress', 'handleOnOpen']);
        
        this.state = {focusedIndex: -1};

        this.newProjectRef = React.createRef();
        this.saveRef = React.createRef();
        this.createRef = React.createRef();
        this.remixRef = React.createRef();
        this.loadFromComputerRef = React.createRef();
        this.saveToComputerRef = React.createRef();
        
        this.itemRefs = [
            this.newProjectRef,
            ...(this.props.canSave ? [this.saveRef] : []),
            ...(this.props.canCreateCopy ? [this.createRef] : []),
            ...(this.props.canRemix ? [this.remixRef] : []),
            this.loadFromComputerRef,
            this.saveToComputerRef
        ];
    }

    render () {
        const saveNowMessage = (
            <FormattedMessage
                defaultMessage="Save now"
                description="Menu bar item for saving now"
                id="gui.menuBar.saveNow"
            />
        );
        const createCopyMessage = (
            <FormattedMessage
                defaultMessage="Save as a copy"
                description="Menu bar item for saving as a copy"
                id="gui.menuBar.saveAsCopy"
            />
        );
        const remixMessage = (
            <FormattedMessage
                defaultMessage="Remix"
                description="Menu bar item for remixing"
                id="gui.menuBar.remix"
            />
        );
        const newProjectMessage = (
            <FormattedMessage
                defaultMessage="New"
                description="Menu bar item for creating a new project"
                id="gui.menuBar.new"
            />
        );
        return (
            <div
                className={classNames(styles.menuBarItem, styles.hoverable, {
                    [styles.active]: this.context.isTopMenu(this.props.focusedRef)
                })}
                onClick={this.handleOnOpen}
                aria-label="File Menu"
                role="button"
                tabIndex={0}
                ref={this.props.focusedRef}
                onKeyDown={this.handleKeyPress}
            >
                <img src={fileIcon} />
                <span className={styles.collapsibleLabel}>
                    <FormattedMessage
                        defaultMessage="File"
                        description="Text for file dropdown menu"
                        id="gui.menuBar.file"
                    />
                </span>
                <img src={dropdownCaret} />
                <MenuBarMenu
                    className={classNames(styles.menuBarMenu)}
                    open={this.context.isTopMenu(this.props.focusedRef)}
                    place={this.props.isRtl ? 'left' : 'right'}
                    onRequestClose={this.handleOnClose}
                >
                    <MenuSection>
                        <MenuItem
                            isRtl={this.props.isRtl}
                            onClick={this.props.onClickNew}
                            focusedRef={this.newProjectRef}
                            onParentKeyPress={this.handleKeyPress}
                        >
                            {newProjectMessage}
                        </MenuItem>
                    </MenuSection>
                    {(this.props.canSave || this.props.canCreateCopy || this.props.canRemix) && (
                        <MenuSection>
                            {this.props.canSave && (
                                <MenuItem
                                    onClick={this.props.onClickSave}
                                    focusedRef={this.saveRef}
                                    onParentKeyPress={this.handleKeyPress}
                                >
                                    {saveNowMessage}
                                </MenuItem>
                            )}
                            {this.props.canCreateCopy && (
                                <MenuItem
                                    onClick={this.props.onClickSaveAsCopy}
                                    focusedRef={this.createRef}
                                    onParentKeyPress={this.handleKeyPress}
                                >
                                    {createCopyMessage}
                                </MenuItem>
                            )}
                            {this.props.canRemix && (
                                <MenuItem
                                    onClick={this.props.onClickRemix}
                                    focusedRef={this.remixRef}
                                    onParentKeyPress={this.handleKeyPress}
                                >
                                    {remixMessage}
                                </MenuItem>
                            )}
                        </MenuSection>
                    )}
                    <MenuSection>
                        <MenuItem
                            onClick={this.props.onStartSelectingFileUpload}
                            focusedRef={this.loadFromComputerRef}
                            onParentKeyPress={this.handleKeyPress}
                        >
                            {this.props.intl.formatMessage(sharedMessages.loadFromComputerTitle)}
                        </MenuItem>
                        <SB3Downloader>{(className, downloadProjectCallback) => (
                            <MenuItem
                                className={className}
                                onClick={this.props.getSaveToComputerHandler(downloadProjectCallback)}
                                focusedRef={this.saveToComputerRef}
                                onParentKeyPress={this.handleKeyPress}
                            >
                                <FormattedMessage
                                    defaultMessage="Save to your computer"
                                    description="Menu bar item for downloading a project to your computer" // eslint-disable-line max-len
                                    id="gui.menuBar.downloadToComputer"
                                />
                            </MenuItem>
                        )}</SB3Downloader>
                    </MenuSection>
                </MenuBarMenu>
            </div>
        );
    }
}

FileMenu.propTypes = {
    focusedRef: PropTypes.shape({current: PropTypes.instanceOf(Element)}),
    intl: intlShape,
    isRtl: PropTypes.bool,
    canSave: PropTypes.bool,
    canCreateCopy: PropTypes.bool,
    canRemix: PropTypes.bool,
    onStartSelectingFileUpload: PropTypes.func,
    onClickSave: PropTypes.func,
    onClickSaveAsCopy: PropTypes.func,
    onClickRemix: PropTypes.func,
    onClickNew: PropTypes.func
};
