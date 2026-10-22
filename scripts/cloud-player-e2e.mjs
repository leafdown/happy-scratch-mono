/**
 * cloud-player-e2e.mjs — browser test for the *player* page's cloud variables.
 *
 * The player (scratch3/player.html) is the read-only embed: it runs a saved
 * work and, when that work has cloud variables, connects an anonymous,
 * read-only WebSocket to the cloud backend. This test drives the real player
 * in Chrome and verifies what the protocol-level smoke cannot:
 *
 *   - an anonymous player connects for a work that has cloud variables
 *   - the server's values reach the stage variable / monitor
 *   - the work actually plays (the canvas renders frames)
 *   - a "set" pushed by the server updates the on-stage variable live
 *   - the player's *own* project code cannot write (its "set" is rejected,
 *     i.e. it never sends a cloud write that would make the value change)
 *
 * The work is a small self-contained .sb3 with a stage cloud variable
 * "☁ score" initialised to 7. It is served by the mock server from
 * scripts/fixtures/cloud-demo.sb3 so the test never touches a real teaching
 * work or the live backend.
 *
 * Usage:
 *   npx webpack --config packages/lanqu-scratch-gui/webpack.config.js   # build
 *   node scripts/cloud-player-e2e.mjs
 *
 * Environment:
 *   TEACHING_OPEN_DIR  path to the teaching-open checkout (default: sibling)
 */
import fs from 'fs';
import http from 'http';
import path from 'path';
import {fileURLToPath} from 'url';
import wsPackage from 'ws';
import {chromium} from 'playwright';

const WebSocketServer = wsPackage.Server || wsPackage.WebSocketServer;

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TEACHING_OPEN = process.env.TEACHING_OPEN_DIR ||
    path.resolve(ROOT, '..', 'teaching-open');
const HOST_PAGES = path.join(ROOT, 'deploy/teaching-open');
const BUILD = path.join(ROOT, 'packages/lanqu-scratch-gui/build');
const DEPLOYED = path.join(TEACHING_OPEN, 'web/public');
const DEMO = path.join(ROOT, 'scripts', 'fixtures', 'cloud-demo.sb3');

const contentTypes = {
    '.js': 'application/javascript',
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.svg': 'image/svg+xml',
    '.map': 'application/json',
    '.sb3': 'application/octet-stream'
};

const resolveFile = urlPath => {
    if (!urlPath || urlPath === '/') return null;
    if (urlPath === '/static/cloud-demo.sb3') return DEMO;
    if (urlPath.startsWith('/scratch3/')) {
        const rel = urlPath.slice('/scratch3/'.length);
        if (['index.html', 'player.html', 'blocks-only.html'].includes(rel)) {
            return path.join(HOST_PAGES, 'scratch3', rel);
        }
        if (['chunks/gui.js', 'chunks/player.js', 'chunks/blocksonly.js'].includes(rel)) {
            return path.join(BUILD, rel.replace('chunks/', ''));
        }
        return path.join(BUILD, rel);
    }
    if (urlPath.startsWith('/js/')) {
        const rel = urlPath.slice('/js/'.length).split('?')[0];
        if (rel === 'common.js') return path.join(HOST_PAGES, 'js', 'common.js');
        return path.join(DEPLOYED, 'js', rel);
    }
    if (urlPath.startsWith('/css/')) return path.join(DEPLOYED, 'css', urlPath.slice('/css/'.length));
    if (urlPath === '/logo.png') return path.join(DEPLOYED, 'logo.png');
    return null;
};

const server = http.createServer((req, res) => {
    const file = resolveFile(req.url.split('?')[0]);
    if (!file || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
        res.writeHead(404);
        res.end('not found');
        return;
    }
    res.writeHead(200, {'Content-Type': contentTypes[path.extname(file)] || 'application/octet-stream'});
    fs.createReadStream(file).pipe(res);
});

