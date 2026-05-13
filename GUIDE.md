# 插件开发指南

## 0. 快速开始

### 前置条件

- Node.js >= 18

### 初始化

```sh
npm install
```

`sdk/` 是内嵌的 `@pasty/plugin-sdk`，`npm install` 会自动触发 `sdk/prepare`，在本地编译 `sdk/dist/`。完成后不需要任何额外步骤即可使用 SDK。

### 本地开发

```sh
npm run dev
```

启动 Vite 开发服务器并打开预览工作台（Preview Workbench）。工作台提供两个视图：

- `?view=renderer` — 模拟宿主推送 attachment bootstrap，预览 attachment renderer 卡片
- `?view=action` — 模拟宿主推送 action session，预览 draft action 表单

修改 `src/ui/` 下的 Vue/JS 文件，浏览器热更新。

也可以单独指定视图：

```sh
npm run dev:renderer   # 直接打开 renderer 视图
npm run dev:action     # 直接打开 action 视图
```

### 生产构建

```sh
npm run build
```

依次执行：clean → build:sdk → build:runtime → build:ui → verify:build，输出到 `dist/`。

### 测试

```sh
npm test
```

运行 `tests/` 下所有集成测试（Node test runner，无需安装额外测试框架）。SDK 自身测试：

```sh
cd sdk && npm test
```

### 开发起点

| 要开发的产物 | 从哪里开始 |
|---|---|
| Detector | `src/runtime/detectors/` |
| Attachment renderer（runtime 侧） | `src/runtime/renderers/` |
| Attachment renderer（UI 侧） | `src/ui/renderers/` |
| Action（runtime 侧） | `src/runtime/actions/` |
| Action（UI 侧） | `src/ui/actions/` |
| 插件声明 | `manifest.json` |

---

## 1. 架构

### 执行上下文

一个 v2 插件在两个完全隔离的执行环境中运行：

**Node runtime** — 插件 `manifest.json` 声明的 `runtime.nodeEntry` 入口，在宿主管理的 Node.js 子进程中加载。负责所有业务逻辑：detector、attachment renderer、action 的核心计算；可通过 `ctx.host.*` 调用宿主 API。

**WebView UI** — 插件 `manifest.json` 声明的 `uiEntry` HTML 页面，在宿主 WebView 中运行。负责 attachment renderer 卡片和 draft action 表单的渲染与交互；通过 `@pasty/plugin-sdk/ui` 的 `pasty.*` 对象与宿主通信。

两个上下文互不共享内存，通过宿主协议通信。

### 三类产物

| 产物 | 运行位置 | 核心方法 |
|---|---|---|
| **detector** | Node runtime | `detect(input, ctx)` — 把 item 内容转换成 artifact |
| **attachment renderer** | Node runtime + WebView UI | `resolveAttachment(input, ctx)` + `invokeOperation(input, ctx)` |
| **action** | Node runtime + WebView UI（draft lifecycle）| `resolveSession(input, ctx)` + `invokeOperation(input, ctx)` |

### 数据流

```
                     ┌─────────────────────────────┐
                     │          Pasty Host          │
                     └──────────┬──────────┬────────┘
                                │          │
              ┌─────────────────▼──┐   ┌───▼──────────────────┐
              │   Node Runtime     │   │    WebView UI         │
              │                    │   │                       │
              │  definePlugin()    │   │  import { pasty }     │
              │    setup(init)     │   │    from '@pasty/       │
              │      ↓             │   │     plugin-sdk/ui'    │
              │  ctx.host.*        │   │                       │
              │  (clipboard/nav/   │   │  await pasty.ready()  │
              │   item/settings)   │   │  pasty.item.current() │
              │                    │   │  pasty.action.*       │
              └────────────────────┘   └───────────────────────┘
```

**Host → Plugin 推送：**
- 宿主向 Node runtime 发送 handler 调用（detect / resolveAttachment / invokeOperation 等）
- 宿主向 WebView 推送 bootstrap 数据（item、attachment、action session）
- 宿主向 WebView 推送状态更新（attachment updated、theme updated、search updated）

**Plugin → Host 请求：**
- Node runtime 通过 `ctx.host.*` 同步调用宿主 API
- WebView 通过 `pasty.*` Verb 调用宿主 API（setHeight、setTags、invoke 等）

### 工程目录结构

