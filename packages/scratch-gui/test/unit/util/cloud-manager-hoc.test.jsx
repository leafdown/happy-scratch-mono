import 'web-audio-test-api';

import React from 'react';
import configureStore from 'redux-mock-store';
import VM from '@scratch/scratch-vm';
import {LoadingState} from '../../../src/reducers/project-state';
import CloudProvider from '../../../src/lib/cloud-provider';
import {render} from '@testing-library/react';
import {legacyConfig} from '../../../src/legacy-config';

const mockCloudProviderInstance = {
    connection: true,
    isConnectedOrConnecting () {
        return !!this.connection;
    },
    requestCloseConnection: jest.fn()
};
jest.mock('../../../src/lib/cloud-provider', () =>
    jest.fn().mockImplementation(() => mockCloudProviderInstance)
);

import cloudManagerHOC from '../../../src/lib/cloud-manager-hoc.jsx';

describe('CloudManagerHOC', () => {
    const mockStore = configureStore();
    let store;
    let vm;
    let stillLoadingStore;

    beforeEach(() => {
        store = mockStore({
            scratchGui: {
                config: legacyConfig,
                projectState: {
                    projectId: '1234',
                    loadingState: LoadingState.SHOWING_WITH_ID
                },
                mode: {
                    hasEverEnteredEditor: false
                }
            }
        });
        stillLoadingStore = mockStore({
            scratchGui: {
                config: legacyConfig,
                projectState: {
                    projectId: '1234',
                    loadingState: LoadingState.LOADING_WITH_ID
                },
                mode: {
                    hasEverEnteredEditor: false
                }
            }
        });
        vm = new VM();
        vm.setCloudProvider = jest.fn();
        vm.runtime = {
            hasCloudData: jest.fn(() => true)
        };
        vm.extensionManager = {
            isExtensionLoaded: jest.fn(() => false)
        };
        CloudProvider.mockClear();
        mockCloudProviderInstance.requestCloseConnection.mockClear();
    });
    test('when it mounts, the cloud provider is set on the vm', () => {
        const Component = () => (<div />);
        const WrappedComponent = cloudManagerHOC(Component);
        const onShowCloudInfo = jest.fn();

        render(
            <WrappedComponent
                hasCloudPermission
                cloudHost="nonEmpty"
                store={store}
                username="user"
                vm={vm}
                onShowCloudInfo={onShowCloudInfo}
            />
        );
        expect(vm.setCloudProvider.mock.calls.length).toBe(1);
        expect(CloudProvider).toHaveBeenCalledTimes(1);
        expect(vm.setCloudProvider).toHaveBeenCalledWith(mockCloudProviderInstance);
        expect(onShowCloudInfo).not.toHaveBeenCalled();
    });

    test('when cloudHost is missing, the cloud provider is not set on the vm', () => {
        const Component = () => (<div />);
        const WrappedComponent = cloudManagerHOC(Component);
        render(
            <WrappedComponent
                hasCloudPermission
                store={store}
                username="user"
                vm={vm}
            />
        );
        expect(vm.setCloudProvider.mock.calls.length).toBe(0);
        expect(CloudProvider).not.toHaveBeenCalled();

    });

    test('when projectID is missing, the cloud provider is not set on the vm', () => {

        const Component = () => (<div />);
        const WrappedComponent = cloudManagerHOC(Component);
        render(
            <WrappedComponent
                hasCloudPermission
                cloudHost="nonEmpty"
                store={store}
                vm={vm}
            />
        );
        expect(vm.setCloudProvider.mock.calls.length).toBe(0);
        expect(CloudProvider).not.toHaveBeenCalled();
    });

    test('when project is not showingWithId, the cloud provider is not set on the vm', () => {

        const Component = () => (<div />);
        const WrappedComponent = cloudManagerHOC(Component);
        render(
            <WrappedComponent
                hasCloudPermission
                cloudHost="nonEmpty"
                store={stillLoadingStore}
                username="user"
                vm={vm}
            />
        );
        expect(vm.setCloudProvider.mock.calls.length).toBe(0);
        expect(CloudProvider).not.toHaveBeenCalled();
    });

    test('when hasCloudPermission is false, the cloud provider is not set on the vm', () => {
        const Component = () => <div />;
        const WrappedComponent = cloudManagerHOC(Component);
        render(
            <WrappedComponent
                cloudHost="nonEmpty"
                hasCloudPermission={false}
                store={store}
                username="user"
                vm={vm}
            />
        );

        expect(vm.setCloudProvider.mock.calls.length).toBe(0);
        expect(CloudProvider).not.toHaveBeenCalled();
    });

    test('when videoSensing extension is active, the cloud provider is not set on the vm', () => {
        const Component = () => <div />;
        const WrappedComponent = cloudManagerHOC(Component);
        vm.extensionManager.isExtensionLoaded = jest.fn(extension => extension === 'videoSensing');

        render(
            <WrappedComponent
                hasCloudPermission
                cloudHost="nonEmpty"
                store={store}
                username="user"
                vm={vm}
            />
        );

        expect(vm.setCloudProvider.mock.calls.length).toBe(0);
        expect(CloudProvider).not.toHaveBeenCalled();
    });

    test('when faceSensing extension is active, the cloud provider is not set on the vm', () => {
        const Component = () => <div />;
        const WrappedComponent = cloudManagerHOC(Component);
        vm.extensionManager.isExtensionLoaded = jest.fn(extension => extension === 'faceSensing');

        render(
            <WrappedComponent
                hasCloudPermission
                cloudHost="nonEmpty"
                store={store}
                username="user"
                vm={vm}
            />
        );

        expect(vm.setCloudProvider.mock.calls.length).toBe(0);
        expect(CloudProvider).not.toHaveBeenCalled();
    });

    test('if the isShowingWithId prop becomes true, it sets the cloud provider on the vm', () => {
        const Component = () => <div />;
        const WrappedComponent = cloudManagerHOC(Component);
        const onShowCloudInfo = jest.fn();
        vm.runtime.hasCloudData = jest.fn(() => false);

        const {rerender} = render(
            <WrappedComponent
                hasCloudPermission
                cloudHost="nonEmpty"
                store={stillLoadingStore}
                username="user"
                vm={vm}
                onShowCloudInfo={onShowCloudInfo}
            />
        );
        expect(onShowCloudInfo).not.toHaveBeenCalled();

        vm.runtime.hasCloudData = jest.fn(() => true);
        vm.emit('HAS_CLOUD_DATA_UPDATE', true);

        rerender(
            <WrappedComponent
                hasCloudPermission
                cloudHost="nonEmpty"
                store={stillLoadingStore}
                username="user"
                vm={vm}
                onShowCloudInfo={onShowCloudInfo}
                isShowingWithId
                loadingState={LoadingState.SHOWING_WITH_ID}
            />
        );
        expect(vm.setCloudProvider.mock.calls.length).toBe(1);
        expect(CloudProvider).toHaveBeenCalledTimes(1);
        expect(vm.setCloudProvider).toHaveBeenCalledWith(mockCloudProviderInstance);
        expect(onShowCloudInfo).not.toHaveBeenCalled();
    });

    test('projectId change should not trigger cloudProvider connection unless isShowingWithId becomes true', () => {
        const Component = () => <div />;
        const WrappedComponent = cloudManagerHOC(Component);
        const {rerender} = render(
            <WrappedComponent
                hasCloudPermission
                cloudHost="nonEmpty"
                store={stillLoadingStore}
                username="user"
                vm={vm}
            />
        );

        rerender(
            <WrappedComponent
                hasCloudPermission
                cloudHost="nonEmpty"
                store={stillLoadingStore}
                username="user"
                vm={vm}
                projectId="a different id"
            />
        );

        expect(vm.setCloudProvider.mock.calls.length).toBe(0);
        expect(CloudProvider).not.toHaveBeenCalled();

        rerender(
            <WrappedComponent
                hasCloudPermission
                cloudHost="nonEmpty"
                store={stillLoadingStore}
                username="user"
                vm={vm}
                projectId="a different id"
                isShowingWithId
                loadingState={LoadingState.SHOWING_WITH_ID}
            />
        );

        expect(vm.setCloudProvider.mock.calls.length).toBe(1);
        expect(CloudProvider).toHaveBeenCalledTimes(1);
        expect(vm.setCloudProvider).toHaveBeenCalledWith(mockCloudProviderInstance);
    });

    test('when it unmounts, the cloud provider is reset to null on the vm', () => {
        const Component = () => (<div />);
        const WrappedComponent = cloudManagerHOC(Component);
        const {unmount} = render(
            <WrappedComponent
                hasCloudPermission
                cloudHost="nonEmpty"
                store={store}
                username="user"
                vm={vm}
            />
        );

        expect(CloudProvider).toHaveBeenCalled();
        const requestCloseConnection = mockCloudProviderInstance.requestCloseConnection;

        unmount();

        // vm.setCloudProvider is called twice,
        // once during mount and once during unmount
        expect(vm.setCloudProvider.mock.calls.length).toBe(2);
        expect(vm.setCloudProvider).toHaveBeenCalledWith(null);
        expect(requestCloseConnection).toHaveBeenCalledTimes(1);
    });

    test('projectId changing should trigger cloudProvider disconnection', () => {
        const Component = () => <div />;
        const WrappedComponent = cloudManagerHOC(Component);
        const {rerender} = render(
            <WrappedComponent
                hasCloudPermission
                cloudHost="nonEmpty"
                store={store}
                username="user"
                vm={vm}
            />
        );

        expect(CloudProvider).toHaveBeenCalled();
        const requestCloseConnection = mockCloudProviderInstance.requestCloseConnection;

        rerender(
            <WrappedComponent
                hasCloudPermission
                cloudHost="nonEmpty"
                store={store}
                username="user"
                vm={vm}
                projectId="a different id"
            />
        );

        expect(vm.setCloudProvider.mock.calls.length).toBe(3);
        expect(vm.setCloudProvider).toHaveBeenNthCalledWith(2, null);
        expect(requestCloseConnection).toHaveBeenCalledTimes(1);
        expect(CloudProvider).toHaveBeenCalledTimes(2);
    });

    test('username changing should trigger cloudProvider disconnection', () => {
        const Component = () => <div />;
        const WrappedComponent = cloudManagerHOC(Component);
        const {rerender} = render(
            <WrappedComponent
                hasCloudPermission
                cloudHost="nonEmpty"
                store={store}
                username="user"
                vm={vm}
            />
        );

        expect(CloudProvider).toHaveBeenCalled();
        const requestCloseConnection = mockCloudProviderInstance.requestCloseConnection;

        rerender(
            <WrappedComponent
                hasCloudPermission
                cloudHost="nonEmpty"
                store={store}
                username="a different user"
                vm={vm}
            />
        );

        expect(vm.setCloudProvider.mock.calls.length).toBe(3);
        expect(vm.setCloudProvider).toHaveBeenNthCalledWith(2, null);
        expect(requestCloseConnection).toHaveBeenCalledTimes(1);
        expect(CloudProvider).toHaveBeenCalledTimes(2);
    });

    test('projectId changing while cloud data appears connects only once', () => {
        vm.runtime.hasCloudData = jest.fn(() => false);

        const Component = () => <div />;
        const WrappedComponent = cloudManagerHOC(Component);
        const {rerender} = render(
            <WrappedComponent
                hasCloudPermission
                cloudHost="nonEmpty"
                projectId="old-id"
                store={store}
                username="user"
                vm={vm}
            />
        );

        expect(CloudProvider).not.toHaveBeenCalled();

        vm.runtime.hasCloudData = jest.fn(() => true);
        rerender(
            <WrappedComponent
                hasCloudPermission
                cloudHost="nonEmpty"
                projectId="new-id"
                store={store}
                username="user"
                vm={vm}
            />
        );

        expect(CloudProvider).toHaveBeenCalledTimes(1);
        expect(vm.setCloudProvider).toHaveBeenCalledTimes(1);
    });

    test('project without cloud data should not trigger cloud connection', () => {
        // Mock the vm runtime function so that has cloud data is not
        // initially true
        vm.runtime.hasCloudData = jest.fn(() => false);

        const Component = () => <div />;
        const WrappedComponent = cloudManagerHOC(Component);
        render(
            <WrappedComponent
                hasCloudPermission
                cloudHost="nonEmpty"
                store={store}
                username="user"
                vm={vm}
            />
        );
        expect(vm.setCloudProvider.mock.calls.length).toBe(0);
        expect(CloudProvider).not.toHaveBeenCalled();
    });

    test('projectHasCloudData becoming true should trigger a cloud connection', () => {
        // Mock the vm runtime function so that has cloud data is not
        // initially true
        vm.runtime.hasCloudData = jest.fn(() => false);
        const onShowCloudInfo = jest.fn();

        const Component = () => <div />;
        const WrappedComponent = cloudManagerHOC(Component);
        render(
            <WrappedComponent
                hasCloudPermission
                cloudHost="nonEmpty"
                store={store}
                username="user"
                vm={vm}
                onShowCloudInfo={onShowCloudInfo}
            />
        );
        expect(vm.setCloudProvider.mock.calls.length).toBe(0);
        expect(CloudProvider).not.toHaveBeenCalled();
        expect(onShowCloudInfo).not.toHaveBeenCalled();

        // Mock VM hasCloudData becoming true and emitting an update
        vm.runtime.hasCloudData = jest.fn(() => true);
        vm.emit('HAS_CLOUD_DATA_UPDATE', true);

        expect(vm.setCloudProvider.mock.calls.length).toBe(1);
        expect(CloudProvider).toHaveBeenCalledTimes(1);
        expect(vm.setCloudProvider).toHaveBeenCalledWith(mockCloudProviderInstance);
        expect(onShowCloudInfo).toHaveBeenCalled();
    });

    test('projectHasCloudDataUpdate becoming false should trigger cloudProvider disconnection', () => {
        const Component = () => <div />;
        const WrappedComponent = cloudManagerHOC(Component);
        render(
            <WrappedComponent
                hasCloudPermission
                cloudHost="nonEmpty"
                store={store}
                username="user"
                vm={vm}
            />
        );

        expect(CloudProvider).toHaveBeenCalled();
        const requestCloseConnection = mockCloudProviderInstance.requestCloseConnection;

        vm.runtime.hasCloudData = jest.fn(() => false);
        vm.emit('HAS_CLOUD_DATA_UPDATE', false);

        expect(vm.setCloudProvider.mock.calls.length).toBe(2);
        expect(vm.setCloudProvider).toHaveBeenCalledWith(null);
        expect(requestCloseConnection).toHaveBeenCalledTimes(1);
    });

    // Editor Mode Connection/Disconnection Tests
    test('Entering editor mode and can\'t save project should disconnect cloud provider', () => {
        const Component = () => <div />;
        const WrappedComponent = cloudManagerHOC(Component);
        const {rerender} = render(
            <WrappedComponent
                hasCloudPermission
                cloudHost="nonEmpty"
                store={store}
                username="user"
                vm={vm}
            />
        );

        expect(CloudProvider).toHaveBeenCalled();
        const requestCloseConnection = mockCloudProviderInstance.requestCloseConnection;

        rerender(
            <WrappedComponent
                hasCloudPermission
                cloudHost="nonEmpty"
                store={store}
                username="user"
                vm={vm}
                canModifyCloudData={false}
            />
        );

        expect(vm.setCloudProvider.mock.calls.length).toBe(2);
        expect(vm.setCloudProvider).toHaveBeenCalledWith(null);
        expect(requestCloseConnection).toHaveBeenCalledTimes(1);
    });

    describe('cloudControl', () => {
        const Component = () => <div />;

        test('projectId connects before isShowingWithId becomes true', () => {
            const WrappedComponent = cloudManagerHOC(Component);
            render(
                <WrappedComponent
                    hasCloudPermission
                    cloudControl={{projectId: 'work-1'}}
                    cloudHost="nonEmpty"
                    store={stillLoadingStore}
                    username="user"
                    vm={vm}
                />
            );

            expect(CloudProvider).toHaveBeenCalledTimes(1);
            expect(CloudProvider.mock.calls[0][3]).toBe('work-1');
            expect(vm.setCloudProvider).toHaveBeenCalledWith(mockCloudProviderInstance);
        });

        test('disabled cloudControl prevents connection', () => {
            const WrappedComponent = cloudManagerHOC(Component);
            render(
                <WrappedComponent
                    hasCloudPermission
                    cloudControl={{enabled: false, projectId: 'work-1'}}
                    cloudHost="nonEmpty"
                    store={store}
                    username="user"
                    vm={vm}
                />
            );

            expect(CloudProvider).not.toHaveBeenCalled();
            expect(vm.setCloudProvider).not.toHaveBeenCalled();
        });

        test('canWrite false still connects but hides cloud use from the GUI', () => {
            const Child = jest.fn(() => <div />);
            const WrappedComponent = cloudManagerHOC(Child);
            render(
                <WrappedComponent
                    hasCloudPermission
                    cloudControl={{canWrite: false, projectId: 'work-1'}}
                    cloudHost="nonEmpty"
                    store={store}
                    username="user"
                    vm={vm}
                />
            );

            expect(CloudProvider).toHaveBeenCalledTimes(1);
            expect(Child.mock.calls[0][0].canUseCloud).toBe(false);
        });

        test('canModifyCloudData override connects in editor mode', () => {
            const editorStore = mockStore({
                scratchGui: {
                    config: legacyConfig,
                    projectState: {
                        projectId: '1234',
                        loadingState: LoadingState.SHOWING_WITH_ID
                    },
                    mode: {
                        hasEverEnteredEditor: true
                    }
                }
            });
            const WrappedComponent = cloudManagerHOC(Component);
            render(
                <WrappedComponent
                    hasCloudPermission
                    cloudControl={{canModifyCloudData: true, projectId: 'work-1'}}
                    cloudHost="nonEmpty"
                    store={editorStore}
                    username="user"
                    vm={vm}
                />
            );

            expect(CloudProvider).toHaveBeenCalledTimes(1);
        });

        test('video sensing still prevents connection even with canModifyCloudData', () => {
            vm.extensionManager.isExtensionLoaded = jest.fn(extension => extension === 'videoSensing');
            const WrappedComponent = cloudManagerHOC(Component);
            render(
                <WrappedComponent
                    hasCloudPermission
                    cloudControl={{canModifyCloudData: true, projectId: 'work-1'}}
                    cloudHost="nonEmpty"
                    store={store}
                    username="user"
                    vm={vm}
                />
            );

            expect(CloudProvider).not.toHaveBeenCalled();
        });

        test('projectId change disconnects and reconnects', () => {
            const WrappedComponent = cloudManagerHOC(Component);
            const {rerender} = render(
                <WrappedComponent
                    hasCloudPermission
                    cloudControl={{projectId: 'work-1'}}
                    cloudHost="nonEmpty"
                    store={stillLoadingStore}
                    username="user"
                    vm={vm}
                />
            );

            expect(CloudProvider).toHaveBeenCalledTimes(1);
            const requestCloseConnection = mockCloudProviderInstance.requestCloseConnection;

            rerender(
                <WrappedComponent
                    hasCloudPermission
                    cloudControl={{projectId: 'work-2'}}
                    cloudHost="nonEmpty"
                    store={stillLoadingStore}
                    username="user"
                    vm={vm}
                />
            );

            expect(requestCloseConnection).toHaveBeenCalledTimes(1);
            expect(CloudProvider).toHaveBeenCalledTimes(2);
            expect(CloudProvider.mock.calls[1][3]).toBe('work-2');
        });
    });
});
