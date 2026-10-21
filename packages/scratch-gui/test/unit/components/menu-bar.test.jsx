import React from 'react';
import {renderWithIntl} from '../../helpers/intl-helpers.jsx';
import MenuBar from '../../../src/components/menu-bar/menu-bar';
import {menuInitialState} from '../../../src/reducers/menus';
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
});
