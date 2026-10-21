# Scratch 云变量全链路支持设计

- 日期：2026-10-21
- 状态：已实现
- 范围：`happy-scratch-mono` 前端、`teaching-open` 宿主页与后端 `ScratchWebSocket`

## 1. 目标

让蓝鹊 Scratch 编辑器和播放器的云变量真正可用：

1. 项目加载后按作品 ID 建立 WebSocket 连接。
2. `setCloudId` / `setEnableCouldData` / `setAuthorUsername` 在运行时生效并触发重连。
3. 登录用户可写云变量；匿名用户只读。
4. 新作品未保存前使用按用户隔离的草稿空间，不能所有学生共用 `scratch:cloud:create`。
5. 保留现有安全限制：使用 video sensing / face sensing 扩展时不连接云变量。

## 2. 非目标

- 本次不做多实例 Redis Pub/Sub 广播。当前 `deploy/docker-compose.yml` 只有一个 `api` 容器；实现保留以后接入 Pub/Sub 的位置。
- 本次不实现跨客户端的实时变量重命名同步。后端会持久化新的变量名，已连接的其它客户端需要重新加载项目才能看到新名字。
- 本次不改变 Scratch 云变量最多 10 个的产品限制。
- 本次不重构无关的素材库、背包或部署流程。

## 3. 当前断点

### 3.1 连接条件

上游 `cloudManagerHOC` 只在以下条件同时满足时连接：

- `storage.cloudVariables`
- `cloudHost`
- `username`
- `vm`
- `projectId`
- `hasCloudPermission`
- `isShowingWithId`
- `vm.runtime.hasCloudData()`
- `canModifyCloudData`

当前 wrapper：

- 初始化时把 redux `projectId` 设为默认项目 `'0'`，`loadProject` 不更新 redux。
- `canSave=false`，导致编辑器模式 `canModifyCloudData=false`。
- `cloudData.id` 被 `'0'` 覆盖。
- `setCloudId` / `setEnableCouldData` / `setAuthorUsername` 只修改配置对象，不重连。

### 3.2 后端

`teaching-open` 的 `ScratchWebSocket` 已支持 `handshake` / `create` / `set` / `delete`，但：

- 没有 `rename` 分支。
- `set` 不要求登录。
- `"create"` 是所有新作品共用的 Redis key。
- `sessionPool` 是非线程安全的 `HashMap`。
- 缺少变量数量、名称和值长度校验。

## 4. 架构

### 4.1 数据流

```text
积木 set/change
  → scratch3_data.js: variable.isCloud
  → VM Cloud IO Device
  → provider.updateVariable(name, value)
  → LanquCloudProvider WebSocket
  → {"method":"set","project_id":...,"name":...,"value":...,"token":...}
  → ScratchWebSocket.set()
  → Redis HSET scratch:cloud:<projectId>
  → 广播给同一 projectId 的 session
  → provider.onMessage()
  → parseMessage() → {varUpdate:{name,value}}
  → vm.postIOData('cloud', ...)
  → Cloud.updateCloudVariable()
  → 舞台变量值更新
```

### 4.2 连接控制

新增可选 `cloudControl` prop，由 `@lanqu/scratch-gui` 注入：

```js
cloudControl: {
    enabled: boolean,
    projectId: string,
    username: string,
    canModifyCloudData: boolean,
    canWrite: boolean
}
```

`cloudManagerHOC` 的规则：

- `enabled !== false` 才允许连接。
- `projectId` 优先于 redux `projectState.projectId`。
- `username` 优先于 `props.username`。
- `projectId` 存在时，不再强制要求 `isShowingWithId`。
- `canModifyCloudData` 覆盖编辑器的 `canSave` 限制，但 video/face sensing 的安全检查仍然生效。
- `canWrite` 只影响 UI 是否显示云变量勾选框，不影响只读连接。
- 未传 `cloudControl` 时连接条件与上游一致；`componentDidUpdate` 仅调整为先断开失效连接、再按当前 props 连接，避免同一轮重复连接。

### 4.3 连接生命周期

`scratchApiHOC` 维护：

```js
{
    cloudEnabled,
    cloudProjectId,
    cloudUsername,
    cloudWritable
}
```

