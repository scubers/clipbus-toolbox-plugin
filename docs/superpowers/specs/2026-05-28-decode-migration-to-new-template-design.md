# Decode 插件迁移到更新后的模板（SDK 0.2.0）设计

- 日期：2026-05-28
- 范围：纯 decode 插件（删除模板自带示例）
- 高度策略：改用 SDK `autoFit`
- 状态：已批准，进入实现（autopilot）

## 1. 背景与目标

本工程是 Clipbus 粘贴板的三方插件 `plugin.clipbus.awesome.decode`（Clipbus Awesome Decode）——一个纯文本解码插件。模板上游更新后，作者把新模板整体覆盖进仓库：旧的 `decode-renderer` feature、仓库内 `sdk/` 源码、decode 测试被删除，取而代之的是一套新示例 feature（preview-renderer / expanded-renderer / auto-action / capability-gallery）和把 SDK 改为外部 npm 包 `@clipbus/plugin-sdk@^0.2.0` 的新构建管线。

目标：把 decode 的全部能力恢复到**新模板脚手架**上，删除模板示例，产出一个干净、可 `npm run build` / `npm test` 通过的发布版 decode 插件。**decode 行为不变**，仅在高度同步处改用 SDK `autoFit`。

## 2. 现状（模板覆盖后的工作区）

- 删除（仍可从 git HEAD 恢复）：`src/features/decode-renderer/*`、`src/shared/jsonHighlight.ts`、4 个 decode 测试、`sdk/`、旧 design docs。
- 新增（模板示例）：`src/features/{preview-renderer,expanded-renderer,auto-action,capability-gallery}/`、`src/shared/{display,debug}.ts`、`tests/{runtime,integration}/` 模板测试、`src/preview/scenarios/actionScenarios.ts`。
- 改写：`manifest.json`（身份 `plugin.template.full`）、`src/plugin.ts`、`package.json`、`GUIDE.md`、`README.md`、`scripts/{build-ui,verify-build}.mjs`、`tsconfig.json`、预览工作台。
- `node_modules` 经 `npm install` 已就绪（含 `@clipbus/plugin-sdk` 0.2.0）。

## 3. SDK 0.2.0 兼容性结论（关键）

旧 decode 代码本就针对 `@clipbus/plugin-sdk/{runtime,ui,dom}` 编写（HEAD 提交 `b34084c` 即"迁移到模板 SDK"）。核对已安装的 0.2.0 类型，旧代码用到的导出**全部仍在**：

- `PluginDetectorSearchProjection`、`PluginActionButton`、`PluginDetectorArtifact`、`PluginContentEnvelope`、`PluginAttachmentRendererHandler`、`PluginResolveAttachmentInput`、`PluginAttachmentResolveResult`、`PluginDetectorHandler`/`Input` — 均导出。
- `PluginDetectorArtifact.attachmentSyncScope?: string` — 仍存在。
- UI：`clipbus.item.attachment`、`clipbus.attachmentRenderer.{setButtons,onHostInvoke}`、`clipbus.clipboard.copyText`、`clipbus.window.setHeight`、`clipbus.settings.get`、`PluginAttachmentPayload` — 均可用。
- `@clipbus/plugin-sdk/dom`：`patchConsole`、`patchTextInputState`、`autoFit(options?: { min?, max?, target? }): () => void` — 可用。

**结论**：decode 的纯逻辑/runtime 文件可**原样恢复**，无需改类型导入。

## 4. 最终文件布局

### 4.1 原样恢复（`git checkout HEAD --`）
- `src/features/decode-renderer/`：`detector.ts`、`detection.ts`、`decoders.ts`、`payload.ts`、`renderer.ts`、`timeFormat.ts`、`main.ts`、`index.html`
- `src/shared/jsonHighlight.ts`
- `tests/runtime/`：`decodeDetector.test.cjs`、`decodeRenderer.test.cjs`、`decodeProject.test.cjs`、`timeFormat.test.cjs`
- `manifest.json`、`src/plugin.ts`（HEAD 即 decode 身份）

> `index.html` 旧版已引用 `./index.js` + `./index.css`，与 `verify-build` 要求一致；新模板 `preview-renderer/index.html` 同样如此 → 兼容。

### 4.2 恢复后修改
- `src/features/decode-renderer/app.vue`：恢复后 (a) 把手写 `ResizeObserver`/`MutationObserver`/`requestAnimationFrame`/`clipbus.window.setHeight` 高度同步替换为 `autoFit({ min: 32, max: 480, target: rootEl })`；(b) 把 `!= null` / `== null` 改为严格比较（满足 eslint `eqeqeq`）；(c) 清理因此空出的未使用导入/变量。

### 4.3 删除
- `src/features/{preview-renderer,expanded-renderer,auto-action,capability-gallery}/`
- `src/shared/{display.ts,debug.ts}`
- `tests/runtime/{templateCapabilities,inputEnvelopeMigration,templateUIBoundary}.test.cjs`、`tests/integration/`
- `src/preview/scenarios/actionScenarios.ts`
- `pnpm-lock.yaml`（统一 npm）