```text
my-plugin/
├── manifest.json
├── package.json
├── sdk/                        ← 内嵌 @pasty/plugin-sdk（随模板一起交付）
│   ├── package.json
│   ├── src/
│   └── dist/                   ← 编译产物，npm install 自动生成（gitignore）
├── scripts/
│   ├── build-runtime.mjs
│   └── build-ui.mjs
├── src/
│   ├── runtime/
│   │   ├── index.js            ← definePlugin 入口
│   │   ├── detectors/
│   │   ├── renderers/
│   │   └── actions/
│   └── ui/
│       ├── renderers/
│       └── actions/
└── dist/                       ← 编译产物，npm run build 生成（gitignore）
    ├── runtime/
    │   └── index.cjs
    └── ui/
```

---

## 2. manifest.json 规范

### 2.1 顶层字段

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `schemaVersion` | `number` | 是 | 固定为 `2` |
| `plugin` | `object` | 是 | 插件身份信息 |
| `install` | `object` | 否 | 安装期 hook 配置 |
| `runtime` | `object` | 是 | runtime 与 UI 根目录 |
| `permissions` | `string[]` | 否 | mutation 权限声明（缺省为空数组） |
| `attachmentRenderers` | `object[]` | 否 | attachment renderer 列表 |
| `detectors` | `object[]` | 否 | detector 列表 |
| `actions` | `object[]` | 否 | action 列表 |

### 2.2 `plugin`

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `plugin.id` | `string` | 是 | 插件稳定命名空间，建议反向域名风格（如 `plugin.example.demo`） |
| `plugin.title` | `string` | 是 | 插件显示名称 |
| `plugin.version` | `string` | 是 | 插件版本号，宿主按字符串处理 |

### 2.3 `install`（可选）

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `install.runtime` | `string` | 是 | 安装脚本运行时：`node`、`bash` |
| `install.entry` | `string` | 是 | 安装脚本路径，相对插件根目录，不允许跳出根目录 |

### 2.4 `runtime`

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `runtime.nodeEntry` | `string` | 是 | Node runtime 入口，相对插件根目录 |
| `runtime.uiRoot` | `string` | 是 | UI 根目录，所有 `uiEntry` 相对此目录解析 |

### 2.5 `permissions`

| 权限值 | 门控的 SDK 方法 |
|---|---|
| `setTags` | `ctx.host.item.setTags` / `addTags` / `removeTags`（runtime）；`pasty.item.setTags` / `addTags` / `removeTags`（UI） |
| `setPinned` | `ctx.host.item.setPinned`（runtime）；`pasty.item.setPinned`（UI） |
| `setAttachment` | `ctx.host.item.setAttachments`（runtime）；`pasty.item.setAttachments`（UI） |
| `setSearchExtension` | `ctx.host.item.setSearchExtension`（runtime）；`pasty.item.setSearchExtension`（UI） |

未声明的权限对应方法在运行时会受控失败，不能依赖其行为。

### 2.6 `attachmentRenderers[]`

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `id` | `string` | 是 | renderer 局部 ID，同插件内唯一 |
| `title` | `string` | 是 | 显示名称 |
| `attachmentType` | `string` | 是 | 该 renderer 负责的 attachment type，建议以 `plugin.id + "."` 为前缀 |
| `height` | `number \| "auto" \| object` | 否 | 卡片高度策略，见下方三种形态 |
| `uiEntry` | `string` | 否 | 本地 HTML 页面路径，相对 `runtime.uiRoot` |

**height 三种形态：**

```json
{ "height": 320 }            // 固定高度（1–800 px）
{ "height": "auto" }         // 自适应，范围 [80, 800]
{ "height": { "min": 120, "max": 480 } }  // 有界范围
```

省略 `height` 等价于 `{ "min": 80, "max": 400 }`。`"auto"` 和 `{ min, max }` 形态下，**插件须在 UI 代码中显式调用 `pasty.window.autoFit()`**，SDK 不会自动启动。

### 2.7 `detectors[]`

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `id` | `string` | 是 | detector 局部 ID，同插件内唯一 |
| `title` | `string` | 是 | 显示名称 |
| `supportedInputKinds` | `string[]` | 是 | 支持的输入类型：`text`、`image`、`path_reference`；不允许空数组 |
| `attachmentTypes` | `string[]` | 是 | 可能产出的 attachment type 列表；每项须在 `attachmentRenderers[]` 中有对应 renderer |

### 2.8 `actions[]`

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `id` | `string` | 是 | action 局部 ID，同插件内唯一 |
| `title` | `string` | 是 | 显示名称 |
| `supportedItemTypes` | `string[]` | 是 | 支持的 item type：`text`、`image`、`path_reference`；不允许空数组 |
| `lifecycle` | `string` | 是 | `auto-run` 或 `draft` |
| `keywords` | `string[]` | 否 | Action catalog 搜索关键词 |
| `uiEntry` | `string` | 否 | draft action 的 HTML 入口，相对 `runtime.uiRoot` |