- 初始化时从 `scratchConfig` 解析。
- `setCloudId(id)` 更新 `cloudProjectId`，触发 `cloudManagerHOC` 断开旧连接并连接新作品；空值和默认 `'0'` 被忽略。
- `setEnableCouldData(enable)` 更新 `cloudEnabled`。
- `setAuthorUsername(name)` 更新 `cloudUsername`。
- `session.token` 是否存在决定 `cloudWritable`。
- 匿名用户不连接 `create` / `draft:` 草稿空间；已保存作品仍可只读连接。
- 宿主在“新建”确认后、以及“从计算机加载”文件选择后调用 `setCloudId('create')` 并清空 `workId`，避免新项目继续写旧作品；本地文件加载失败时恢复原 `workId` 与云变量空间。
- 保存成功后无论项目是否包含云变量都调用 `setCloudId(workId)`；这样后续新增云变量会落到正式作品，而不是草稿空间。
- 未保存作品使用 `draft:<用户名>:<会话>` 桶：
  - 会话 id 由浏览器生成，按用户名存在 localStorage。
  - 同一浏览器重新打开同一个未保存作品时会话不变，草稿值不丢。
  - “新建”和“加载本地文件”会轮换会话，新作品从空桶开始，不会继承上一个草稿的变量和值。
  - 宿主用 `getCloudId()` 取回当前会话，文件加载失败时原样恢复。

## 5. 前端改动

### 5.1 `packages/scratch-gui`

文件：`src/lib/cloud-manager-hoc.jsx`

- 新增 `cloudControl` propTypes。
- 新增有效值解析函数：
  - `getCloudControl(props)`
  - `getCloudProjectId(props)`
  - `getCloudUsername(props)`
- `canUseCloud` 拆成：
  - `canConnectCloud(props)`：连接条件，不含 `canWrite`。
  - `canUseCloud(props)`：连接条件 + `canWrite !== false`，只用于 UI。
- `shouldConnect`：
  - 使用有效 projectId / username。
  - `cloudControl.projectId` 存在时跳过 `isShowingWithId`。
  - 保留 `hasCloudData` 和 `canModifyCloudData`。
- `shouldDisconnect`：
  - 使用有效 projectId / username 比较。
  - `cloudControl.enabled === false` 时断开。
- `connectToCloud` 使用有效 projectId / username。
- `componentDidUpdate` 先处理失效连接，再按当前 props 决定是否连接；projectId 与云变量同时变化时只建立一次连接。
- `render` 不把 `cloudControl` 透传给 GUI 组件。

文件：`components/menu-bar/menu-bar.jsx`、`components/gui/gui.jsx`

- 新增可选 `onBeforeNewProject`：用户确认替换项目后、真正新建前调用；返回 `false` 可阻止新建。

文件：`lib/sb-file-uploader-hoc.jsx`

- 新增可选 `onBeforeProjectUpload` / `onAfterProjectUpload` / `onProjectUploadFailed`：
  - 文件选择并确认后、加载前调用；
  - 加载成功/失败后分别调用，宿主可切换或恢复云变量空间。

文件：`PATCHES.md`

- 增加云变量扩展点说明。

### 5.2 `packages/lanqu-scratch-gui`

文件：`src/api/scratch-api.js`

- `ScratchApiWrapper` 增加 state。
- `registerApi` 中的三个云变量 API 改为更新 state + config。
- `render` 注入 `cloudControl`。
- `setCloudId` 兼容 `'0'` 和空值：空值不覆盖已有有效 ID。
- `setCloudId('create')` 轮换草稿会话（新建作品、新加载的本地文件）。
- 新增 `getCloudId()`：宿主可以取回当前云变量作品/草稿 id，文件加载失败时原样恢复。
- 草稿会话 id 存在 localStorage（按用户名分键），刷新页面后未保存作品的云变量不丢。

文件：`src/storage/lanqu-storage.js`

- `cloudVariables` 始终存在，不再只在启动时 `cloudData.enable=true` 时创建。
- `createProvider` 使用传入的 `projectId`，保留 `cloudId` 作为空值兜底。
- 保留 backpack 现有行为。

文件：`src/storage/lanqu-cloud-provider.js`

