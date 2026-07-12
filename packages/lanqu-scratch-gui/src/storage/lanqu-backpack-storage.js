/**
 * Lanqu backpack storage — adapts the Lanqu backpack protocol to scratch-gui
 * v14's GUIBackpackStorage interface (list / save / delete / setSession).
 *
 * Two backends:
 *   - HTTP:   Lanqu backpack api (X-Access-Token auth, /content /save /delete paths)
 *   - Local:  localStorage fallback (key '[lanqu] backpack'), used when no host set
 *
 * Real HTTP backend verification is deferred to stage 2. The localStorage path is
 * functional now for local testing.
 */
import xhr from 'xhr';

const LOCALSTORAGE_KEY = '[lanqu] backpack';

const randomId = () => {
    let str = '';
    for (let i = 0; i < 20; i++) {
        str += Math.floor(Math.random() * 36).toString(36);
    }
    return str;
};

// v14 BackpackItem requires thumbnailUrl/bodyUrl; Lanqu returns base64 inline.
const withFullUrls = item => ({
    ...item,
    thumbnailUrl: item.thumbnailUrl || (item.thumbnail ? `data:image/jpeg;base64,${item.thumbnail}` : ''),
    bodyUrl: item.bodyUrl || (item.body ? `data:${item.mime};base64,${item.body}` : '')
});

class LanquBackpackStorage {
    constructor ({host, session} = {}) {
        this.host = host || '';
        this.defaultSession = session || null;
        this.session = this.defaultSession;
    }

    setHost (host) {
        this.host = host;
    }

    setSession (session) {
        // v14's Backpack container calls setSession(null) when redux has no session
        // (we don't populate redux session state — the Lanqu token lives in
        // scratchConfig). Fall back to the config session so list/save carry the
        // X-Access-Token from scratchConfig.session.token.
        this.session = session || this.defaultSession;
    }

    get useLocal () {
        return !this.host;
    }

    async list (request) {
        if (this.useLocal) {
            const backpack = JSON.parse(localStorage.getItem(LOCALSTORAGE_KEY) || '[]') || [];
            return backpack.slice(request.offset, request.offset + request.limit).map(withFullUrls);
        }
        return this._httpList(request);
    }

    async save (item, data) {
        const [body, thumbnail] = await Promise.all([
            data.dataAsBase64(),
            data.thumbnailAsBase64()
        ]);
        const entry = {
            id: randomId(),
            name: item.name,
            type: item.type,
            mime: data.mimeType(),
            body,
            thumbnail
        };
        if (this.useLocal) {
            const backpack = JSON.parse(localStorage.getItem(LOCALSTORAGE_KEY) || '[]') || [];
            backpack.push(entry);
            localStorage.setItem(LOCALSTORAGE_KEY, JSON.stringify(backpack));
            return withFullUrls(entry);
        }
        return this._httpSave(entry);
    }

    async delete (id) {
        if (this.useLocal) {
            const backpack = JSON.parse(localStorage.getItem(LOCALSTORAGE_KEY) || '[]') || [];
            const filtered = backpack.filter(e => e.id !== id);
            localStorage.setItem(LOCALSTORAGE_KEY, JSON.stringify(filtered));
            return;
        }
        return this._httpDelete(id);
    }

    _authHeaders () {
        const token = this.session && this.session.token;
        return token ? {'X-Access-Token': token} : {};
    }

    _httpList (request) {
        return new Promise((resolve, reject) => {
            xhr({
                method: 'GET',
                uri: `${this.host}/content?limit=${request.limit}&offset=${request.offset}`,
                headers: this._authHeaders(),
                json: true
            }, (error, response) => {
                if (error || response.statusCode !== 200) {
                    return reject(new Error(String(response && response.statusCode)));
                }
                resolve((response.body.result || response.body).map(withFullUrls));
            });
        });
    }

    _httpSave (entry) {
        return new Promise((resolve, reject) => {
            xhr({
                method: 'POST',
                uri: `${this.host}/save`,
                headers: this._authHeaders(),
                json: entry
            }, (error, response) => {
                if (error || response.statusCode !== 200) {
                    return reject(new Error(String(response && response.statusCode)));
                }
                resolve(withFullUrls(response.body || entry));
            });
        });
    }

    _httpDelete (id) {
        return new Promise((resolve, reject) => {
            xhr({
                method: 'DELETE',
                uri: `${this.host}/delete?id=${id}`,
                headers: this._authHeaders()
            }, (error, response) => {
                if (error || response.statusCode !== 200) {
                    return reject(new Error(String(response && response.statusCode)));
                }
                resolve();
            });
        });
    }
}

export {
    LanquBackpackStorage
};
