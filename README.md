# Template Plugin

> To write a new plugin, start with [GUIDE.md](./GUIDE.md)

`template-plugin/` 是给插件作者准备的最小全功能模板工程。它演示了 detector、attachment renderer（compact + expanded）、auto-run action、draft action 各一个，并内嵌了 `@pasty/plugin-sdk`。

字段约束、SDK API 和能力边界以 [GUIDE.md](./GUIDE.md) 为准；本 README 说明这个模板工程的演示范围、目录结构和起步入口。

## 工程结构

```text
template-plugin/
├── manifest.json
├── package.json
├── sdk/                            ← 内嵌 @pasty/plugin-sdk（通过 file:./sdk 引用）
│   ├── package.json
│   ├── dist/
│   ├── src/
│   ├── README.md                   ← SDK API 速查
│   └── SPECIFICATION.md            ← SDK 扩展规范与命名规则
├── scripts/
│   ├── build-runtime.mjs
│   ├── build-ui.mjs
│   ├── install.mjs
│   └── verify-build.mjs
├── src/
│   ├── runtime/
│   │   ├── index.js                ← definePlugin 入口
│   │   ├── detectors/
│   │   │   └── templateDetector.js
│   │   ├── renderers/
│   │   │   ├── templateRenderer.js
│   │   │   └── templateExpandedRenderer.js
│   │   ├── actions/
│   │   │   ├── templateAutoAction.js
│   │   │   └── templateDraftAction.js
│   │   └── shared/
│   └── ui/
│       ├── AttachmentTemplateApp.vue
│       ├── ExpandedAttachmentTemplateApp.vue
│       ├── DraftActionTemplateApp.vue
│       ├── composables/
│       ├── renderers/template-renderer/
│       ├── renderers/template-expanded-renderer/
│       └── actions/template-draft-action/
└── tests/runtime/
    └── templateCapabilities.test.cjs
```

## 演示的能力

### detector

- 文件：`src/runtime/detectors/templateDetector.js`
- 输入：`text`、`image`、`path_reference`
- 输出：`plugin.template.full.preview` 和 `plugin.template.full.expanded` attachment
- 演示：把三种 detector 输入统一映射成 preview payload，并保留完整 debug snapshot

### attachment renderer（compact，固定高度）

- 文件：`src/runtime/renderers/templateRenderer.js`
- UI：`src/ui/renderers/template-renderer/` + `src/ui/AttachmentTemplateApp.vue`
- 演示：`resolveAttachment()`、`invokeOperation()`、固定高度 `height: 320`、12 个 CSS token 主题适配

### attachment renderer（expanded，自适应高度 + 主题事件）

- 文件：`src/runtime/renderers/templateExpandedRenderer.js`
- UI：`src/ui/renderers/template-expanded-renderer/` + `src/ui/ExpandedAttachmentTemplateApp.vue`
- 演示：`height: { min: 120, max: 480 }` + `pasty.window.autoFit({ min: 120, max: 480 })` + `pasty.theme.on()` 驱动强调条颜色

### auto-run action

- 文件：`src/runtime/actions/templateAutoAction.js`
- 演示：无 UI action，返回可复制的完整执行上下文文本

模板额外声明了 `template-auto-action-text` / `template-auto-action-image` 两个子变体，用于演示超出免费配额后的 Plugin Pro 门控行为（manifest 共 4 个 action，超过默认配额 3 个）。

### draft action

- 文件：`src/runtime/actions/templateDraftAction.js`
- UI：`src/ui/actions/template-draft-action/` + `src/ui/DraftActionTemplateApp.vue`
- 演示：`resolveSession()`、draft bootstrap（`pasty.action.current()`）、draft 更新（`pasty.action.draft.update()`）、button invoke（`pasty.action.invoke()`）、`setTags` / `setPinned`

## 起步改造

最先改这几处，避免 manifest 和 runtime 脱节：

1. `manifest.json`（`plugin.id`、`title`、`attachmentType`、capability 列表）
2. `src/runtime/index.js`（注册的 handler key 须与 manifest `id` 对齐）
3. `src/runtime/shared/templateCapabilityMetadata.js`
4. `src/runtime/detectors/templateDetector.js`
5. `src/runtime/renderers/templateRenderer.js`
6. `src/runtime/actions/templateDraftAction.js`
7. 对应的 UI 入口文件

通常**不需要改**：

- `sdk/`（内嵌 SDK，不需要修改；如需扩展参见 [`sdk/SPECIFICATION.md`](./sdk/SPECIFICATION.md)）
- `src/ui/composables/`（`usePluginAttachmentSession.js` / `usePluginActionSession.js` 封装了 `pasty.*` 的 Vue ref 适配）
- `scripts/build-runtime.mjs` / `scripts/install.mjs`

完整的架构说明、manifest 字段规范、SDK API 参考和权限模型，参见 [GUIDE.md](./GUIDE.md)。