- WebSocket URL 支持带 `ws://` / `wss://` 的 host，也支持当前的 hostname + path。
- `parseMessage` 处理 `ack`：失败时输出可诊断日志。
- `clear` 重置 `isTryingToConnect`、取消 throttle、清理队列。
- 连接未建立时，`create` / `delete` / `rename` 和 `set` 都进入有序队列；同一变量的多个未发送 `set` 合并为最新值。
- 连接建立后先发 `handshake`，再按顺序直接发送队列；管理消息不再经过 throttle，避免项目一次加载多个云变量时只发送首尾两条。
- 管理消息发送前先 `flush` 挂起的 `set`，避免 rename/delete 之后又用旧变量名写回。
- 保持 10 条/秒节流和指数退避重连。

### 5.3 宿主页

文件：`deploy/teaching-open/scratch3/index.html`

- 保持 `cloudData.id: "create"`，由后端规范化为 `draft:<登录用户名>`。
- `session.token` / `session.username` 保持现状。
- 保存成功后无论 `hasCloudData()` 是否为真都更新 `workId` 并调用 `window.scratch.setCloudId(workId)`。
- “新建”确认后清空 `workId` 并切到 `create`。
- 本地文件选择后、加载前清空 `workId` 并切到 `create`；加载失败时恢复旧 `workId` 和旧云变量空间。

文件：`deploy/teaching-open/scratch3/player.html`

- 增加：
  - `session.token: getUserToken()`
  - `session.username: (getUserInfo() && getUserInfo().username) || 'anonymous'`
- 匿名用户可连接读取；后端拒绝匿名 `set`。
- `cloudData.id` 使用 `workUrl || workId`，与宿主加载项目的优先级一致；两者都没有时为空字符串。

## 6. 后端改动

文件：`teaching-open/api/jeecg-boot-module-system/src/main/java/org/jeecg/modules/message/websocket/ScratchWebSocket.java`

### 6.1 草稿隔离

新增 `resolveProjectId(projectId, loginUser)`：

- `projectId == "create"` 且用户已登录 → `draft:<username>`（兼容旧客户端）。
- `projectId == "create:<session>"` 且用户已登录 → `draft:<username>:<session>`，会话 id 只允许字母数字和 `-` `_`，最长 64。
- `projectId == "create"` 或 `create:<session>` 且匿名 → 拒绝，避免读取共享的旧 `scratch:cloud:create`。
- `projectId` 以 `draft:` 开头 → 只允许该用户使用（可带 `:session` 后缀）。
- 其它情况 → 原样返回作品 ID。
- 规范化后的长度不超过 200。

`handshake` / `create` / `set` / `delete` / `rename` 都使用规范化后的 projectId。

### 6.2 权限

- `handshake`：允许匿名读取已保存作品；`create` 草稿空间仍需登录。
- `set`：必须提供有效 token，否则 `ack FAIL` 且不写 Redis。
- `create` / `delete` / `rename`：
  - 正式作品：必须是作品作者。
  - 草稿作品：必须是 draft 所有者。
- 无法解析 token，或 `create` / `delete` / `rename` 的作品不存在时返回 `ack FAIL`。

### 6.3 协议

- 增加 `rename` 分支：
  - 读取旧值；旧变量不存在时失败。
  - 新旧名称相同时返回 `ack OK`，不写 Redis、不删除变量。
  - 新名称已存在时拒绝，避免覆盖另一个变量。
  - `hset` 新字段后 `hdel` 旧字段。
  - 返回 `ack`。
  - 不做跨客户端实时 rename 广播（见非目标）。
- `ack` 保持现有格式：
  ```json
  {"method":"ack","name":"变量名","reply":"OK"}
  ```

### 6.4 校验与并发

- 变量名非空且长度不超过 100。
- value 字符串长度不超过 1024。
- projectId 规范化后长度不超过 200。
- 创建时检查该 projectId 下变量数不超过 10。
- `set` 可以写入已有变量；如果变量不存在，先检查 10 个上限再创建，避免绕过 `create` 限制。
- `create` 遇到已存在变量时只返回 `ack OK`，不覆盖 Redis 值；否则每次打开项目都会用文件里的快照重置云变量。
- 草稿桶写入时附带 30 天 TTL 并在每次写入时续期，作品桶永久保存。
- 每个连接每秒最多 50 条消息，超出的消息直接 `ack FAIL`，防止自定义客户端绕过前端的 10 条/秒节流。
- `sessionPool` 改为 `ConcurrentHashMap<String, CopyOnWriteArrayList<Session>>`。
- 保留单实例广播实现；在类注释中标明多实例需要 Redis Pub/Sub。