### 2.9 最小完整示例

```json
{
  "schemaVersion": 2,
  "plugin": {
    "id": "plugin.example.sample",
    "title": "Sample Plugin",
    "version": "0.1.0"
  },
  "runtime": {
    "nodeEntry": "dist/runtime/index.cjs",
    "uiRoot": "dist/ui"
  },
  "permissions": ["setTags", "setPinned"],
  "attachmentRenderers": [
    {
      "id": "sample-renderer",
      "title": "Sample Renderer",
      "attachmentType": "plugin.example.sample.card",
      "height": 320,
      "uiEntry": "renderers/sample/index.html"
    }
  ],
  "detectors": [
    {
      "id": "sample-detector",
      "title": "Sample Detector",
      "supportedInputKinds": ["text"],
      "attachmentTypes": ["plugin.example.sample.card"]
    }
  ],
  "actions": [
    {
      "id": "sample-action",
      "title": "Sample Action",
      "supportedItemTypes": ["text"],
      "lifecycle": "draft",
      "keywords": ["sample"],
      "uiEntry": "actions/sample/index.html"
    }
  ]
}
```

---

## 3. SDK Reference

SDK 通过两个 subpath 入口提供：

```js
// Node runtime 侧（CJS）
const { definePlugin, actionResult, rendererResult } = require('@pasty/plugin-sdk/runtime');

// WebView UI 侧（ESM）
import { pasty } from '@pasty/plugin-sdk/ui';
```

详细方法清单见 [`sdk/README.md`](./sdk/README.md)。SDK 扩展规范与命名规则见 [`sdk/SPECIFICATION.md`](./sdk/SPECIFICATION.md)。

### 3.1 `@pasty/plugin-sdk/runtime`

#### `definePlugin(definition)`

验证并返回插件定义对象。`definition.setup` 不是函数时抛错。

```js
const { definePlugin } = require('@pasty/plugin-sdk/runtime');

module.exports = definePlugin({
  setup(init) {
    return {
      detectors: { 'my-detector': createMyDetector() },
      attachmentRenderers: { 'my-renderer': createMyRenderer() },
      actions: { 'my-action': createMyAction() }
    };
  }
});
```

`setup(init)` 的 `init` 对象：

| 字段 | 说明 |
|---|---|
| `init.plugin.id` | 当前插件 ID（来自 manifest） |
| `init.plugin.title` | 当前插件标题 |
| `init.plugin.version` | 当前插件版本 |
| `init.manifest.permissions` | 权限声明列表 |
| `init.host.platform` | 宿主平台（只读） |
| `init.host.hostVersion` | 宿主版本号（只读） |
| `init.host.devMode` | 是否开发模式（只读） |

`setup` 返回值的 registry key 须与 manifest 中对应 `id` 完全一致；key 不一致时宿主无法寻址该 capability。

#### `actionResult`

```js
const { actionResult } = require('@pasty/plugin-sdk/runtime');

actionResult.text('hello', { userMessage: 'Done' });
// → { result: { resultKind: 'text', text: 'hello' }, userMessage: 'Done' }

actionResult.none({ userMessage: 'Applied' });
// → { result: { resultKind: 'none', text: null }, userMessage: 'Applied' }
```

`value` 参数被强制转换为字符串；`null`/`undefined` → `""`。`userMessage` 使用 `??` 语义：空字符串 `""` 保留，仅 `null`/`undefined` 归一化为 `null`。

#### `rendererResult`

```js
const { rendererResult } = require('@pasty/plugin-sdk/runtime');

rendererResult.success({ userMessage: 'Done' });
// → { success: true, userMessage: 'Done' }

rendererResult.failure('Something went wrong');
// → { success: false, userMessage: 'Something went wrong' }
```

#### `ctx.host.*`（handler 调用时注入）

