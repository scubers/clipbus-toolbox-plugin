# Pasty Toolbox 聚合插件改造设计

> 日期：2026-05-28　状态：已批准（用户经 autopilot 授权实现）

## 背景与目标

本工程原为单一用途的 string-decode 插件（`plugin.pasty.awesome.decode`）。现重新定位为**聚合插件 Pasty Toolbox**：decode 只是首个 feature，后续可低成本追加新 feature。

模板本就为多 feature 设计——`src/features/<name>/` 已是约定目录，`scripts/build-ui.mjs` 自动发现每个 feature 目录并按 `-renderer` 后缀分类。所以本次不是大重构，而是**收尾通用化 + 改名**。

仍硬编码到 decode 的四处：manifest 身份、`src/plugin.ts` 注册、`scripts/verify-build.mjs` 校验、`package.json`/`README` 命名。

## 决策

- **身份**：`plugin.id = plugin.pasty.toolbox`，`title = "Pasty Toolbox"`。decode 的 attachmentType 收敛到带 feature 段的 `plugin.pasty.toolbox.decode.preview`，未来每个 feature 用 `plugin.pasty.toolbox.<feature>.*`。`package.json` 名（私有，仅标签）→ `@pasty/toolbox-plugin`。
- **扩展方式**：约定 + 手写 manifest（manifest 是宿主直读的声明文件，保持显式）。运行时引入 feature registry 聚合，`plugin.ts` 从此不再随新增 feature 改动。
- **范围**：decode 仍是唯一 feature，不新增功能代码，不新增用户文档；README 仅做身份字符串替换。
- **仓库目录改名**与 `docs/specs/` 历史文档、`dist/`（gitignore）不在本次改动内。

## 运行时：feature registry

SDK 已导出 `PluginRegistry`（`attachmentRenderers?/detectors?/actions?/messageHandlers?` 全可选），直接复用为 feature 契约。

- `src/features/registry.ts`：`export type PluginFeature = PluginRegistry` + `mergeFeatures(features): PluginRegistry`。逐 slot 合并，重复 id 抛错，空 slot 不输出（保持 `actions===undefined` 等当前形状）。
- `src/features/decode-renderer/feature.ts`：导出 `decodeFeature: PluginFeature`，声明本 feature 的 `detectors`/`attachmentRenderers`。
- `src/features/index.ts`：`export const features: PluginFeature[] = [decodeFeature]`——新增 feature 唯一要改的花名册。
- `src/plugin.ts`：`definePlugin({ setup: () => mergeFeatures(features) })`。

**加一个新 feature 的流程**：建 `src/features/<name>/`（含 handlers + `feature.ts`，renderer 还需 `main.ts`/`index.html`/`app.vue`）→ `index.ts` 加 1 行 → `manifest.json` 加对应条目。`plugin.ts`/`registry.ts`/各 build 脚本均不动。

## 构建：verify-build 通用化

`scripts/verify-build.mjs` 改为读 `manifest.json` 推导：
- 对每个带 `uiEntry` 的 renderer/action：校验 `dist/ui/<uiEntry>` 下 `index.html`/`index.js` 存在、HTML 引用本地相对资源（`./index.js`，引用了才校验 `./index.css`）、无绝对路径。
- runtime：校验 `dist/<nodeEntry>` 含 `definePlugin` 且包含 manifest 每个 handler id。

`build-runtime.mjs`、`build-ui.mjs` 已通用，不动。

## 测试影响

- `tests/runtime/decodeProject.test.cjs`、`decodeDetector.test.cjs`：身份断言同步改名；"runtime setup" 用例升级为走 `mergeFeatures(features)` 验证新接线。
- 其余 detector/renderer/timeFormat/jsonHighlight 测试不受影响。

## 验收

`npm run build && npm test` 全绿（typecheck + lint + 构建 + manifest 驱动的 verify + 集成测试）。decodeProject 测试锁身份字段，等于自动验证改名一致。
