/**
 * Lanqu cloud variable provider — adapts the Lanqu WebSocket cloud protocol to
 * scratch-gui v14's GUICloudVariableProvider interface.
 *
 * Protocol (compatible with v14 message methods, differs in auth):
 *   - v14 auth:   WebSocket subprotocol `bearer!${token}`
 *   - Lanqu auth: token/user/project_id carried in the message body
 *
 * Message methods: handshake / create / set / rename / delete
 *
 * This is a port of easy-scratch3/src/lib/cloud-provider.js, adapted to the v14
 * interface (adds isConnectedOrConnecting). Real backend verification is deferred
 * to stage 2; the structure is complete but untested against the live server.
 */
import throttle from 'lodash.throttle';

const log = {
    info: (...args) => console.info('[lanqu-cloud]', ...args), // eslint-disable-line no-console
    warn: (...args) => console.warn('[lanqu-cloud]', ...args), // eslint-disable-line no-console
    error: (...args) => console.error('[lanqu-cloud]', ...args) // eslint-disable-line no-console
};

class LanquCloudProvider {
    constructor ({cloudHost, vm, username, projectId, token, cloudId}) {
        this.vm = vm;
        this.username = username || '';
        this.projectId = projectId || cloudId || '';
        this.cloudHost = cloudHost;
        this.token = token || '';

        this.connectionAttempts = 0;
        this.queuedData = [];
        this.isTryingToConnect = true;
        this.connection = null;
        this._connectionTimeout = null;

        this.openConnection();

        // Rate limit to 10 messages/sec, matching v14.
        this.sendCloudData = throttle(this._sendCloudData, 100);
    }

    isConnectedOrConnecting () {
        return this.isTryingToConnect || !!this.connection;
    }

    openConnection () {
        this.connectionAttempts += 1;
        try {
            this.connection = new WebSocket(
                (location.protocol === 'http:' ? 'ws://' : 'wss://') + this.cloudHost
            );
        } catch (e) {
            log.warn('Websocket support is not available in this browser', e);
            this.isTryingToConnect = false;
            this.connection = null;
            return;
        }
        this.connection.onerror = this.onError.bind(this);
        this.connection.onmessage = this.onMessage.bind(this);
        this.connection.onopen = this.onOpen.bind(this);
        this.connection.onclose = this.onClose.bind(this);
    }

    onError (event) {
        log.error(`Websocket connection error: ${JSON.stringify(event)}`);
    }

    onMessage (event) {
        const messageString = event.data;
        messageString.split('\n').forEach(message => {
            if (message) {
                const parsedData = this.parseMessage(JSON.parse(message));
                if (this.vm) this.vm.postIOData('cloud', parsedData);
            }
        });
    }

    onOpen () {
        this.connectionAttempts = 1;
        this.writeToServer('handshake');
        log.info('Successfully connected to clouddata server.');
        this.queuedData.forEach(data => this.sendCloudData(data));
        this.queuedData = [];
    }

    onClose () {
        log.info('Closed connection to websocket');
        const randomizedTimeout = this.randomizeDuration(this.exponentialTimeout());
        this.setTimeout(this.openConnection.bind(this), randomizedTimeout);
    }

    exponentialTimeout () {
        return (Math.pow(2, Math.min(this.connectionAttempts, 5)) - 1) * 1000;
    }

    randomizeDuration (t) {
        return Math.random() * t;
    }

    setTimeout (fn, time) {
        this._connectionTimeout = window.setTimeout(fn, time);
    }

    parseMessage (message) {
        const varData = {};
        switch (message.method) {
        case 'set': {
            varData.varUpdate = {
                name: message.name,
                value: message.value
            };
            break;
        }
        case 'init':
            break;
        default:
            break;
        }
        return varData;
    }

    writeToServer (methodName, dataName, dataValue, dataNewName) {
        const msg = {};
        msg.method = methodName;
        msg.user = this.username;
        msg.project_id = this.projectId;
        msg.token = this.token;

        if (dataName) msg.name = dataName;
        if (dataNewName) msg.new_name = dataNewName;
        if (typeof dataValue !== 'undefined' && dataValue !== null) msg.value = dataValue;

        const dataToWrite = JSON.stringify(msg);
        if (this.connection && this.connection.readyState === WebSocket.OPEN) {
            this.sendCloudData(dataToWrite);
        } else if (msg.method === 'create' || msg.method === 'delete' || msg.method === 'rename') {
            this.queuedData.push(dataToWrite);
        }
    }

    _sendCloudData (data) {
        this.connection.send(`${data}\n`);
    }

    createVariable (name, value) {
        this.writeToServer('create', name, value);
    }

    updateVariable (name, value) {
        this.writeToServer('set', name, value);
    }

    renameVariable (oldName, newName) {
        this.writeToServer('rename', oldName, null, newName);
    }

    deleteVariable (name) {
        this.writeToServer('delete', name);
    }

    requestCloseConnection () {
        if (this.connection &&
            this.connection.readyState !== WebSocket.CLOSING &&
            this.connection.readyState !== WebSocket.CLOSED) {
            this.connection.onclose = () => {};
            this.connection.onerror = () => {};
            this.connection.close();
        }
        this.clear();
    }

    clear () {
        this.connection = null;
        this.vm = null;
        this.username = null;
        this.token = null;
        this.projectId = null;
        if (this._connectionTimeout) {
            clearTimeout(this._connectionTimeout);
            this._connectionTimeout = null;
        }
        this.connectionAttempts = 0;
    }
}

export {
    LanquCloudProvider
};
