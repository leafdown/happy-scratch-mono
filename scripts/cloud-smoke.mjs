/**
 * cloud-smoke.mjs — dual client smoke test against a real cloud server.
 *
 * It speaks the Lanqu cloud protocol directly and checks the behaviour that
 * only shows up with a real Redis and a real token:
 *
 *  1. an anonymous client can read the values of a saved work
 *  2. an anonymous client cannot write (ack FAIL)
 *  3. a logged in client can write into its own draft bucket
 *  4. a second client sees the value that was just written (broadcast)
 *  5. an anonymous client cannot open a draft bucket
 *  6. a logged in client can read its own draft bucket
 *
 * The test only ever writes into a draft bucket (create:<session>), it never
 * touches a real teaching work.
 *
 * Usage:
 *   node scripts/cloud-smoke.mjs --url wss://host/api/websocket/scratch/cloudData \
 *        --token <login token> [--username <name>] [--work <saved work id>]
 *
 * Options:
 *   --url       websocket endpoint (default: wss://teacher.lanqu.vip/api/websocket/scratch/cloudData)
 *   --token     login token of the writing user
 *   --username  display name of that user (default: smoke)
 *   --work      saved work id used for the read only checks
 */
import wsPackage from 'ws';

const WebSocket = wsPackage.WebSocket || wsPackage;

const args = process.argv.slice(2);
const option = (name, fallback) => {
    const index = args.indexOf(name);
    return index === -1 ? fallback : args[index + 1];
};

const URL = option('--url', 'wss://teacher.lanqu.vip/api/websocket/scratch/cloudData');
const TOKEN = option('--token');
const USERNAME = option('--username', 'smoke');
const WORK = option('--work');
const SESSION = `smoke-${Date.now().toString(36)}`;

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

/**
 * A cloud client: one websocket with the protocol helpers.
 */
class CloudClient {
    constructor (label, token) {
        this.label = label;
        this.token = token || '';
        this.messages = [];
        this.socket = null;
    }

    connect () {
        return new Promise((resolve, reject) => {
            this.socket = new WebSocket(URL);
            this.socket.on('open', () => resolve(this));
            this.socket.on('error', error => reject(new Error(`${this.label}: ${error.message}`)));
            this.socket.on('message', data => {
                String(data).split('\n').filter(line => line.trim()).forEach(line => {
                    try {
                        this.messages.push(JSON.parse(line));
                    } catch (e) {
                        // ignore frames that are not protocol messages
                    }
                });
            });
        });
    }

    send (message) {
        this.socket.send(`${JSON.stringify(message)}\n`);
    }

    handshake (projectId) {
        this.send({method: 'handshake', user: USERNAME, project_id: projectId, token: this.token});
    }

    set (projectId, name, value) {
        this.send({method: 'set', user: USERNAME, project_id: projectId, token: this.token, name, value});
    }

    create (projectId, name, value) {
        this.send({
            method: 'create',
            user: USERNAME,
            project_id: projectId,
            token: this.token,
            name,
            value
        });
    }

    ofMethod (method) {
        return this.messages.filter(message => message.method === method);
    }

    valueOf (name) {
        const update = this.ofMethod('set').reverse().find(message => message.name === name);
        return update ? update.value : undefined;
    }

    ackOf (name) {
        return this.ofMethod('ack').find(message => message.name === name);
    }

    close () {
        if (this.socket) this.socket.close();
    }
}

const results = [];
const check = (name, ok, detail) => {
    results.push({name, ok, detail});
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
};

const main = async () => {
    if (!TOKEN) {
        console.error('缺少 --token：需要一个登录用户的 token 才能写入。');
        process.exit(2);
    }
    console.log(`endpoint: ${URL}`);
    console.log(`draft session: ${SESSION}`);

    const writer = new CloudClient('writer', TOKEN);
    const reader = new CloudClient('reader', '');
    await writer.connect();
    await reader.connect();
    check('两个客户端都能建立连接', true);

    if (WORK) {
        // 1. anonymous read of a saved work
        reader.handshake(WORK);
        await wait(800);
        const reads = reader.ofMethod('set');
        const failed = reader.ackOf(undefined) || reader.ofMethod('ack')[0];
        check(
            '匿名客户端可以读取已保存作品',
            !failed || failed.reply === 'OK',
            failed ? `ack=${failed.reply}` : `收到 ${reads.length} 个变量`
        );

        // 2. anonymous write is rejected
        reader.set(WORK, 'smoke', '1');
        await wait(800);
        const ack = reader.ofMethod('ack').pop();
        check('匿名客户端写入被拒绝', !!ack && ack.reply === 'FAIL', ack ? ack.reply : '没有收到 ack');
    } else {
        console.log('SKIP  已保存作品的读取检查（没有 --work）');
    }

    // 3. the logged in client writes into its own draft bucket
    const draft = `create:${SESSION}`;
    writer.create(draft, 'smoke', '1');
    await wait(800);
    let ack = writer.ackOf('smoke');
    check('登录客户端可以创建草稿变量', !!ack && ack.reply === 'OK', ack ? ack.reply : '没有收到 ack');

    writer.set(draft, 'smoke', '42');
    await wait(800);

    // 4. a second logged in client sees the value
    const second = new CloudClient('second', TOKEN);
    await second.connect();
    second.handshake(draft);
    await wait(1000);
    check('第二个客户端读到了刚写入的值', second.valueOf('smoke') === '42', `value=${second.valueOf('smoke')}`);

    // 5. an anonymous client cannot open a draft bucket
    const anonymous = new CloudClient('anonymous', '');
    await anonymous.connect();
    anonymous.handshake(draft);
    await wait(800);
    const anonymousAck = anonymous.ofMethod('ack')[0];
    check(
        '匿名客户端打不开草稿空间',
        !!anonymousAck && anonymousAck.reply === 'FAIL',
        anonymousAck ? anonymousAck.reply : '没有收到 ack'
    );

    // 6. the writer reads its own draft bucket
    writer.messages.length = 0;
    writer.handshake(draft);
    await wait(800);
    check('作者能读回自己的草稿变量', writer.valueOf('smoke') === '42', `value=${writer.valueOf('smoke')}`);

    // 7. a client that floods the connection is throttled (50 messages per
    // second per connection), the rest is rejected with an ack.
    const flood = new CloudClient('flood', TOKEN);
    await flood.connect();
    flood.handshake(draft);
    await wait(300);
    flood.messages.length = 0;
    for (let i = 0; i < 60; i++) {
        flood.set(draft, 'burst', String(i));
    }
    await wait(1500);
    const rejected = flood.ofMethod('ack').filter(message => message.reply === 'FAIL');
    check('刷得太快的连接被限速', rejected.length > 0, `${rejected.length} 条被拒`);
    flood.close();

    [writer, reader, second, anonymous].forEach(client => client.close());

    const failedChecks = results.filter(result => !result.ok);
    console.log(`\n${results.length - failedChecks.length}/${results.length} 项通过`);
    process.exit(failedChecks.length === 0 ? 0 : 1);
};

main().catch(error => {
    console.error(`smoke test failed: ${error.message}`);
    process.exit(1);
});