| 命名空间 | 方法 | 说明 |
|---|---|---|
| `ctx.host.clipboard` | `copyText(text)` | 复制文本到系统剪贴板 |
| `ctx.host.navigation` | `openUrl(url)` | 打开 URL |
| | `revealInFinder(path)` | 在 Finder 中显示路径 |
| | `openFilePath(path)` | 用默认应用打开文件路径 |
| `ctx.host.item` | `setTags(tags)` → `string[]` | 替换 tags（需 `setTags` 权限） |
| | `addTags(tags)` → `string[]` | 追加 tags（需 `setTags` 权限） |
| | `removeTags(tags)` → `string[]` | 移除 tags（需 `setTags` 权限） |
| | `setPinned(bool)` | Pin/unpin item（需 `setPinned` 权限） |
| | `setAttachments(payload)` | 替换 attachment group（需 `setAttachment` 权限） |
| | `setSearchExtension(payload)` | 替换搜索扩展（需 `setSearchExtension` 权限） |
| `ctx.host.settings` | `get(key)` → `string \| null` | 读取单个插件设置（key 使用 `plugin.id + "."` 前缀） |
| | `getAll()` → `Record<string, string>` | 读取所有插件设置 |
| `ctx.host.capabilities` | （只读对象） | 当前已授权权限集合，见第 5 章 |

### 3.2 `@pasty/plugin-sdk/ui`

所有 UI 侧能力通过单一 `pasty` 对象访问。调用任何方法前先等待 `pasty.ready()`。

#### `pasty.ready()` → `Promise<void>`

在宿主完成 bootstrap 握手后 resolve。bootstrap globals 已存在时同步 resolve；否则等待宿主推送。

```js
import { pasty } from '@pasty/plugin-sdk/ui';

async function init() {
  await pasty.ready();
  const item = pasty.item.current();
}
```

#### API 形状说明

| 形状 | 接口 | 适用场景 |
|---|---|---|
| **Topic\<T\>** | `.current(): T` + `.on(fn): Unsubscribe` | bootstrap 时一定有值的状态 |
| **OptionalTopic\<T\>** | `.current(): T \| undefined` + `.on(fn): Unsubscribe` | 仅在特定上下文有值的状态 |
| **Stream\<T\>** | `.on(fn): Unsubscribe` | 离散事件流 |
| **Verb\<Args, Result\>** | `(args) => Promise<Result>` | 命令式调用 |

#### `pasty.item` — Topic\<ClipboardItem\>

```js
const item = pasty.item.current();             // 读取当前 item
const unsub = pasty.item.on(newItem => { });   // 订阅变化
```

| 方法 | 形状 | 说明 |
|---|---|---|
| `pasty.item.current()` | Topic | 当前 item 快照 |
| `pasty.item.on(fn)` | Topic | 订阅 item 变化 |
| `pasty.item.setTags(tags)` | Verb | 替换 tags（需 `setTags` 权限） |
| `pasty.item.addTags(tags)` | Verb | 追加 tags |
| `pasty.item.removeTags(tags)` | Verb | 移除 tags |
| `pasty.item.setPinned(bool)` | Verb | Pin/unpin item（需 `setPinned` 权限） |
| `pasty.item.setAttachments(p)` | Verb | 替换 attachment group（需 `setAttachment` 权限） |
| `pasty.item.setSearchExtension(p)` | Verb | 替换搜索扩展（需 `setSearchExtension` 权限） |

#### `pasty.item.attachment` — OptionalTopic\<AttachmentPayload\>（attachment renderer 上下文）

```js
const payload = pasty.item.attachment.current();    // 读取当前 attachment payload
const unsub = pasty.item.attachment.on(p => { });   // 订阅 attachment 更新

// 触发 renderer 按钮
await pasty.item.attachment.invoke('copy-json', { format: 'pretty' });

// 订阅宿主发起的 action 点击（按钮点击直接由宿主触发的场景）
const unsub2 = pasty.item.attachment.onHostInvoke(({ actionID }) => { });
```

#### `pasty.item.search` — OptionalTopic\<string[]\>（attachment renderer 上下文）

```js
const terms = pasty.item.search.current();
const unsub = pasty.item.search.on(terms => { });
```

#### `pasty.theme` — Topic\<PluginThemeTokenSnapshot\>

```js
const snapshot = pasty.theme.current();
const unsub = pasty.theme.on(snapshot => {
  document.documentElement.style.setProperty(
    '--my-accent', snapshot['--pasty-accent']
  );
});

// 主动刷新（canvas 绘制等场景）
const latest = await pasty.theme.refresh();
```

宿主在 WebView 启动时自动注入 12 个 CSS token：