### 4.4 保留
- `src/shared/composables/useTopicRef.ts`、`src/shared/base.css`、`tests/setup.cjs`、`vite.config.mjs`、`tsconfig.json`、`eslint.config.mjs`、`env.d.ts`、`scripts/{build-runtime,install}.mjs`

## 5. 构建系统改造

新模板的构建脚本硬编码了 `template-*` / `gallery-*` 命名，需改造：

- **`scripts/build-ui.mjs`**：`discoverPages` 简化为「`src/features/<dir>` 含 `main.ts`+`index.html` 即一个 UI 包；`-renderer` 结尾 → `kind=renderers`，否则 `kind=actions`；`name` 直接用目录名」。移除 `NESTED_OVERRIDES` 与 gallery 嵌套分支。`decode-renderer` → `dist/ui/renderers/decode-renderer/`，与 manifest `uiEntry` 一致。
- **`scripts/verify-build.mjs`**：改为校验 decode 产物——`dist/ui/renderers/decode-renderer/{index.html,index.js,index.css}` 存在、HTML 引用 `./index.js`+`./index.css` 且无绝对路径；`dist/plugin.cjs` 含 `definePlugin`、`decode-detector`、`decode-renderer`。
- `build-runtime.mjs`（bundle `src/plugin.ts` → `dist/plugin.cjs`）、`vite.config.mjs`：通用，不改。

## 6. app.vue 高度：autoFit

- `target` 选根元素 `.decode-shell`（`ref="rootEl"`，始终存在、内容高度自适应），`autoFit({ min: 32, max: 480, target: rootEl.value })`。
- 折叠态内容即 32px 行 → 回弹到 min 32；展开态含 `<pre>` 代码块 → autoFit 自动跟随，封顶 480。
- `onToggle` 只翻转 `localExpanded` + `syncHostButtons()`（更新 Show More/Less 文案）；高度由 autoFit 的观察器自动上报，不再手写。
- `onUnmounted` 调用 `autoFit` 返回的 disconnect 清理。
- manifest 高度仍 `{ min: 32, max: 480 }`。

## 7. manifest / plugin.ts / package.json

- `manifest.json`、`src/plugin.ts`：恢复 HEAD 的 decode 版本（`plugin.clipbus.awesome.decode`、`permissions:["setAttachment"]`、1 detector `decode-detector`(text) + 1 renderer `decode-renderer`，attachmentType `plugin.clipbus.awesome.decode.preview`）。
- `package.json`：**保留**新模板的脚本与依赖（外部 SDK + 新构建/测试管线），仅改 `name`/`description` 为 decode。不回退 HEAD 的 package.json（其可能引用已删的仓库内 `sdk/`）。

## 8. 预览工作台改造

新模板预览是「renderer + action 双视图、compact/expanded 变体」，且 HEAD 的预览在 `b34084c`（pure-decode scope）阶段仍是模板取向——不能直接复用。改造为 decode 专用：

- `src/preview/scenarios/attachmentScenarios.ts`：产出 `DecodePayload` 样本（Base64 / JWT / URL / 时间戳 等若干），`pluginID=plugin.clipbus.awesome.decode`、`rendererID=decode-renderer`、`attachmentType=plugin.clipbus.awesome.decode.preview`，注入 `__CLIPBUS_PLUGIN_*__` + 派发 `clipbus-plugin-*` 事件的机制沿用。
- `src/preview/PreviewShellApp.vue`：renderer-only，挂载 `../features/decode-renderer/app.vue`；保留可缩放 host-frame、主题切换、按钮条；移除 action 视图、expanded 变体、draft 导入。
- `src/preview/preview-host/index.html`：标题改 decode。
- 删除 `actionScenarios.ts`。

## 9. 测试策略

- 移植 4 个 decode 测试（路径 `src/features/decode-renderer/...` 不变，原样可用；新测试 runner `node --experimental-strip-types --require ./tests/setup.cjs --test ./tests/**/*.test.cjs` 兼容 .cjs 直接 require .ts）。
- `decodeProject.test.cjs` 断言 decode 身份/产物，恢复后直接通过。
- 删除模板示例测试（templateCapabilities / integration / inputEnvelopeMigration / templateUIBoundary）。
- eslint 仅 lint `src/**`，测试 `.cjs` 不受影响。

## 10. 构建与验证流程

`npm run build`（typecheck `vue-tsc --noEmit` + `eslint .` + clean + build:runtime + build:ui + verify:build）→ `npm test` → dev 预览人工确认 decode 卡片折叠/展开高度无抖动。

## 11. 风险与回滚

1. **autoFit 折叠回弹**：dev 预览验证折叠态稳定到 32px、展开无抖动；若有问题，autoFit 内部已含 RAF/observer，必要时调 target 选择或 min。
2. **构建脚本字符串校验**：`verify-build` 的 `definePlugin` 字符串若被打包改写导致误报，降级为只校验两个 capability id。
3. **预览改造引入 typecheck/lint 失败**：`src/**` 全量 typecheck+lint，改写预览后需整体跑通。
4. **回滚**：所有改动可由 git 还原；模板示例文件在 git 历史中可恢复。

## 12. 文档

- `GUIDE.md`：通用 SDK 指南，保留。
- `README.md`：从「Template Plugin」轻量改写为 decode 插件说明。