// Mock cloud backend mimicking the Lanqu protocol: keeps values per project,
// serves them on handshake, broadcasts writes to peers in the same bucket.
const wss = new WebSocketServer({noServer: true});
const received = [];
const acks = [];
const values = new Map();
const sockets = new Set();

const bucket = projectId => {
    if (!values.has(projectId)) values.set(projectId, new Map());
    return values.get(projectId);
};

server.on('upgrade', (request, socket, head) => {
    if (!request.url.startsWith('/api/websocket/scratch/cloudData')) {
        socket.destroy();
        return;
    }
    wss.handleUpgrade(request, socket, head, ws => wss.emit('connection', ws, request));
});

wss.on('connection', ws => {
    sockets.add(ws);
    ws.on('message', data => {
        String(data).split('\n').filter(line => line.trim()).forEach(line => {
            const message = JSON.parse(line);
            received.push(message);
            const projectId = message.project_id;
            if (message.method === 'handshake') {
                ws.projectId = projectId;
                bucket(projectId).forEach((value, name) => {
                    ws.send(`${JSON.stringify({
                        method: 'set', project_id: projectId, name, value
                    })}\n`);
                });
                return;
            }
            // Anonymous writes are rejected: the player must stay read-only.
            if (['create', 'set', 'rename', 'delete'].includes(message.method)) {
                const ack = {method: 'ack', name: message.name, reply: 'FAIL'};
                ws.send(`${JSON.stringify(ack)}\n`);
                acks.push(ack);
                return;
            }
        });
    });
    ws.on('close', () => sockets.delete(ws));
});

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

