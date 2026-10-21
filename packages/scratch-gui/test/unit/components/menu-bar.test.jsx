import React from 'react';
import {renderWithIntl} from '../../helpers/intl-helpers.jsx';
import MenuBar from '../../../src/components/menu-bar/menu-bar';
import {menuInitialState} from '../../../src/reducers/menus';
import {openTipsLibrary} from '../../../src/reducers/modals';
import {LoadingState} from '../../../src/reducers/project-state';
import {DEFAULT_MODE} from '../../../src/lib/settings/color-mode';
import {fireEvent} from '@testing-library/react';

import {PLATFORM} from '../../../src/lib/platform';

import configureStore from 'redux-mock-store';
import {Provider} from 'react-redux';
import VM from '@scratch/scratch-vm';
import {MenuRefProvider} from '../../../src/contexts/menu-ref-context.jsx';

describe('MenuBar Component', () => {
    const store = configureStore()({
        locales: {
            isRtl: false,
            locale: 'en-US'
        },
        scratchGui: {
            menus: menuInitialState,
            projectState: {
                loadingState: LoadingState.NOT_LOADED
            },
            settings: {
                colorMode: DEFAULT_MODE
            },
            timeTravel: {
                year: 'NOW'
            },
            restoreDeletion: {
                deletedItem: null
            },
            vm: new VM(),
            platform: {
                platform: PLATFORM.WEB
            }
        }
    });

    const getComponent = function (props = {}) {
        return (<Provider store={store}>
            <MenuRefProvider>
                <MenuBar {...props} />
            </MenuRefProvider>
        </Provider>);
    };

    test('menu bar with no About handler has no About button', () => {
        const {container} = renderWithIntl(getComponent());
        const button = container.querySelector('button[aria-label="About menu"]');
        expect(button).toBeFalsy();
    });

    test('menu bar with an About handler has an About button', () => {
        const onClickAbout = jest.fn();
        const {container} = renderWithIntl(getComponent({onClickAbout}));
        const button = container.querySelector('button[aria-label="About menu"]');
        expect(button).toBeTruthy();
    });

    describe('triggering About button handler', () => {
        test('clicking on About button calls the handler', () => {
            const onClickAbout = jest.fn();
            const {container} = renderWithIntl(getComponent({onClickAbout}));
            const button = container.querySelector('button[aria-label="About menu"]');
    
            fireEvent.click(button);
            expect(onClickAbout).toHaveBeenCalledTimes(1);
        });
    
        test('not clicking on About button does not call the handler', () => {
            const onClickAbout = jest.fn();
            const {container} = renderWithIntl(getComponent({onClickAbout}));
            const button = container.querySelector('button[aria-label="About menu"]');
    
            expect(onClickAbout).toHaveBeenCalledTimes(0);
        });
    });

    describe('new project hook', () => {
        test('calls onBeforeNewProject before creating a new project', () => {
            const onBeforeNewProject = jest.fn(() => true);
            const actionCount = store.getActions().length;
            const {getByLabelText, getByText} = renderWithIntl(getComponent({
                canManageFiles: true,
                confirmReadyToReplaceProject: () => true,
                onBeforeNewProject
            }));

            fireEvent.click(getByLabelText('File menu'));
            fireEvent.click(getByText('New'));

            expect(onBeforeNewProject).toHaveBeenCalledTimes(1);
            expect(store.getActions().slice(actionCount)).toContainEqual(
                expect.objectContaining({type: 'scratch-gui/project-state/START_FETCHING_NEW'})
            );
        });

        test('does not create a new project when onBeforeNewProject returns false', () => {
            const onBeforeNewProject = jest.fn(() => false);
            const actionCount = store.getActions().length;
            const {getByLabelText, getByText} = renderWithIntl(getComponent({
                canManageFiles: true,
                confirmReadyToReplaceProject: () => true,
                onBeforeNewProject
            }));

            fireEvent.click(getByLabelText('File menu'));
            fireEvent.click(getByText('New'));

            expect(onBeforeNewProject).toHaveBeenCalledTimes(1);
            expect(store.getActions().length).toBe(actionCount);
        });
    });

    describe('menu visibility', () => {
        test('hides the New item when showNewButton is false', () => {
            const onClickNew = jest.fn();
            const {getByLabelText, queryByText} = renderWithIntl(getComponent({
                canManageFiles: true,
                onClickNew,
                showNewButton: false
            }));

            fireEvent.click(getByLabelText('File menu'));
            expect(queryByText('New')).toBeNull();
            expect(onClickNew).not.toHaveBeenCalled();
        });

        test('hides loading and saving when those file buttons are disabled', () => {
            const {getByLabelText, queryByText} = renderWithIntl(getComponent({
                canManageFiles: true,
                showLoadButton: false,
                showSaveButton: false
            }));

            fireEvent.click(getByLabelText('File menu'));
            expect(queryByText('Load from computer')).toBeNull();
            expect(queryByText('Save to your computer')).toBeNull();
        });

        test('hides the turbo mode item when showTurboModeButton is false', () => {
            const {getByLabelText, queryByText} = renderWithIntl(getComponent({
                showTurboModeButton: false
            }));

            fireEvent.click(getByLabelText('Edit menu'));
            expect(queryByText('Turn on Turbo Mode')).toBeNull();
            expect(queryByText('Turn off Turbo Mode')).toBeNull();
        });

        test('hides the logo when showLogo is false', () => {
            const {container} = renderWithIntl(getComponent({showLogo: false}));
            expect(container.querySelector('#logo_img')).toBeNull();
        });
    });

    describe('tutorials hook', () => {
        test('does not open the tutorial library when onBeforeHelp returns false', () => {
            const onBeforeHelp = jest.fn(() => false);
            const actionCount = store.getActions().length;
            const {getByLabelText} = renderWithIntl(getComponent({onBeforeHelp}));

            fireEvent.click(getByLabelText('Tutorials'));
            expect(onBeforeHelp).toHaveBeenCalledTimes(1);
            expect(store.getActions().slice(actionCount)).not.toContainEqual(openTipsLibrary());
        });

        test('opens the tutorial library when onBeforeHelp allows it', () => {
            const onBeforeHelp = jest.fn(() => true);
            const actionCount = store.getActions().length;
            const {getByLabelText} = renderWithIntl(getComponent({onBeforeHelp}));

            fireEvent.click(getByLabelText('Tutorials'));
            expect(onBeforeHelp).toHaveBeenCalledTimes(1);
            expect(store.getActions().slice(actionCount)).toContainEqual(openTipsLibrary());
        });
    });

    describe('account menu', () => {
        test('uses the avatar click override instead of opening the menu', () => {
            const onClick = jest.fn();
            const {getByLabelText} = renderWithIntl(getComponent({
                accountMenuOptions: {
                    canHaveSession: true,
                    avatarUrl: '//cdn/avatar.png',
                    onClick
                },
                username: 'student'
            }));

            fireEvent.click(getByLabelText('Account menu'));
            expect(onClick).toHaveBeenCalledTimes(1);
        });
    });
});