| CSS Token | 语义 |
|---|---|
| `--pasty-surface` | 页面/卡片背景色 |
| `--pasty-surface-elevated` | 浮层/弹出面板背景色 |
| `--pasty-text-primary` | 主要正文文字 |
| `--pasty-text-secondary` | 次要/辅助文字 |
| `--pasty-text-tertiary` | 淡化/提示文字 |
| `--pasty-accent` | 品牌/强调色 |
| `--pasty-accent-contrast` | 叠于强调色上的文字颜色 |
| `--pasty-border` | 边框/描边 |
| `--pasty-divider` | 分隔线 |
| `--pasty-success` | 成功/确认状态 |
| `--pasty-warning` | 警告状态 |
| `--pasty-danger` | 错误/破坏性操作状态 |

宿主同时设置 `color-scheme: light dark`，无需 JS 即可跟随 light/dark 切换。`pasty.theme.on()` 订阅可在 CSS token 不够用时（如 canvas 绘制）获取 token 精确值。

#### `pasty.action` — OptionalTopic\<ActionSession\>（action 上下文）

```js
const session = pasty.action.current();
await pasty.action.invoke('compose');
```

| 方法 | 形状 | 说明 |
|---|---|---|
| `pasty.action.current()` | OptionalTopic | 当前 action session |
| `pasty.action.on(fn)` | OptionalTopic | 订阅 session 变化 |
| `pasty.action.invoke(buttonID, opts?)` | Verb | 提交 action |

#### `pasty.action.draft` — OptionalTopic\<Draft\>（action 上下文）

```js
const draft = pasty.action.draft.current();
await pasty.action.draft.update({ subject: 'Hello', note: '' });
```

`pasty.action.invoke` 和 `pasty.action.draft.update` 在 attachment renderer 上下文中调用会 reject 并抛出 `PluginContextError`。

#### `pasty.window`

```js
pasty.window.setHeight(320);

// 启动自适应高度（manifest height: { min, max } 或 "auto" 时必须显式调用）
const dispose = await pasty.window.autoFit({ min: 120, max: 480 });
// dispose() 停止监听
```

#### `pasty.clipboard`

```js
await pasty.clipboard.copyText('hello world');
```

#### `pasty.navigation`

```js
await pasty.navigation.openUrl('https://example.com');
await pasty.navigation.revealInFinder('/path/to/file');
await pasty.navigation.openFilePath('/path/to/file');
```

#### `pasty.settings`

```js
const label = await pasty.settings.get('plugin.my.label');
const all = await pasty.settings.getAll();
```

### 3.3 共享能力对称表

| 能力 | runtime 端 | UI 端 | 备注 |
|---|---|---|---|
| 复制文本 | `ctx.host.clipboard.copyText(text)` | `pasty.clipboard.copyText(text)` | |
| 打开 URL | `ctx.host.navigation.openUrl(url)` | `pasty.navigation.openUrl(url)` | |
| 显示于 Finder | `ctx.host.navigation.revealInFinder(p)` | `pasty.navigation.revealInFinder(p)` | |
| 打开文件路径 | `ctx.host.navigation.openFilePath(p)` | `pasty.navigation.openFilePath(p)` | |
| 替换 tags | `ctx.host.item.setTags(tags)` | `pasty.item.setTags(tags)` | 需 `setTags` 权限 |
| 追加 tags | `ctx.host.item.addTags(tags)` | `pasty.item.addTags(tags)` | 需 `setTags` 权限 |
| 移除 tags | `ctx.host.item.removeTags(tags)` | `pasty.item.removeTags(tags)` | 需 `setTags` 权限 |
| Pin/unpin | `ctx.host.item.setPinned(bool)` | `pasty.item.setPinned(bool)` | 需 `setPinned` 权限 |
| 替换 attachment | `ctx.host.item.setAttachments(p)` | `pasty.item.setAttachments(p)` | 需 `setAttachment` 权限 |
| 替换搜索扩展 | `ctx.host.item.setSearchExtension(p)` | `pasty.item.setSearchExtension(p)` | 需 `setSearchExtension` 权限 |
| 读取设置 | `ctx.host.settings.get(key)` | `pasty.settings.get(key)` | |
| 读取所有设置 | `ctx.host.settings.getAll()` | `pasty.settings.getAll()` | |
| **仅 runtime** | `definePlugin` / `actionResult` / `rendererResult` / `ctx.log.*` | — | Node 环境特有 |
| **仅 UI** | — | Topic/OptionalTopic/Stream（`.current()` / `.on()`）；`pasty.window.*`；`pasty.ready()` | 浏览器环境特有 |

### 3.4 共享数据类型契约

#### `ClipboardItem`

```ts
interface ClipboardItem {
  id: string;
  type: string;           // 'text' | 'image' | 'path_reference'
  text: string | null;
  tags: string[];
  sourceAppID: string;
  createdAt?: string;
  pinnedAt?: string | null;
}
```