## 7. 错误处理

- WebSocket 连接失败：保留现有指数退避重连。
- `ack FAIL`：provider 输出包含 method/name/reply 的 warning，便于宿主排查。
- `setCloudId` 收到空值：忽略，避免把有效连接切到空 project。
- `setEnableCouldData(false)`：主动断开，并清空 VM 的 cloud provider。
- 后端参数非法：返回 `ack FAIL`，不抛到连接层。

## 8. 测试与验证

### 8.1 前端单测

`packages/scratch-gui/test/unit/util/cloud-manager-hoc.test.jsx` 新增：

1. `cloudControl.projectId` 在 `isShowingWithId=false` 时仍能连接。
2. `cloudControl.enabled=false` 时不连接。
3. `cloudControl.canWrite=false` 时仍建立连接，但 `canUseCloud` 为 false。
4. `cloudControl.canModifyCloudData=true` 时编辑器模式可连接。
5. video sensing / face sensing 仍然阻止连接。
6. `cloudControl.projectId` 变化时断开并重连。
7. projectId 变化且云变量同时出现时只连接一次。

`packages/scratch-gui/test/unit/components/menu-bar.test.jsx` 覆盖 `onBeforeNewProject` 的调用与阻止新建。

`packages/scratch-gui/test/unit/util/sb-file-uploader-hoc.test.jsx` 覆盖文件选择后、上传前的 `onBeforeProjectUpload` 调用及返回 `false` 时中止上传。

### 8.2 wrapper 验证

- 已用 Playwright + 本地 mock WebSocket 验证：
  - 初始 `enable=false`，运行时 `setEnableCouldData(true)` 能建立连接。
  - 初始连接使用 `project_id="create"`，并携带 `session.token` / `session.username`。
  - 调用 `setCloudId("work-1")` 后断开并重连到 `work-1`。
  - 调用 `setEnableCouldData(false)` 后断开，再次开启后重连。
  - `set` 消息能发到服务端；服务端广播的 `set` 能更新舞台云变量。
  - `setAuthorUsername("teacher")` 后按新用户名重连。
- 已用 Babel + mock WebSocket 验证 provider：
  - 连接建立前连续创建 3 个变量，`onOpen` 后按顺序发送 `handshake, create, create, create`。
  - 连接建立后创建变量立即发送。
  - 挂起的 `set` 会在 `rename` 前 flush，不会在 rename 后用旧名字写回。
  - 断线期间的多个 `set` 只保留每个变量的最新值，重连后发送。
- `scripts/cloud-e2e.mjs` 用真实 Chrome + mock WebSocket 跑宿主页：
  - 未保存作品的 `project_id` 是 `create:<会话>`。
  - `handshake` 先于 `create`。
  - 服务端推送的 `set` 能更新舞台变量。
  - “新建”轮换会话并使用新桶，旧桶不出现新作品的变量。
  - 刷新页面后会话不变。
  - 加载损坏的项目文件会恢复原会话。

### 8.3 后端验证

- 编译 `api` 模块。
- 已有单测覆盖：草稿 projectId 规范化、draft 所有者校验、匿名 `set` 拒绝、登录 `set` 写 Redis、正式作品作者校验、草稿/正式作品变量上限、加载项目时 `create` 不覆盖已有值、`set` 不绕过变量上限、变量名/值/projectId 长度、rename 同名 no-op 与目标重名拒绝、Redis key 前缀。
- `ScratchWebSocketProtocolTest` 用内存版 Redis 跑完整消息流：两个客户端的握手、广播、ack、匿名只读、草稿会话隔离、跨用户越权、限速。
- 后端 `ScratchWebSocketTest` 8 个、`ScratchWebSocketAuthTest` 12 个、`ScratchWebSocketProtocolTest` 8 个测试通过。
- 有 Redis / 登录 token 环境时仍需跑真实 WebSocket 双客户端验证：
  1. `handshake`（匿名可读）。
  2. 匿名 `set` → 收到 `ack FAIL`。
  3. 登录 `set` → Redis 写入并广播。
  4. 新作品 `project_id="create"` → Redis key 为 `scratch:cloud:draft:<username>`。
  5. `create` / `delete` / `rename` 作者校验。

