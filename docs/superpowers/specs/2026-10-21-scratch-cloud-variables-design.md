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
- 未传 `cloudControl` 时行为与上游完全一致。

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
- `render` 不把 `cloudControl` 透传给 GUI 组件。

文件：`PATCHES.md`

- 增加云变量扩展点说明。

### 5.2 `packages/lanqu-scratch-gui`

文件：`src/api/scratch-api.js`

- `ScratchApiWrapper` 增加 state。
- `registerApi` 中的三个云变量 API 改为更新 state + config。
- `render` 注入 `cloudControl`。
- `setCloudId` 兼容 `'0'` 和空值：空值不覆盖已有有效 ID。

文件：`src/storage/lanqu-storage.js`

- `cloudVariables` 始终存在，不再只在启动时 `cloudData.enable=true` 时创建。
- `createProvider` 使用传入的 `projectId`，保留 `cloudId` 作为空值兜底。
- 保留 backpack 现有行为。

文件：`src/storage/lanqu-cloud-provider.js`

- WebSocket URL 支持带 `ws://` / `wss://` 的 host，也支持当前的 hostname + path。
- `parseMessage` 处理 `ack`：失败时输出可诊断日志。
- `clear` 重置 `isTryingToConnect`、取消 throttle、清理队列。
- 保持 10 条/秒节流和指数退避重连。

### 5.3 宿主页

文件：`deploy/teaching-open/scratch3/index.html`

- 保持 `cloudData.id: "create"`，由后端规范化为 `draft:<登录用户名>`。
- `session.token` / `session.username` 保持现状。
- 保存成功后继续调用 `window.scratch.setCloudId(workId)`。

文件：`deploy/teaching-open/scratch3/player.html`

- 增加：
  - `session.token: getUserToken()`
  - `session.username: (getUserInfo() && getUserInfo().username) || 'anonymous'`
- 匿名用户可连接读取；后端拒绝匿名 `set`。
- `cloudData.id` 使用 `workId || workUrl`，两者都没有时为空字符串。

## 6. 后端改动

文件：`teaching-open/api/jeecg-boot-module-system/src/main/java/org/jeecg/modules/message/websocket/ScratchWebSocket.java`

### 6.1 草稿隔离

新增 `resolveProjectId(projectId, loginUser)`：

- `projectId == "create"` 且用户已登录 → `draft:<username>`。
- `projectId == "create"` 且匿名 → 拒绝，避免读取共享的旧 `scratch:cloud:create`。
- `projectId` 以 `draft:` 开头 → 只允许该用户使用。
- 其它情况 → 原样返回作品 ID。

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
  - 读取旧值。
  - `hdel` 旧字段。
  - `hset` 新字段。
  - 返回 `ack`。
  - 不做跨客户端实时 rename 广播（见非目标）。
- `ack` 保持现有格式：
  ```json
  {"method":"ack","name":"变量名","reply":"OK"}
  ```

### 6.4 校验与并发

- 变量名非空且长度不超过 100。
- value 字符串长度不超过 1024。
- 创建时检查该 projectId 下变量数不超过 10。
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

### 8.2 wrapper 验证

- 已用 Playwright + 本地 mock WebSocket 验证：
  - 初始 `enable=false`，运行时 `setEnableCouldData(true)` 能建立连接。
  - 初始连接使用 `project_id="create"`，并携带 `session.token` / `session.username`。
  - 调用 `setCloudId("work-1")` 后断开并重连到 `work-1`。
  - 调用 `setEnableCouldData(false)` 后断开，再次开启后重连。
  - `set` 消息能发到服务端；服务端广播的 `set` 能更新舞台云变量。
  - `setAuthorUsername("teacher")` 后按新用户名重连。

### 8.3 后端验证

- 编译 `api` 模块。
- 已有单测覆盖：草稿 projectId 规范化、draft 所有者校验、匿名 `set` 拒绝、登录 `set` 写 Redis、正式作品作者校验、草稿变量上限、变量名/值长度、Redis key 前缀。
- 有 Redis / 登录 token 环境时仍需跑真实 WebSocket 双客户端验证：
  1. `handshake`（匿名可读）。
  2. 匿名 `set` → 收到 `ack FAIL`。
  3. 登录 `set` → Redis 写入并广播。
  4. 新作品 `project_id="create"` → Redis key 为 `scratch:cloud:draft:<username>`。
  5. `create` / `delete` / `rename` 作者校验。

### 8.4 构建

```bash
npm test --workspace=@scratch/scratch-gui -- --runTestsByPath test/unit/util/cloud-manager-hoc.test.jsx
npm run build --workspace=@lanqu/scratch-gui
```

后端：

```bash
cd teaching-open/api
mvn -pl jeecg-boot-module-system -am -DskipTests compile
```

## 9. 风险与限制

- 已连接的其它客户端不会实时看到云变量重命名，需要重新加载项目。
- 单实例 sessionPool 不支持多实例广播。
- 草稿值在第一次保存后不迁移到正式作品；重新打开作品时使用项目文件里的初始值。
- 匿名用户可以读取任意已知 workId 的云变量；写操作需要登录。
- 当前 `set` 只要求有效登录 token，尚未按作品作者/班级成员限制写入；后续如需严格权限需再补作品访问校验。
- 播放器匿名用户如果运行含云变量的项目，项目代码的 `set` 会被后端拒绝，可能产生控制台日志。

## 10. 涉及文件

前端：

- `packages/scratch-gui/src/lib/cloud-manager-hoc.jsx`
- `packages/scratch-gui/PATCHES.md`
- `packages/scratch-gui/test/unit/util/cloud-manager-hoc.test.jsx`
- `packages/lanqu-scratch-gui/src/api/scratch-api.js`
- `packages/lanqu-scratch-gui/src/index.js`
- `packages/lanqu-scratch-gui/src/storage/lanqu-storage.js`
- `packages/lanqu-scratch-gui/src/storage/lanqu-cloud-provider.js`
- `deploy/teaching-open/scratch3/index.html`
- `deploy/teaching-open/scratch3/player.html`

后端：

- `teaching-open/api/jeecg-boot-module-system/src/main/java/org/jeecg/modules/message/websocket/ScratchWebSocket.java`
- `teaching-open/api/jeecg-boot-module-system/src/test/java/org/jeecg/modules/message/websocket/ScratchWebSocketTest.java`
- `teaching-open/api/jeecg-boot-module-system/src/test/java/org/jeecg/modules/message/websocket/ScratchWebSocketAuthTest.java`