#### `AttachmentPayload`

这是 WebView UI 侧 `pasty.item.attachment.current()` 返回的 attachment payload 形状（与 Node runtime `resolveAttachment` 的 `input.attachment` 字段不同）。

```ts
interface AttachmentPayload {
  rendererID: string;
  attachmentType: string;
  attachmentKey: string;
  payloadJson: string;   // JSON 对象字符串，插件自行解析
  item: ClipboardItem;
  buttons: Array<{ id: string; title: string; systemImage?: string; tintHex?: string }>;
}
```

#### `ActionSession`

```ts
interface ActionDescriptor {
  id: string;
  actionID: string;
  title: string;
  lifecycle: 'auto-run' | 'draft';
  supportedItemTypes: string[];
  keywords: string[];
  uiEntry: string | null;
  buttons: ActionButton[];
}

interface ActionSession {
  pluginID: string;
  actionID: string;
  displayName: string | null;
  item: ClipboardItem;
  action: ActionDescriptor | null;
  draft: Draft;
  buttons: ActionButton[];
  defaultButtonID: string | null;
}
```

#### `Draft`

```ts
type PluginJSONValue = string | number | boolean | null | PluginJSONValue[] | { [key: string]: PluginJSONValue };
type Draft = Record<string, PluginJSONValue>;
```

#### `PluginThemeTokenSnapshot`

```ts
type PluginThemeTokenSnapshot = Record<string, string>;
// keys: '--pasty-surface', '--pasty-accent', ... 等 12 个 CSS token
```

---

## 4. Detector / Renderer / Action 开发约定

### 4.1 Detector

**入参形状（`detect(input, ctx)`）：**

```ts
input.item.id              // string
input.item.type            // 'text' | 'image' | 'path_reference'
input.item.text            // string | null
input.item.tags            // string[]
input.item.sourceAppID     // string

input.content.kind         // 'text' | 'image' | 'path_reference'
input.content.payload      // 随 kind 变化：
                           //   text:           { text: string }
                           //   image:          { dataBase64: string, width: number, height: number, format: string }
                           //   path_reference: { entries: ClipboardPathReferenceEntry[] }
```

**返回值：**

```ts
return {
  artifacts: [
    {
      attachmentType: 'plugin.example.sample.card',  // 必须已在 manifest 声明
      attachmentKey: 'card-1',                        // 稳定 key，不允许空字符串
      payloadJson: '{"kind":"sample"}',               // JSON 对象字符串
      attachmentSyncScope: 'syncable',                // 'syncable' | 'local_only'
      searchProjection: {                             // 可选
        scope: 'sample',     // 宿主会转小写，不允许包含 ':'
        searchText: 'hello', // 不允许空字符串
        label: null          // string | null
      },
      createdAtMs: null,   // number | null
      updatedAtMs: null    // number | null
    }
  ]
};
```

**约定：**
- 未命中时返回 `{ artifacts: [] }`，不返回半成品 artifact
- Detector 只产出 artifact，不执行宿主 mutation（`setTags` 等在 detector 模式受限）
- `attachmentType` 须来自 manifest 已声明的 `attachmentTypes`

### 4.2 Attachment Renderer

**`resolveAttachment(input, ctx)` 入参：**

```ts
input.item                  // ClipboardItem（同 detector，无 content.payload）
input.attachment.historyID
input.attachment.owner
input.attachment.attachmentType
input.attachment.attachmentKey
input.attachment.payloadJson  // 完整 attachment payload JSON 字符串，插件自行解析
input.declaredActions         // object[]（当前为预留字段，通常为 []）
```

**`resolveAttachment` 返回值：**

```ts
return {
  displayName: 'Sample Card',          // string，建议始终返回
  tintHex: '#2563EB',                  // string | null，卡片强调色
  buttons: [
    { id: 'copy-json', title: 'Copy JSON', isEnabled: true }
  ]
};
```

按钮不在 manifest 声明，由 `resolveAttachment` 每次动态返回。

**`invokeOperation(input, ctx)` 入参：**

```ts
input.item           // ClipboardItem
input.attachment     // AttachmentPayload
input.buttonID       // string | null（宿主或 UI 触发的按钮 ID）
input.params         // Record<string, PluginJSONValue>（UI 传入的结构化参数）
input.triggerSource  // 'hostButton' | 'pluginUI'
```

**`invokeOperation` 返回值：**

