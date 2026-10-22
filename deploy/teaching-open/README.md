# teaching-open 宿主页（Lanqu-owned）

本目录保存部署到 teaching-open 的 Scratch 3 编辑器**宿主页面**与其依赖脚本的规范副本
（canonical copy）。这些文件包含蓝鹊业务配置（scratchConfig、上传/登录/素材库集成），
**不属于 webpack 构建产物**，因此 `deploy-to-teaching-open.sh` 的构建产物覆盖逻辑会跳过它们；
本目录使它们在 mono 仓库中有唯一事实来源，并由部署脚本统一回写。

## 文件清单

| 文件 | 部署目标（teaching-open） | 说明 |
| --- | --- | --- |
| `scratch3/index.html` | `student-web/public/scratch3/index.html`、`web/public/scratch3/index.html` | 编辑器宿主页（完整编辑器）。scratchConfig：提交/保存/返回按钮、云变量、背包、自定义素材库注入、匿名登录弹窗 |
| `scratch3/player.html` | `student-web/public/scratch3/player.html`、`web/public/scratch3/player.html` | 作品播放器宿主页。scratchConfig：云变量、防 draggable 竞态、素材加速 |
| `js/common.js` | `student-web/public/js/common.js`、`web/public/js/common.js` | 宿主页依赖（getSysConfig/getUserToken/upload2Qiniu/update2Local 等）。v29 |

## 关键契约

### player.html 的 `nofs=1` 查询参数

React 作品详情页（WorkDetail）自带 AntD 全屏按钮，跳转播放器时携带 `nofs=1`：

```
/scratch3/player.html?workId=<id>&nofs=1
```

player.html 据此隐藏 scratch-gui 内置的舞台全屏按钮，避免页面出现两个全屏按钮。
不带该参数时行为不变（旧 Vue 端、管理端预览等场景仍显示内置按钮）。

### 素材库加速（assetHost）

scratchConfig.assets.assetHost 取 `getSysConfig('qiniuDomain')`，让 Scratch 自带素材
（造型/背景 md5 资源）走七牛而不是 cdn.assets.scratch.mit.edu（国内慢/超时）。
依赖 **common.js v29**：v27 的 `getSysConfig` 有 bug（`return config` 返回整个对象而非
`config[key]`），两份文件必须成对部署。

### 自定义素材库注入

自定义素材通过 `window.scratch.push*Library` 注入：index.html 在
`handleDefaultProjectLoaded` 里调用 `loadScratchAssets()`，把后端
`getScratchAssets?assetType=X` 返回的完整 sprite/背景/声音 JSON 写入 redux
dynamicAssets。`pushAssets` 会按素材 id 去重，重复调用不会产生重复项。

### 上传 / 登录

- 提交/保存按 `getSysConfig('uploadType')` 分发七牛（upload2Qiniu）或本地（update2Local）上传
- 未登录点提交、或 getToken 返回 Token 失效时，弹登录框（/sys/login 图形验证码），
  登录成功后自动续做原操作
- 提交成功后二维码指向 `/work-detail?id=<作品id>`（React 端详情页）

## 部署映射说明

teaching-open 里 `web/public`（旧 Vue 前端）与 `student-web/public`（新 React 前端，
生产）各有一份 `scratch3/`。两份宿主页历史上发生过分叉；本目录的规范副本以 student-web
变体为基准（严格超集，向下兼容）：

- `player.js`/`gui.js` 等**构建产物**不属于本目录 —— 由 `scripts/deploy-to-teaching-open.sh`
  从 `packages/lanqu-scratch-gui/build` 部署（两份 public 的构建产物保持一致）
- 修改宿主页时：改本目录 → 跑 `scripts/deploy-to-teaching-open.sh`（会回写两份 public）
  → 在 teaching-open 分别构建/部署前端

## 云变量 WebSocket 的 nginx 要求（重要）

云变量端点是 `wss://<站点>/api/websocket/scratch/cloudData`（后端 context-path 是 `/api`，
端点类是 `@ServerEndpoint("/websocket/scratch/cloudData")`）。

teaching-open 的 nginx 通用规则是：

```nginx
location ^~ /api { proxy_pass http://api:8080/api/; }
```

`proxy_pass` 带 URI 结尾斜杠时，nginx 会把 `/api/xxx` 改写成 `/api//xxx`，
**双斜杠匹配不到 `@ServerEndpoint` 的路径，握手直接 404**（线上实测返回
`{"path":"/api//websocket/scratch/cloudData"}`）。消息中心等其它 WebSocket 同样不通。

因此 nginx 必须为 WebSocket 单独一条 location（已加到
`teaching-open/web/nginx/default.conf` 与 `资料/nginx.example.conf`）：

```nginx
location ^~ /api/websocket/ {
    proxy_pass       http://api:8080;   # 不带 URI，原样透传 /api/websocket/...
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_read_timeout 86400s;
}
```

改完 nginx 需要重启 web 容器才生效。

## 变更记录（相对于 web/public 旧变体的差异）

- player.html：draggable 竞态双守卫（全局 error + postIOData 包装）；移除重复
  `vm.runtime.start()`（绿旗不跑的根因）；scale 取 `min(宽/480, (高-64)/360)` 适配小屏；
  `nofs=1` 支持；assetHost 素材加速
- index.html：`loadScratchAssets()` 统一素材注入（替代钩子内重复注入）；默认项目路径
  `./static/project.sb3`；匿名登录弹窗 + 上传 token 过期重登续做；共享链接指向
  `/work-detail?id=`；smile.png 坏图（从未存在）以 emoji 替代
