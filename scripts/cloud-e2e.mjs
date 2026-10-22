/**
 * cloud-e2e.mjs — browser regression test for the Scratch cloud variables.
 *
 * It serves the built Lanqu editor and the teaching-open host page, runs a
 * mock WebSocket server that speaks the cloud protocol and drives the real
 * editor in Chrome. It verifies the parts that unit tests cannot cover:
 *
 *  - an unsaved work connects with project_id "create:<session>"
 *  - the handshake is sent before the queued cloud variable creation
 *  - a "set" pushed by the server reaches the stage variable
 *  - "File > New" starts a new draft bucket
 *  - reloading keeps the draft session, so unsaved values survive
 *  - a project file that cannot be loaded restores the previous bucket
 *
 * Usage:
 *   npx webpack --config packages/lanqu-scratch-gui/webpack.config.js   # build
 *   node scripts/cloud-e2e.mjs
 *
 * Against a deployed site (the editor and the backend are the real ones):
 *   node scripts/cloud-e2e.mjs --site https://teacher.lanqu.vip --token <token>
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

const args = process.argv.slice(2);
const option = (name, fallback) => {
    const index = args.indexOf(name);
    return index === -1 ? fallback : args[index + 1];
};
const SITE = option('--site');
const TOKEN = option('--token', 'token-alice');

const contentTypes = {
    '.js': 'application/javascript',
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.svg': 'image/svg+xml',
    '.map': 'application/json'
};

const resolveFile = urlPath => {
    if (!urlPath || urlPath === '/') return null;
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

// Mock of the backend: keeps the values per project and broadcasts them.
const wss = new WebSocketServer({noServer: true});
const received = [];
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
                    ws.send(`${JSON.stringify({method: 'set', project_id: projectId, name, value})}\n`);
                });
                return;
            }
            if (message.method === 'create' || message.method === 'set') {
                bucket(projectId).set(message.name, message.value);
                sockets.forEach(other => {
                    if (other.projectId === projectId && other.readyState === 1) {
                        other.send(`${JSON.stringify({
                            method: 'set',
                            project_id: projectId,
                            name: message.name,
                            value: message.value
                        })}\n`);
                    }
                });
            }
            if (message.method === 'delete') {
                bucket(projectId).delete(message.name);
            }
            if (['create', 'delete', 'rename'].includes(message.method)) {
                ws.send(`${JSON.stringify({method: 'ack', name: message.name, reply: 'OK'})}\n`);
            }
        });
    });
    ws.on('close', () => sockets.delete(ws));
});

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

const main = async () => {
    let origin;
    if (SITE) {
        origin = SITE.replace(/\/$/, '');
        console.log(`running against ${origin}`);
    } else {
        await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
        const port = server.address().port;
        console.log(`mock cloud server on ${port}`);
        origin = `http://127.0.0.1:${port}`;
    }

    const browser = await chromium.launch({channel: 'chrome', headless: true});
    const context = await browser.newContext();
    const page = await context.newPage();
    page.on('pageerror', error => console.log('PAGE ERROR:', error.message));
    // Loading a file asks for a confirmation, a broken file shows an alert.
    page.on('dialog', dialog => dialog.accept());

    // The frames the browser really sends and receives.
    const frames = [];
    page.on('websocket', ws => {
        console.log('websocket opened:', ws.url());
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

    await page.goto(`${origin}/scratch3/index.html`, {waitUntil: 'domcontentloaded'});
    // The editor reads the token from the local storage of the site, so log
    // in first and reload the editor.
    await page.evaluate(token => {
        localStorage.setItem('pro__Access-Token', JSON.stringify({value: token}));
        localStorage.setItem('pro__Login_Userinfo', JSON.stringify({
            value: {username: 'alice', realname: 'Alice', avatar: ''}
        }));
        localStorage.setItem('pro__SYS_CONFIG', JSON.stringify({value: {qiniuDomain: ''}}));
    }, TOKEN);
    await page.reload({waitUntil: 'domcontentloaded'});
    const hasCloudApi = await page.evaluate(() => !!(window.scratch && window.scratch.getCloudId));
    if (!hasCloudApi) {
        throw new Error('the deployed editor has no cloud variable support yet ' +
            '(window.scratch.getCloudId is missing), deploy the current bundle first');
    }
    await page.waitForFunction(() => window.vm && window.scratch && window.scratch.getCloudId, null, {timeout: 60000});
    await page.waitForFunction(() => window.vm.runtime.targets.length > 0, null, {timeout: 60000});

    // A cloud variable makes the editor open the cloud connection.
    await page.evaluate(() => {
        window.vm.runtime.targets[0].createVariable('cvar1', 'score', '', true);
    });
    await wait(2000);

    const cloudId = await page.evaluate(() => window.scratch.getCloudId());
    const firstSession = cloudId.split(':')[1];
    console.log('cloud id:', cloudId);
    if (!firstSession) throw new Error('the unsaved work did not get a draft session');
    if (!frames.some(m => m.method === 'handshake' && m.project_id === cloudId)) {
        throw new Error(`no handshake for ${cloudId}`);
    }
    const handshakeIndex = frames.findIndex(m => m.method === 'handshake');
    const createIndex = frames.findIndex(m => m.method === 'create');
    if (createIndex < handshakeIndex) throw new Error('the cloud variable was created before the handshake');

    if (SITE) {
        // Against a real server nobody pushes a value, so only the client side
        // of the flow can be checked here.
        console.log('SKIP  the broadcast check needs the mock server');
    } else {
        // The server pushes a value, the stage variable must follow.
        sockets.forEach(ws => {
            if (ws.projectId === cloudId) {
                ws.send(`${JSON.stringify({
                    method: 'set',
                    project_id: cloudId,
                    name: 'score',
                    value: '42'
                })}\n`);
            }
        });
        await wait(500);
        const stageValue = await page.evaluate(() => {
            const variable = Object.values(window.vm.runtime.targets[0].variables).find(v => v.name === 'score');
            return variable ? variable.value : null;
        });
        console.log('stage value after the broadcast:', stageValue);
        if (stageValue !== '42') throw new Error(`the broadcast did not reach the stage: ${stageValue}`);
    }

    // "File > New" starts a new unsaved work and must use a new draft bucket.
    await page.getByLabel('File menu').click();
    await wait(300);
    // The editor runs in Chinese here, "新作品" is the New item.
    await page.getByText('新作品', {exact: true}).click();
    await wait(2000);
    const secondSession = (await page.evaluate(() => window.scratch.getCloudId())).split(':')[1];
    console.log('session after New:', secondSession);
    if (secondSession === firstSession) throw new Error('New reused the previous draft session');

    // The new work only connects once it has a cloud variable, and it must
    // use the new bucket.
    await page.evaluate(() => {
        window.vm.runtime.targets[0].createVariable('cvar2', 'lives', '', true);
    });
    await wait(2000);
    if (!frames.some(m => m.method === 'handshake' && m.project_id === `create:${secondSession}`)) {
        throw new Error('no handshake for the draft of the new work');
    }
    if (!SITE) {
        const newBucket = values.get(`create:${secondSession}`);
        if (!newBucket || !newBucket.has('lives')) {
            throw new Error('the new work did not use the new draft bucket');
        }
        const oldBucket = values.get(`create:${firstSession}`) || new Map();
        if (oldBucket.has('lives')) throw new Error('the new work wrote into the previous bucket');
    }

    // A reload keeps the same draft session, so unsaved values survive.
    await page.reload({waitUntil: 'domcontentloaded'});
    await page.waitForFunction(() => window.scratch && window.scratch.getCloudId, null, {timeout: 60000});
    await wait(500);
    const afterReload = (await page.evaluate(() => window.scratch.getCloudId())).split(':')[1];
    console.log('session after reload:', afterReload);
    if (afterReload !== secondSession) throw new Error('the reload did not keep the draft session');

    // A project file that cannot be loaded must restore the previous draft
    // session, the work that is still open keeps its cloud data.
    const brokenFile = path.join('/tmp', 'cloud-e2e-broken.sb3');
    fs.writeFileSync(brokenFile, Buffer.from('not a project'));
    await page.getByLabel('File menu').click();
    await wait(300);
    const [brokenChooser] = await Promise.all([
        page.waitForEvent('filechooser'),
        page.getByText('从电脑中加载', {exact: true}).click()
    ]);
    await brokenChooser.setFiles(brokenFile);
    await wait(3000);
    const afterBrokenLoad = (await page.evaluate(() => window.scratch.getCloudId())).split(':')[1];
    console.log('session after a broken file:', afterBrokenLoad);
    if (afterBrokenLoad !== afterReload) throw new Error('a failed load did not restore the draft session');

    await browser.close();
    server.close();
    console.log('cloud E2E OK');
};

main().catch(error => {
    console.error('cloud E2E FAILED:', error.message);
    server.close();
    process.exit(1);
});