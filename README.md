# happy-scratch-mono

基于 [scratchfoundation/scratch-editor](https://github.com/scratchfoundation/scratch-editor) v14.1.0 的 Scratch 编辑器定制发行版，为蓝鹊（Lanqu）在线编程教学平台提供可嵌入的 Scratch 3.0 编辑器。

本项目将 [easy-scratch3](https://github.com/open-scratch/easy-scratch3)（基于 2021 版 scratch-gui 的二次封装）的全部定制能力，以 **方案**（薄封装层 + 最小化源码 patch）移植到最新的 scratch-editor v14.1.0 之上。

## 项目目标

- 跟随 scratch-editor 官方版本升级（保持低冲突 rebase）
- 保留 easy-scratch3 的全部定制能力（`window.scratchConfig` 声明式配置 + `window.scratch.*` 命令式 API）
- 通过薄封装包 `@lanqu/scratch-gui` 引用 `@scratch/scratch-gui`，尽量不改 scratch-gui 源码
- 必须改源码的定制点，遵循"新增可选 prop/参数，默认行为不变"原则，保证升级零冲突

## 仓库结构

```
packages/
├── scratch-gui/              # 官方 scratch-gui v14.1.0（含最小化 patch，见 [PATCHES.md](packages/scratch-gui/PATCHES.md)
├── scratch-vm/               # 官方 scratch-vm
├── scratch-render/           # 官方 scratch-render
├── scratch-svg-renderer/     # 官方 scratch-svg-renderer
├── scratch-media-lib-scripts/# 官方素材库脚本
├── task-herder/              # 官方异步任务调度
└── lanqu-scratch-gui/        # 蓝鹊封装包（B 方案核心）
    ├── src/
    │   ├── index.js              # createEasyRoot + buildPatchProps（scratchConfig → patch props）
    │   ├── config/               # scratchConfig 默认值 + EditorState/GUIConfig 转换
    │   ├── storage/              # 蓝鹊后端 adapter（背包 HTTP / 云变量 WebSocket / storage）
    │   ├── api/scratch-api.js    # window.scratch.* 命令式 API（16 个）+ locale 覆盖
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
- **作品元信息**：`projectInfo.projectName` / `authorUsername` / `authorAvatar`
- **LOGO**：`logo.show` / `logo.url` / `logo.handleClickLogo`
- **菜单栏**：背景色、语言切换、新建/加载/保存/教程/Debug 按钮显隐+拦截、用户头像、我的物品、自定义按钮（`customButtons`）
- **积木区**：缩放比例（`blocks.scale`）、隐藏分类（`hideCatagorys`）、隐藏积木（`hideBlocks`）
- **舞台区**：全屏/绿旗/停止按钮显隐+拦截、舞台尺寸/缩放
- **素材库**：`assets.assetHost` / 素材库索引地址 / 打开素材库拦截回调
- **生命周期钩子**：`handleVmInitialized` / `handleProjectLoaded` / `handleDefaultProjectLoaded`
- **默认项目**：`defaultProjectURL`

### 命令式 API（`window.scratch.*`）

| API | 功能 |
|-----|------|
| `loadProject(url, cb)` | 从 URL 加载 .sb3 项目 |
| `getProjectFile(cb)` | 导出当前项目为 .sb3 |
| `getProjectCover(cb)` / `getProjectCoverBlob(cb)` | 获取舞台截图 |
| `getProjectName()` / `setProjectName(name)` | 读写项目名 |
| `setPlayerOnly(bool)` / `setFullScreen(bool)` | 切换模式 |
| `setLocale(locale)` | 切换语言 |
| `setEnableCouldData(bool)` / `setCloudId(id)` / `setAuthorUsername(name)` | 云变量控制 |
| `pushSpriteLibrary(data)` 等 4 个 | 运行时追加素材库 |

## 与 teaching-open 集成

`@lanqu/scratch-gui` 的构建产物部署到 `teaching-open/web/public/scratch3/`，作为蓝鹊教学平台的 Scratch 编辑器：

- `index.html` / `player.html` 含蓝鹊 `scratchConfig`（后端 API、提交作业逻辑）
- `chunks/gui.js` 是封装包产物（引用 scratch-gui v14 standalone dist）
- 背包/云变量走蓝鹊后端（`/api/teaching/scratch/backpack`、`/api/websocket/scratch/cloudData`）
- 支持按 `workId` 加载学生作品

## 升级流程

跟随 scratch-editor 官方升级，一条命令：

```bash
./scripts/upgrade-from-upstream.sh              # 默认从 upstream/14.1.x
./scripts/upgrade-from-upstream.sh 14.x         # 指定分支
```

脚本自动：fetch → 备份分支 → rebase → 冲突指引 → 清缓存重建 → 验证清单。

所有 patch 遵循"新增可选 prop/参数，默认行为不变"，实测 rebase 零冲突（已验证 rebase 到 upstream/14.1.x 最新 3 个 commit）。详见 `packages/scratch-gui/PATCHES.md`。

## 开发

```bash
# 环境：node v24（见 .nvmrc），需 Clash 代理（localhost:7897）
source ~/.nvm/nvm.sh && nvm use 24.16.0

# 构建 scratch-gui dist（改了 scratch-gui 源码后必须）
npm run build --workspace=@scratch/scratch-gui

# 构建/调试封装包
npm run build --workspace=@lanqu/scratch-gui
npm start --workspace=@lanqu/scratch-gui   # playground http://localhost:8602
```

## License

AGPL-3.0-only（继承 scratch-editor）