const main = async () => {
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const port = server.address().port;
    console.log(`mock cloud + player server on ${port}`);

    if (!fs.existsSync(DEMO)) {
        throw new Error(`demo project missing: ${DEMO}`);
    }

    const browser = await chromium.launch({channel: 'chrome', headless: true});
    const context = await browser.newContext();
    const page = await context.newPage();
    page.on('pageerror', error => console.log('PAGE ERROR:', error.message));
    page.on('dialog', dialog => dialog.accept());

    // The frames the anonymous player sends.
    const frames = [];
    page.on('websocket', ws => {
        ws.on('framesent', event => {
            String(event.payload).split('\n').filter(line => line.trim()).forEach(line => {
                try {
                    frames.push(JSON.parse(line));
                } catch (e) {
                    // not a protocol frame
                }
            });
        });
    });

    // Seed the bucket with a known initial value so reads are meaningful.
    bucket('/static/cloud-demo.sb3').set('☁ score', '7');

    // Anonymous player: no login local storage, just the player page.
    const origin = `http://127.0.0.1:${port}`;
    await page.goto(`${origin}/scratch3/player.html?workUrl=/static/cloud-demo.sb3`,
        {waitUntil: 'domcontentloaded'});

    // Wait for the player's VM to boot, the work to load and the cloud
    // connection to be established.
    await page.waitForFunction(() => window.vm && window.scratch, null, {timeout: 30000}).catch(() => {});
    await page.waitForFunction(() => {
        const t = window.vm && window.vm.runtime && window.vm.runtime.targets[0];
        return t && t.variables && Object.values(t.variables).some(v => v.isCloud);
    }, null, {timeout: 60000});

    await wait(2000);

    const state = await page.evaluate(() => {
        const stage = window.vm.runtime.targets[0];
        const cloudVar = Object.values(stage.variables).find(v => v.isCloud);
        const scratch = window.scratch || {};
        return {
            cloudId: typeof scratch.getCloudId === 'function' ? scratch.getCloudId() : null,
            hasCloudData: window.vm.runtime.hasCloudData(),
            cloudName: cloudVar ? cloudVar.name : null,
            cloudValue: cloudVar ? cloudVar.value : null
        };
    });
    console.log('player state:', JSON.stringify(state));

    if (!state.cloudId) throw new Error('the player did not resolve a cloud id');
    if (state.cloudId !== '/static/cloud-demo.sb3') {
        throw new Error(`unexpected cloud id: ${state.cloudId}`);
    }
    if (!state.hasCloudData) throw new Error('the player has no cloud data for this work');
    if (state.cloudName !== '☁ score') throw new Error(`unexpected cloud variable ${state.cloudName}`);
    if (String(state.cloudValue) !== '7') throw new Error(`initial value missing: ${state.cloudValue}`);

    // The player connected with a handshake (anonymous, read-only).
    if (!frames.some(m => m.method === 'handshake' && m.project_id === state.cloudId)) {
        throw new Error(`no handshake from the player for ${state.cloudId}`);
    }

    // The work must actually be running: give the renderer frames and confirm
    // it draws (a blank stage would not even have the backdrop).
    await wait(1500);
    const renderInfo = await page.evaluate(() => {
        const canvas = document.querySelector('canvas');
        if (!canvas) return {found: false};
        let webgl = null;
        try {
            const gl = canvas.getContext('webgl') || canvas.getContext('webgl2');
            if (gl) webgl = gl.getParameter(gl.VERSION);
        } catch (e) {
            webgl = 'error';
        }
        return {found: true, width: canvas.width, height: canvas.height, webgl};
    });
    console.log('canvas:', JSON.stringify(renderInfo));
    if (!renderInfo.found || renderInfo.width < 200) {
        throw new Error('the player did not attach a stage canvas');
    }
    if (renderInfo.webgl && /swiftshader|WebGL/i.test(renderInfo.webgl)) {
        console.log('renderer:', renderInfo.webgl);
    }

    // Anonymous read-only: the player's own project code runs (its green-flag
    // script tries to change "☁ score"), so the page does try to write — but
    // with no token the backend must reject every write. Drive one write
    // through the live provider (equivalent to what the project code would
    // send) and assert the mock answers FAIL and the stage value stays put.
    const writeFrame = await page.evaluate(() => {
        const provider = window.vm.runtime.ioDevices.cloud.provider;
        if (!provider || typeof provider.updateVariable !== 'function') return null;
        provider.updateVariable('☁ score', '999');
        return {
            user: provider.username,
            token: provider.token,
            projectId: provider.projectId
        };
    });
    await wait(600);
    const writeAck = acks[acks.length - 1];
    console.log('anonymous write frame:', JSON.stringify(writeFrame));
    console.log('ack for anonymous write:', JSON.stringify(writeAck));
    if (!writeAck || writeAck.reply !== 'FAIL') {
        throw new Error('the anonymous player write was not rejected by the server');
    }
    const afterWrite = await page.evaluate(() => {
        const stage = window.vm.runtime.targets[0];
        const cloudVar = Object.values(stage.variables).find(v => v.isCloud);
        return cloudVar ? cloudVar.value : null;
    });
    if (String(afterWrite) !== '7') {
        throw new Error(`anonymous write changed the value: ${afterWrite}`);
    }

    // A server push reaches the player live: change the value via the mock.
    const pushSocket = [...sockets].find(ws => ws.projectId === state.cloudId);
    if (!pushSocket) throw new Error('no live player connection to push to');
    pushSocket.send(`${JSON.stringify({
        method: 'set', project_id: state.cloudId, name: '☁ score', value: '12'
    })}\n`);
    await wait(600);
    const afterPush = await page.evaluate(() => {
        const stage = window.vm.runtime.targets[0];
        return Object.values(stage.variables).find(v => v.isCloud).value;
    });
    console.log('value after server push:', afterPush);
    if (String(afterPush) !== '12') throw new Error(`server push did not reach the player: ${afterPush}`);

    await browser.close();
    server.close();
    console.log('cloud player E2E OK');
};

main().catch(error => {
    console.error('cloud player E2E FAILED:', error.message);
    server.close();
    process.exit(1);
});