```js
rendererResult.success({ userMessage: 'Done' });
// 或
rendererResult.failure('Something went wrong');
```

**Attachment renderer UI 生命周期：**

```js
import { pasty } from '@pasty/plugin-sdk/ui';

await pasty.ready();
// bootstrap 完成，可读取初始数据
const item = pasty.item.current();
const attachment = pasty.item.attachment.current();
const payload = JSON.parse(attachment.payloadJson);

// 订阅宿主推送的更新
const unsub = pasty.item.attachment.on(newPayload => { /* 更新 UI */ });

// 启动自适应高度（manifest 声明 height: { min, max } 时必须调用）
const dispose = await pasty.window.autoFit({ min: 120, max: 480 });

// 触发 runtime invokeOperation
await pasty.item.attachment.invoke('copy-json', { format: 'pretty' });
```

### 4.3 Action

**`resolveSession(input, ctx)` 入参：**

```ts
input.item.id, .type, .text, .tags, .sourceAppID   // ClipboardItem 字段
input.action.id           // manifest actions[].id
input.action.actionID     // plugin.id + "." + action.id
input.action.title
input.action.lifecycle    // 'auto-run' | 'draft'
input.action.supportedItemTypes
input.action.keywords
input.action.uiEntry      // string | null
input.action.buttons      // 初次 resolve 时通常为 []
```

**`resolveSession` 返回值：**

```ts
return {
  displayName: 'Compose Follow-up',       // string | null
  buttons: [
    { id: 'compose', title: 'Compose', isEnabled: true }
  ],
  defaultButtonID: 'compose',             // string | null
  initialDraft: { subject: '', note: '' } // Record<string, PluginJSONValue>
};
```

`auto-run` lifecycle 的 action 可省略 `resolveSession`；宿主按空 session 处理。

**`invokeOperation(input, ctx)` 入参（action 侧）：**

```ts
input.item       // ClipboardItem
input.draft      // Draft（全量快照，值类型为 PluginJSONValue）
input.buttonID   // string | null（auto-run 时通常为 null）
input.triggerSource  // 'autoRun' | 'hostButton' | 'pluginUI'
```

**`invokeOperation` 返回值（action 侧）：**

```js
actionResult.text('result text', { userMessage: 'Copied' });
// 或
actionResult.none({ userMessage: 'Applied metadata' });
```

Action 只能拿到 item snapshot 与当前 draft；**拿不到** detector 模式的 `input.content.payload`（`image.dataBase64`、`path_reference.entries` 等）。

**Draft action UI 生命周期：**

```js
import { pasty } from '@pasty/plugin-sdk/ui';

await pasty.ready();
// bootstrap 完成
const session = pasty.action.current();
const draft = pasty.action.draft.current();

// 用户输入时同步 draft 到宿主
await pasty.action.draft.update({ subject: 'Hello', note: userInput });

// 订阅宿主推送的 session 刷新
const unsub = pasty.action.on(newSession => { /* 更新 UI */ });

// 提交执行
await pasty.action.invoke('compose');
```

---

## 5. 权限模型

### manifest 声明

```json
{
  "permissions": ["setTags", "setPinned"]
}
```

插件在 `manifest.json` 的 `permissions` 数组中声明所需的 mutation 权限。未声明的权限不会注入到对应 SDK 方法。

### 运行时检查

在 Node runtime 侧，可通过 `ctx.host.capabilities` 在代码中检查当前已授权的权限集合：

```js
async setup(init) {
  return {
    actions: {
      'my-action': {
        async invokeOperation(input, ctx) {
          if (!ctx.host.capabilities.setTags) {
            return actionResult.none({ userMessage: 'No setTags permission' });
          }
          const tags = await ctx.host.item.setTags(['processed']);
          return actionResult.text(tags.join(', '));
        }
      }
    }
  };
}
```

`ctx.host.capabilities` 是只读对象，反映 manifest 声明后经宿主验证的实际权限集合。

### 受门控的 Verb

| 权限 | 门控的 runtime Verb | 门控的 UI Verb |
|---|---|---|
| `setTags` | `ctx.host.item.setTags` / `addTags` / `removeTags` | `pasty.item.setTags` / `addTags` / `removeTags` |
| `setPinned` | `ctx.host.item.setPinned` | `pasty.item.setPinned` |
| `setAttachment` | `ctx.host.item.setAttachments` | `pasty.item.setAttachments` |
| `setSearchExtension` | `ctx.host.item.setSearchExtension` | `pasty.item.setSearchExtension` |

