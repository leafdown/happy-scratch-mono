/**
 * Lanqu cloud variable provider — adapts the Lanqu WebSocket cloud protocol to
 * scratch-gui's GUICloudVariableProvider interface.
 *
 * Protocol (compatible with scratch-gui message methods, differs in auth):
 *   - Official auth: WebSocket subprotocol `bearer!${token}`
 *   - Lanqu auth:    token/user/project_id carried in the message body
 *
 * Message methods: handshake / create / set / rename / delete
 *
 * This is a port of easy-scratch3/src/lib/cloud-provider.js, adapted to the
 * scratch-gui interface (adds isConnectedOrConnecting). The protocol is exercised
 * against a local mock WebSocket server; deploy-time Redis verification is still required.
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

        // Rate limit to 10 messages/sec, matching scratch-gui.
        this.sendCloudData = throttle(this._sendCloudData, 100);

        this.openConnection();
    }

    isConnectedOrConnecting () {
        return this.isTryingToConnect || !!this.connection;
    }

    openConnection () {
        this.connectionAttempts += 1;
        try {
            const host = /^wss?:\/\//i.test(this.cloudHost) ?
                this.cloudHost :
                (location.protocol === 'https:' ? 'wss://' : 'ws://') + this.cloudHost;
            this.connection = new WebSocket(host);
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
        log.error('Websocket connection error', event);
    }

    onMessage (event) {
        const messageString = event.data;
        messageString.split('\n').forEach(message => {
            if (!message) return;
            let parsed;
            try {
                parsed = JSON.parse(message);
            } catch (e) {
                log.error('Could not parse cloud message', message, e);
                return;
            }
            if (parsed.method === 'ack' && parsed.reply !== 'OK') {
                log.warn(`Cloud ${parsed.method} failed for "${parsed.name}": ${parsed.reply}`);
            }
            const parsedData = this.parseMessage(parsed);
            if (this.vm) this.vm.postIOData('cloud', parsedData);
        });
    }

    onOpen () {
        if (!this.isTryingToConnect) return;
        this.connectionAttempts = 1;
        // Cancel any trailing set from the previous connection so the
        // handshake is always the first message on the new connection.
        if (this.sendCloudData && typeof this.sendCloudData.cancel === 'function') {
            this.sendCloudData.cancel();
        }
        this.writeToServer('handshake');
        log.info('Successfully connected to clouddata server.');
        // Management messages must not go through the throttle: throttle only
        // keeps the first and last argument, which would drop creates when a
        // project with multiple cloud variables loads.
        this.queuedData.forEach(entry => this._sendCloudData(entry.data));
        this.queuedData = [];
    }

    onClose () {
        // Ignore close events after requestCloseConnection()/clear().
        if (!this.isTryingToConnect) return;
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
        if (typeof dataValue !== 'undefined' && dataValue !== null) {
            // The value goes over the wire as a string: the backend stores it
            // as one (Java used getString) and a numeric JSON value is dropped
            // by servers that only accept strings.
            msg.value = String(dataValue);
        }

        const dataToWrite = JSON.stringify(msg);
        const isManagementMessage = (
            msg.method === 'create' ||
            msg.method === 'delete' ||
            msg.method === 'rename'
        );
        if (this.connection && this.connection.readyState === WebSocket.OPEN) {
            if (isManagementMessage) {
                // Flush any pending set first: rename/delete must see the
                // latest value, and a trailing set after a rename would
                // recreate the old variable name.
                if (this.sendCloudData && typeof this.sendCloudData.flush === 'function') {
                    this.sendCloudData.flush();
                }
                // Do not throttle management messages: lodash.throttle would
                // silently drop all but the first and last in a burst.
                this._sendCloudData(dataToWrite);
            } else {
                this.sendCloudData(dataToWrite);
            }
        } else {
            const entry = {method: msg.method, name: msg.name, data: dataToWrite};
            if (msg.method === 'set') {
                // Keep only the latest queued value for each variable so a
                // long outage cannot grow the queue without bound.
                const existingIndex = this.queuedData.findIndex(
                    queued => queued.method === 'set' && queued.name === msg.name
                );
                if (existingIndex !== -1) {
                    this.queuedData.splice(existingIndex, 1);
                }
            }
            this.queuedData.push(entry);
        }
    }

    _sendCloudData (data) {
        if (this.connection && this.connection.readyState === WebSocket.OPEN) {
            this.connection.send(`${data}\n`);
        }
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
        try {
            if (this.connection) {
                // Neutralize handlers even if the socket is already closing:
                // its onclose can fire after clear() and schedule a reconnect.
                this.connection.onopen = () => {};
                this.connection.onmessage = () => {};
                this.connection.onclose = () => {};
                this.connection.onerror = () => {};
                if (this.connection.readyState !== WebSocket.CLOSING &&
                    this.connection.readyState !== WebSocket.CLOSED) {
                    this.connection.close();
                }
            }
        } finally {
            this.clear();
        }
    }

    clear () {
        this.isTryingToConnect = false;
        if (this.sendCloudData && typeof this.sendCloudData.cancel === 'function') {
            this.sendCloudData.cancel();
        }
        this.queuedData = [];
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
