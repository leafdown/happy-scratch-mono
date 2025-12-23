import classNames from 'classnames';
import PropTypes from 'prop-types';
import bindAll from 'lodash.bindall';
import React from 'react';
import {FormattedMessage} from 'react-intl';

import LanguageMenu from './language-menu.jsx';
import MenuBarMenu from './menu-bar-menu.jsx';
import ThemeMenu from './theme-menu.jsx';
import {MenuSection} from '../menu/menu.jsx';
import {MenuRefContext} from '../context-menu/menu-path-context.jsx';

import menuBarStyles from './menu-bar.css';
import styles from './settings-menu.css';

import dropdownCaret from './dropdown-caret.svg';
import settingsIcon from './icon--settings.svg';
import {BaseMenu} from './base-menu.jsx';

class SettingsMenu extends BaseMenu {
    constructor (props) {
        super(props);

        bindAll(this, []);
        
        this.state = {focusedIndex: -1};

        this.languageRef = React.createRef();
        this.themeRef = React.createRef();
        // hardcoded logic because of only two options
        this.itemRefs = [this.languageRef, this.themeRef];
    }

    static contextType = MenuRefContext;
    render () {
        const {
            canChangeLanguage,
            canChangeTheme,
            isRtl,
            settingsMenuOpen
        } = this.props;

        return (<div
            className={classNames(menuBarStyles.menuBarItem, menuBarStyles.hoverable, menuBarStyles.themeMenu, {
                [menuBarStyles.active]: settingsMenuOpen
            })}
            role="button"
            aria-expanded={this.context.isTopMenu(this.props.focusedRef)}
            tabIndex={0}
            aria-label="Settings"
            onClick={this.handleOnOpen}
            onKeyDown={this.handleKeyPress}
            ref={this.focusedRef}
        >
            <img src={settingsIcon} />
            <span className={styles.dropdownLabel}>
                <FormattedMessage
                    defaultMessage="Settings"
                    description="Settings menu"
                    id="gui.menuBar.settings"
                />
            </span>
            <img src={dropdownCaret} />
            <MenuBarMenu
                className={menuBarStyles.menuBarMenu}
                open={this.context.isOpenMenu(this.props.focusedRef)}
                place={isRtl ? 'left' : 'right'}
                onClose={this.handleOnClose}
            >
                <MenuSection>
                    {canChangeLanguage && <LanguageMenu
                        focusedRef={this.languageRef}
                        depth={2}
                    />}
                    {canChangeTheme && <ThemeMenu
                        focusedRef={this.themeRef}
                        depth={2}
                    />}
                </MenuSection>
            </MenuBarMenu>
        </div>);
    }
};

SettingsMenu.propTypes = {
    canChangeLanguage: PropTypes.bool,
    canChangeTheme: PropTypes.bool,
    isRtl: PropTypes.bool,
    settingsMenuOpen: PropTypes.bool
};

export default SettingsMenu;