**不受门控的 Verb：** `ctx.host.clipboard.*`、`ctx.host.navigation.*`、`ctx.host.settings.*`（只读）、`pasty.clipboard.*`、`pasty.navigation.*`、`pasty.settings.*`（只读）、`pasty.window.*`。

### 最小权限原则

只声明你实际需要调用的权限。未使用的权限声明不会导致功能异常，但会在宿主权限审查中显示为不必要的权限请求。

---

## 6. 插件入参形状

每个 handler（detector、attachment renderer、action）接收的 `input` 都遵循统一的 **ItemContext envelope**，再附带各自的专属字段。

### 6.1 ItemContext envelope

```typescript
interface ItemContext {
  item: ClipboardItem;        // 剪贴板条目元信息（id、type、tags、sourceAppID）
  content: ContentEnvelope;   // 内容快照，按 kind 区分
  attachments: AttachmentRef[]; // 已有附件引用列表（attachmentType + attachmentKey）
}
```

**ContentEnvelope** 的三种形态：

| kind | payload 字段 |
|---|---|
| `"text"` | `{ text: string }` |
| `"image"` | `{ bytes: number, width: number, height: number, format: string }` |
| `"path_reference"` | `{ entries: unknown[] }` |

> **注意**：image 快照只携带字节数和尺寸，不含原始图片数据。若需要访问图片文件，在 action/detector 的 `ctx.host.item.materializeImagePath()` 中懒拷贝一份副本。

### 6.2 各 handler 专属字段

| Handler | 专属字段 |
|---|---|
| `DetectorInput` | 无（纯 ItemContext） |
| `ResolveAttachmentInput` | `attachment`（attachment 元信息）、`declaredActions`（按钮声明） |
| `AttachmentOperationInput` | `attachment`、`buttonID`、`params`、`triggerSource` |
| `ActionSessionResolveInput` | `action`（action 元信息，含 id、lifecycle、buttons 等） |
| `ActionRunInput` | `actionID`、`draft`、`buttonID`、`triggerSource?` |

### 6.3 Image 懒副本机制

图片类 item 的像素数据不在 `input.content.payload` 里传输。当插件需要读取图片文件时，调用：

```javascript
const imagePath = await ctx.host.item.materializeImagePath();
// imagePath 是宿主复制到临时目录的副本路径，invocation 结束后自动清理
```

多次调用同一 invocation 中的 `materializeImagePath()` 返回同一路径（幂等）。

### 6.4 Attachment 按需读

```javascript
const payloadJson = await ctx.host.item.readAttachment(attachmentType, attachmentKey);
// 返回 JSON 字符串，或 null（attachment 不存在）
```

`input.attachments` 给出当前 item 已有的附件引用列表，`readAttachment` 按需拉取内容，避免把所有附件都塞进入参。

### 6.5 Action 返回图片

当 action 需要输出图片时，使用 `allocateImageTempPath` 申请临时路径写入文件，再用 `actionResult.image()` 返回：

```javascript
const tmpPath = await ctx.host.action.allocateImageTempPath('png');
// ... 将图片字节写入 tmpPath ...
return actionResult.image(tmpPath, { formatHint: 'png' });
```

宿主读取文件后自动清理临时目录。

### 6.6 `item.text` 迁移

旧版 SDK 在 `ClipboardItem` 上暴露了 `text` 字段，新版已移除。迁移方法：

| 旧写法 | 新写法 |
|---|---|
| `input.item.text` | `input.content.payload.text`（仅在 `input.content.kind === "text"` 时有值） |
| `input?.item?.text` | `input?.content?.payload?.text` |

### Q&A

**Q: detector 也能调用 `materializeImagePath` 吗？**  
A: 可以，宿主从 v2 起为 detector 也创建了 invocation scope 和 dispatcher。但 detector 的 `timeoutMs` 只有 3000ms，大图片拷贝可能超时，请酌情使用。

**Q: `content.payload.bytes` 是什么？**  
A: 原始图片文件的字节数（来自宿主本地数据库），可用于展示文件大小或做条件判断，不保证与 `materializeImagePath()` 返回的副本字节数严格一致（副本可能经过格式转换）。

**Q: `attachments` 列表什么时候有值？**  
A: 宿主在调 detector 之前会查询当前 item 的全部附件引用，填入 `input.attachments`。若 item 尚无任何附件（例如首次检测），列表为空。

**Q: 临时目录什么时候清理？**  
A: invocation 结束后宿主同步删除。宿主启动时还会扫描超过 1 小时的遗留目录并兜底清理。
