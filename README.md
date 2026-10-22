# happy-scratch-mono

基于 [scratchfoundation/scratch-editor](https://github.com/scratchfoundation/scratch-editor) v15.2.0 的 Scratch 编辑器定制发行版，为蓝鹊（Lanqu）在线编程教学平台提供可嵌入的 Scratch 3.0 编辑器。

本项目将 [easy-scratch3](https://github.com/open-scratch/easy-scratch3)（基于 2021 版 scratch-gui 的二次封装）的定制模型 —— `window.scratchConfig` 声明式配置 + `window.scratch.*` 命令式 API —— 以薄封装层 + 最小化源码 patch 的方式移植到最新的 scratch-editor v15.2.0 之上。依赖旧版内部实现的少数配置项没有对应实现，差异见「配置驱动」。

## 项目目标

- 跟随 scratch-editor 官方版本升级（保持低冲突 rebase）
- 保留 easy-scratch3 的全部定制能力（`window.scratchConfig` 声明式配置 + `window.scratch.*` 命令式 API）
- 通过薄封装包 `@lanqu/scratch-gui` 引用 `@scratch/scratch-gui`，尽量不改 scratch-gui 源码
- 必须改源码的定制点，遵循"新增可选 prop/参数，默认行为不变"原则，保证升级零冲突

## 仓库结构

```
packages/
├── scratch-gui/              # 官方 scratch-gui v15.2.0（含最小化 patch，见 PATCHES.md
├── scratch-vm/               # 官方 scratch-vm
├── scratch-render/           # 官方 scratch-render
├── scratch-svg-renderer/     # 官方 scratch-svg-renderer
├── scratch-paint/            # 官方画板编辑器（15.x 并入 monorepo）
├── scratch-storage/          # 官方素材存储层（15.x 并入 monorepo）
├── scratch-media-lib-scripts/# 官方素材库脚本
├── task-herder/              # 官方异步任务调度
└── lanqu-scratch-gui/        # 蓝鹊封装包（B 方案核心）
    ├── src/
    │   ├── index.js              # createEasyRoot + buildPatchProps（scratchConfig → patch props）
    │   ├── config/               # scratchConfig 默认值 + EditorState/GUIConfig 转换
    │   ├── storage/              # 蓝鹊后端 adapter（背包 HTTP / 云变量 WebSocket / storage）
    │   ├── api/scratch-api.js    # window.scratch.* 命令式 API（项目/作品/云变量/脏状态等）+ locale 覆盖
    │   └── playground/           # 三模式入口（完整编辑器 / 播放器 / 仅积木）
    └── webpack.config.js
scripts/
└── upgrade-from-upstream.sh # 自动化升级脚本（fetch → 备份 → rebase → 重建 → 验证）
```

## 定制能力

### 配置驱动（`window.scratchConfig`）

宿主页面注入全局配置，描述外观开关、行为开关、API 地址、事件拦截回调：

- **会话/鉴权**：`session.token` / `session.username`
- **背包**：`backpack.enable` / `backpack.api`（HTTP 或 localStorage 本地模式）
- **云变量**：`cloudData.enable` / `cloudData.id` / `cloudData.api`（WebSocket）
- **作品元信息**：`projectInfo.projectName`（项目加载后写入标题栏）/ `authorUsername`（云变量身份）/ `authorAvatar`（头像兜底）
- **LOGO**：`logo.show` / `logo.url` / `logo.handleClickLogo`
- **菜单栏**：背景色、语言切换、新建/加载/保存/教程/Turbo/Debug 按钮显隐，新建/加载/保存/教程按钮的 `handleBefore` 拦截，用户头像（`userAvatar.show`；`handleClick` 覆盖默认菜单打开行为）、我的物品、自定义按钮（`customButtons`）
- **积木区**：缩放比例（`blocks.scale`）、隐藏分类（`hideCatagorys`）、隐藏积木（`hideBlocks`）
- **舞台区**：全屏/绿旗/停止按钮显隐+拦截、舞台尺寸/缩放
- **素材库**：`assets.assetHost`；自定义素材通过 `window.scratch.push*Library` 运行时注入
- **编辑器模式**：`readOnly`（只读锁定：blocks 工作区禁用、隐藏添加/删除/复制/导出控件与属性输入）、`blocksOnly`（纯积木视图：隐藏舞台与目标面板，积木区占满窗口）
- **生命周期钩子**：`handleVmInitialized` / `handleProjectLoaded`（每次 VM 加载项目后触发，包括 `loadProject`）/ `handleDefaultProjectLoaded`（首个项目加载后触发一次）/ `handleProjectChanged`（编辑/保存时脏状态回调）/ `handleCloudStatusChange`（云连接 `connecting|connected|error|disconnected` 状态回调）

> 与 easy-scratch3 的差异：`defaultProjectURL`、`assets.defaultIndex` 和 `assets.handleBefore*LibraryOpen` 依赖旧版内部实现，v15 封装未提供。默认作品请在 `handleDefaultProjectLoaded` 中调用 `window.scratch.loadProject(url, cb)`；自定义素材请用 `window.scratch.push*Library` 注入。

### React 组件

```jsx
import {EasyScratch} from '@lanqu/scratch-gui';

<EasyScratch scratchConfig={config} style={{height: '100vh'}} />
```

`scratchConfig` 只在挂载时读取，需要更换配置时用 `key` 重新挂载；`isPlayerOnly` 可作为独立 prop 传入并在初始化时生效。其余 props 透传给编辑器根节点，`ref` 暴露 `getRoot()` / `unmount()` / `config` / `store`。也可以继续使用命令式的 `createEasyRoot(config, container)`。

### 命令式 API（`window.scratch.*`）

| API | 功能 |
|-----|------|
| `loadProject(url, cb)` | 从 URL 加载 .sb3；失败时 `cb(error)` |
| `getProjectFile(cb)` | 导出当前项目为 .sb3；失败时 `cb(null, error)` |
| `getProjectCover(cb)` / `getProjectCoverBlob(cb)` | 获取舞台截图 |
| `getProjectName()` / `setProjectName(name)` | 读写项目名 |
| `setPlayerOnly(bool)` / `setFullScreen(bool)` | 切换模式 |
| `setLocale(locale)` | 切换语言 |
| `setEnableCouldData(bool)` / `setCloudId(id)` / `getCloudId()` / `setAuthorUsername(name)` | 云变量控制 |
| `isDirty()` / `markSaved()` | 脏状态查询与保存确认（配对 `handleProjectChanged` 驱动自动保存） |
| `onCloudStatusChange(cb)` | 订阅云连接状态（注册即回放最近一次状态） |
| `pushSpriteLibrary(data)` 等 4 个 | 运行时追加素材库（按素材 id 去重） |

## 与 teaching-open 集成

`@lanqu/scratch-gui` 的构建产物部署到 teaching-open 的两个前端 —— `web/public/scratch3/`（旧 Vue 端）与 `student-web/public/scratch3/`（生产 React 端，运行时产物被 gitignore 不入库），作为蓝鹊教学平台的 Scratch 编辑器：

- `index.html` / `player.html` 含蓝鹊 `scratchConfig`（后端 API、提交作业逻辑）
- `chunks/gui.js` 是封装包产物（引用 scratch-gui v15 standalone dist）
- 懒加载 chunk（paper 沙箱、tutorial steps、fetch-worker、mediapipe）额外镜像到前端 `public/chunks/`（即站点根 `/chunks/`）：scratch-gui standalone 的内嵌 runtime 以 `/` 为 publicPath 请求这些文件，命中 SPA fallback 的 HTML 会报 ChunkLoadError；`/static/assets/` 下的 sandbox 脚本（`runner`、`measure-svg`、`paper-core`、`paper-import`）同理经 student-web 的 `scratch3-fallback.mjs` 镜像到根 `/static/`
- 背包/云变量走蓝鹊后端（`/api/teaching/scratch/backpack`、`/api/websocket/scratch/cloudData`）
- 支持按 `workId` 加载学生作品

## 升级流程

跟随 scratch-editor 官方升级，一条命令：

```bash
./scripts/upgrade-from-upstream.sh              # 默认从 v15.2.0（tag）
./scripts/upgrade-from-upstream.sh develop      # 指定分支/tag
```

脚本自动：fetch → 备份分支 → rebase → 冲突指引 → 清缓存重建 → 验证清单。

所有 patch 遵循"新增可选 prop/参数，默认行为不变"。从 14.1.0 到 v15.2.0 的大版本升级以 merge 方式合入（历史保留，无需强推），冲突集中在 README、锁文件和定制素材库 JSON。详见 `packages/scratch-gui/PATCHES.md`。

## 开发

```bash
# 环境：node v24（见 .nvmrc），需 Clash 代理（localhost:7897）
source ~/.nvm/nvm.sh && nvm use

# 构建 scratch-gui dist（改了 scratch-gui 源码后必须）
npm run build --workspace=@scratch/scratch-gui

# 构建/调试封装包
npm run build --workspace=@lanqu/scratch-gui
npm start --workspace=@lanqu/scratch-gui   # playground http://localhost:8602
```

## License

AGPL-3.0-only（继承 scratch-editor）
