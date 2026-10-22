/**
 * @jest-environment jsdom
 */
const {LanquCloudProvider} = require('../src/storage/lanqu-cloud-provider.js');

describe('LanquCloudProvider status events', () => {
    let statuses;
    let fakeSocket;

    class FakeWebSocket {
        constructor () {
            this.readyState = 0; // CONNECTING
            fakeSocket = this;
        }
        close () {
            this.readyState = 3; // CLOSED
        }
        send () {}
    }

    beforeEach(() => {
        statuses = [];
        fakeSocket = null;
        global.WebSocket = FakeWebSocket;
        global.window = {setTimeout};
    });

    afterEach(() => {
        delete global.WebSocket;
        delete global.window;
    });

    const createProvider = () => new LanquCloudProvider({
        cloudHost: '//cloud.lanqu.vip',
        username: 'anon',
        projectId: 'p1',
        token: '',
        onStatusChange: s => statuses.push(s)
    });

    it('reports connecting, then connected, then disconnected on state transitions', () => {
        const provider = createProvider();
        expect(statuses).toEqual(['connecting']);

        // The socket opened.
        fakeSocket.readyState = 1; // OPEN
        provider.onOpen();
        expect(statuses).toEqual(['connecting', 'connected']);

        // Socket dropped; onClose re-schedules a reconnect but reports first.
        provider.onClose();
        expect(statuses).toEqual(['connecting', 'connected', 'disconnected']);

        // requestCloseConnection must not leak a further disconnected status.
        provider.requestCloseConnection();
        provider.onClose();
        expect(statuses).toEqual(['connecting', 'connected', 'disconnected']);

        provider.clear();
    });

    it('reports error when the websocket errors while trying to connect', () => {
        const provider = createProvider();
        fakeSocket.readyState = 3;
        provider.onError(new Event('error'));
        expect(statuses).toContain('error');
    });

    it('does not re-report a repeated status', () => {
        const provider = createProvider();
        fakeSocket.readyState = 1;
        provider.onOpen();
        fakeSocket.readyState = 1;
        provider.onOpen();
        expect(statuses).toEqual(['connecting', 'connected']);
        provider.clear();
    });
});