### 8.4 构建

```bash
npx jest test/unit/util/cloud-manager-hoc.test.jsx \
  test/unit/components/menu-bar.test.jsx \
  test/unit/util/sb-file-uploader-hoc.test.jsx
npm run build --workspace=@lanqu/scratch-gui
```

后端：

```bash
cd teaching-open/api
mvn -pl jeecg-boot-module-system -am -DskipTests=false \
  -Dtest=ScratchWebSocketTest,ScratchWebSocketAuthTest \
  -DfailIfNoTests=false test
```

## 9. 风险与限制

- 已连接的其它客户端不会实时看到云变量重命名或删除，需要重新加载项目。
- 单实例 sessionPool 不支持多实例广播。
- 草稿值在第一次保存后不迁移到正式作品；重新打开作品时使用项目文件里的初始值。
- 草稿桶按“用户 + 浏览器会话”划分：同一用户在另一台设备或另一个浏览器上打开未保存作品时，看到的是另一个草稿桶。
- 草稿桶 30 天未写入即过期；已保存作品不受影响。
- 匿名用户可以读取任意已知 workId 的云变量；写操作需要登录。
- 当前 `set` 只要求有效登录 token，尚未按作品作者/班级成员限制写入；任意登录用户还可以把变量写到任意已知/构造的 projectId（受 200 字符长度和 10 个变量限制）。后续如需严格权限需补作品访问校验。
- 服务端每连接每秒 50 条消息的上限仍可被多连接放大；限速只能防误用，不能防定向刷写。
- 变量数量上限检查和写入不是原子操作；极端并发下可能短暂超过 10 个。
- 播放器匿名用户如果运行含云变量的项目，项目代码的 `set` 会被后端拒绝，可能产生控制台日志。
- WebSocket 在 throttle 窗口内断开时，窗口内最后一条待发送 `set` 可能丢失；重连后队列只包含断线期间写入的值。
- 浏览器级联调用例只覆盖“项目文件加载失败”的回滚；加载成功时新桶的行为由单元测试和代码路径保证。

## 10. 涉及文件

前端：

- `packages/scratch-gui/src/lib/cloud-manager-hoc.jsx`
- `packages/scratch-gui/src/lib/sb-file-uploader-hoc.jsx`
- `packages/scratch-gui/src/components/gui/gui.jsx`
- `packages/scratch-gui/src/components/menu-bar/menu-bar.jsx`
- `packages/scratch-gui/PATCHES.md`
- `packages/scratch-gui/test/unit/util/cloud-manager-hoc.test.jsx`
- `packages/scratch-gui/test/unit/util/sb-file-uploader-hoc.test.jsx`
- `packages/scratch-gui/test/unit/components/menu-bar.test.jsx`
- `packages/lanqu-scratch-gui/src/api/scratch-api.js`
- `packages/lanqu-scratch-gui/src/index.js`
- `packages/lanqu-scratch-gui/src/config/default-config.js`
- `packages/lanqu-scratch-gui/src/storage/lanqu-storage.js`
- `packages/lanqu-scratch-gui/src/storage/lanqu-cloud-provider.js`
- `scripts/cloud-e2e.mjs`
- `deploy/teaching-open/scratch3/index.html`
- `deploy/teaching-open/scratch3/player.html`

后端：

- `teaching-open/api/jeecg-boot-module-system/src/main/java/org/jeecg/modules/message/websocket/ScratchWebSocket.java`
- `teaching-open/api/jeecg-boot-module-system/src/test/java/org/jeecg/modules/message/websocket/ScratchWebSocketTest.java`
- `teaching-open/api/jeecg-boot-module-system/src/test/java/org/jeecg/modules/message/websocket/ScratchWebSocketAuthTest.java`
