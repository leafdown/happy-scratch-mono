import 'web-audio-test-api';

import React from 'react';
import configureStore from 'redux-mock-store';
import {renderWithIntl} from '../../helpers/intl-helpers.jsx';
import {LoadingState} from '../../../src/reducers/project-state';
import VM from '@scratch/scratch-vm';

import SBFileUploaderHOC from '../../../src/lib/sb-file-uploader-hoc.jsx';
import {IntlProvider} from 'react-intl';

describe('SBFileUploaderHOC', () => {
    const mockStore = configureStore();
    let store;
    let vm;

    // Wrap this in a function so it gets test specific states and can be reused.
    const getContainer = function () {
        const Component = () => <div />;
        return SBFileUploaderHOC(Component);
    };

    const unwrappedInstance = () => {
        const WrappedComponent = getContainer();
        // default starting state: looking at a project you created, not logged in
        const wrapper = renderWithIntl(
            <WrappedComponent
                projectChanged
                canSave={false}
                cancelFileUpload={jest.fn()}
                closeFileMenu={jest.fn()}
                requestProjectUpload={jest.fn()}
                userOwnsProject={false}
                vm={vm}
                onLoadingFinished={jest.fn()}
                onLoadingStarted={jest.fn()}
                onUpdateProjectTitle={jest.fn()}
                store={store}
            />
        );
        return wrapper;
    };

    beforeEach(() => {
        vm = new VM();
        store = mockStore({
            scratchGui: {
                projectState: {
                    loadingState: LoadingState.SHOWING_WITHOUT_ID
                },
                vm: {}
            },
            locales: {
                locale: 'en'
            }
        });
    });

    test('if isLoadingUpload becomes true, without fileToUpload set, will call cancelFileUpload', () => {
        const mockedCancelFileUpload = jest.fn();
        const WrappedComponent = getContainer();
        const {rerender} = renderWithIntl(
            <WrappedComponent
                projectChanged
                canSave={false}
                cancelFileUpload={mockedCancelFileUpload}
                closeFileMenu={jest.fn()}
                isLoadingUpload={false}
                requestProjectUpload={jest.fn()}
                store={store}
                userOwnsProject={false}
                vm={vm}
                onLoadingFinished={jest.fn()}
                onLoadingStarted={jest.fn()}
                onUpdateProjectTitle={jest.fn()}
            />
        );
        rerender(
            <IntlProvider
                locale="en"
                messages={{ }}
            >
                <WrappedComponent
                    projectChanged
                    canSave={false}
                    cancelFileUpload={mockedCancelFileUpload}
                    closeFileMenu={jest.fn()}
                    isLoadingUpload
                    requestProjectUpload={jest.fn()}
                    store={store}
                    userOwnsProject={false}
                    vm={vm}
                    onLoadingFinished={jest.fn()}
                    onLoadingStarted={jest.fn()}
                    onUpdateProjectTitle={jest.fn()}
                />
            </IntlProvider>
        );
        expect(mockedCancelFileUpload).toHaveBeenCalled();
    });

    test('calls onBeforeProjectUpload after a file is selected and before uploading', () => {
        const onBeforeProjectUpload = jest.fn(() => true);
        const requestProjectUpload = jest.fn();
        const Component = ({onStartSelectingFileUpload}) => (
            <button onClick={onStartSelectingFileUpload}>Choose file</button>
        );
        const WrappedComponent = SBFileUploaderHOC(Component);
        const {getByText} = renderWithIntl(
            <WrappedComponent
                canSave={false}
                cancelFileUpload={jest.fn()}
                closeFileMenu={jest.fn()}
                loadingState={LoadingState.SHOWING_WITHOUT_ID}
                onBeforeProjectUpload={onBeforeProjectUpload}
                onLoadingFinished={jest.fn()}
                onLoadingStarted={jest.fn()}
                projectChanged={false}
                requestProjectUpload={requestProjectUpload}
                store={store}
                userOwnsProject={false}
                vm={vm}
            />
        );

        getByText('Choose file').click();
        const input = document.querySelector('input[type="file"]');
        Object.defineProperty(input, 'files', {
            value: [new File(['project'], 'project.sb3')]
        });
        input.dispatchEvent(new Event('change'));

        expect(onBeforeProjectUpload).toHaveBeenCalledTimes(1);
        expect(requestProjectUpload).toHaveBeenCalledWith(LoadingState.SHOWING_WITHOUT_ID);
    });

    test('does not upload when onBeforeProjectUpload returns false', () => {
        const requestProjectUpload = jest.fn();
        const onBeforeProjectUpload = jest.fn(() => false);
        const Component = ({onStartSelectingFileUpload}) => (
            <button onClick={onStartSelectingFileUpload}>Choose file</button>
        );
        const WrappedComponent = SBFileUploaderHOC(Component);
        const {getByText} = renderWithIntl(
            <WrappedComponent
                canSave={false}
                cancelFileUpload={jest.fn()}
                closeFileMenu={jest.fn()}
                loadingState={LoadingState.SHOWING_WITHOUT_ID}
                onBeforeProjectUpload={onBeforeProjectUpload}
                onLoadingFinished={jest.fn()}
                onLoadingStarted={jest.fn()}
                projectChanged={false}
                requestProjectUpload={requestProjectUpload}
                store={store}
                userOwnsProject={false}
                vm={vm}
            />
        );

        getByText('Choose file').click();
        const input = document.querySelector('input[type="file"]');
        Object.defineProperty(input, 'files', {
            value: [new File(['project'], 'project.sb3')]
        });
        input.dispatchEvent(new Event('change'));

        expect(onBeforeProjectUpload).toHaveBeenCalledTimes(1);
        expect(requestProjectUpload).not.toHaveBeenCalled();
        expect(document.querySelector('input[type="file"]')).toBe(null);
    });

    test('does not fire the upload hook when the file picker is dismissed', () => {
        const onBeforeProjectUpload = jest.fn(() => true);
        const requestProjectUpload = jest.fn();
        const Component = ({onStartSelectingFileUpload}) => (
            <button onClick={onStartSelectingFileUpload}>Choose file</button>
        );
        const WrappedComponent = SBFileUploaderHOC(Component);
        const {getByText} = renderWithIntl(
            <WrappedComponent
                canSave={false}
                cancelFileUpload={jest.fn()}
                closeFileMenu={jest.fn()}
                loadingState={LoadingState.SHOWING_WITHOUT_ID}
                onBeforeProjectUpload={onBeforeProjectUpload}
                onLoadingFinished={jest.fn()}
                onLoadingStarted={jest.fn()}
                projectChanged={false}
                requestProjectUpload={requestProjectUpload}
                store={store}
                userOwnsProject={false}
                vm={vm}
            />
        );

        getByText('Choose file').click();
        const input = document.querySelector('input[type="file"]');
        Object.defineProperty(input, 'files', {value: []});
        input.dispatchEvent(new Event('change'));

        expect(onBeforeProjectUpload).not.toHaveBeenCalled();
        expect(requestProjectUpload).not.toHaveBeenCalled();
        expect(document.querySelector('input[type="file"]')).toBe(null);
    });
});
