# @lanqu/scratch-gui

Lanqu Scratch GUI wrapper around `@scratch/scratch-gui` (v15). B-plan port of
[easy-scratch3](https://github.com/open-scratch/easy-scratch3)'s customization
model: host pages inject `window.scratchConfig` (declarative) and call
`window.scratch.*` (imperative) after the editor boots.

The wrapper is a thin layer: almost all customization is expressed as optional
React props scoped with "default behavior unchanged" patches in
`packages/scratch-gui` (see `packages/scratch-gui/PATCHES.md`).

## Usage

```js
import {createEasyRoot} from '@lanqu/scratch-gui';

window.scratchConfig = {
    session: {token: '...', username: 'alice'},
    cloudData: {enable: true, id: 'create', api: 'wss://...'},
    blocks: {scale: 0.8}
};
const root = createEasyRoot(window.scratchConfig, document.getElementById('scratch'));
root.render({});
```

Or with the React component form:

```jsx
import {EasyScratch} from '@lanqu/scratch-gui';

<EasyScratch scratchConfig={config} style={{height: '100vh'}} />
```

`scratchConfig` is read once at mount; remount with a new `key` to re-boot with
a different config. Other props are forwarded to the editor root, and the `ref`
exposes `getRoot()` / `unmount()` / `config` / `store`.

## Host surfaces

### Declarative — `window.scratchConfig`

| Section | Responsibility |
|---------|----------------|
| `session` | `token` (grants cloud write), `username` |
| `backpack` | `enable`, `api` |
| `cloudData` | `enable`, `id` (`'create'` = unsaved draft), `api` (WebSocket) |
| `projectInfo` | `projectName`, `authorUsername`, `authorAvatar` |
| `logo` | `show`, `url`, `handleClickLogo` |
| `menuBar` | background style, button visibility, `handleBefore*` intercepts, avatar/my-stuff, `customButtons` |
| `blocks` | `scale`, `hideCatagorys`, `hideBlocks` |
| `stageArea` | fullscreen/start/stop buttons + hooks, stage size/scale |
| `assets` | `assetHost` |
| top-level | `isPlayerOnly`, `readOnly`, `blocksOnly` and the `handle*` hooks |

Behavior hooks:

- `handleVmInitialized(vm)` — called once the VM is available.
- `handleProjectLoaded()` — called after every project load, including direct
  `window.scratch.loadProject(url)` calls.
- `handleDefaultProjectLoaded()` — called once after the default project loads.
- `handleProjectChanged(changed)` — dirty-state callback. Fired with `true` on
  any project edit and `false` after `markSaved()` or a project reload. Pair it
  with `window.scratch.isDirty()` / `markSaved()` to drive host autosave and
  `beforeunload` prompts.
- `handleCloudStatusChange(status)` — cloud connection status:
  `'connecting' | 'connected' | 'error' | 'disconnected'`.

### Imperative — `window.scratch.*`

| API | Purpose |
|-----|---------|
| `loadProject(url, cb)` | Load an .sb3 from a URL; `cb(error)` on failure |
| `getProjectFile(cb)` / `getProjectCover(cb)` / `getProjectCoverBlob(cb)` | Export project / stage preview |
| `getProjectName()` / `setProjectName(name)` | Read/write the project title |
| `setPlayerOnly(bool)` / `setFullScreen(bool)` / `setLocale(locale)` | Mode/locale switches |
| `setEnableCouldData(bool)` / `setCloudId(id)` / `getCloudId()` / `setAuthorUsername(name)` | Cloud variable control |
| `isDirty()` / `markSaved()` | Dirty-state query and save acknowledgement |
| `onCloudStatusChange(cb)` | Subscribe to cloud status; replays the latest status on registration |
| `pushSpriteLibrary(data)` / `pushCostumesLibrary(data)` / `pushBackdropsLibrary(data)` / `pushSoundsLibrary(data)` | Merge assets into the library drawers (deduped by asset id) |

## Editor modes

- **`isPlayerOnly: true`** — boots the store in player mode (stage only).
- **`readOnly: true`** — locks the blocks workspace (passed to scratch-blocks
  `inject()` as `readOnly`), hides the sprite/backdrop add, delete, duplicate and
  export affordances, and disables the sprite property inputs. The stage still
  runs so projects play.
- **`blocksOnly: true`** — hides the whole stage-and-target aside so the blocks
  editor fills the window (used by the playground `blocks-only.html` entry).

## Cloud variables

Validated end-to-end — see `docs/superpowers/specs/2026-10-21-scratch-cloud-variables-design.md`.
Key points:

- Unsaved work uses a per-user draft bucket `create:<session>`; the session id
  is random per browser and persisted in localStorage.
- Logged-in users can write cloud variables; anonymous users are read-only on
  saved works and cannot open draft buckets.
- `setCloudId('create')` rotates the draft session (new projects / local loads
  never inherit a previous draft's variables).

## Build / test

```sh
npm run build --workspace=@lanqu/scratch-gui   # also rebuilds scratch-gui dist (patches)
npm test --workspace=@lanqu/scratch-gui        # jest unit tests (mock standalone/storage)
npm start --workspace=@lanqu/scratch-gui       # playground http://localhost:8602
```

Deployment to the teaching-open frontends is handled by
`scripts/deploy-to-teaching-open.sh` (see root README).
