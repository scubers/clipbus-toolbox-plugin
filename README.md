# Clipbus Toolbox

> 写新插件先看 [GUIDE.md](./GUIDE.md)。它和本工程一起就是开发 Clipbus 插件的完整起步资料。

一个 Clipbus 粘贴板插件：自动识别剪贴板文本的编码，并在一张可折叠卡片里内联解码预览。基于独立发布的 SDK 包 `@clipbus/plugin-sdk` 开发。

## 检测优先链

detector 对文本按以下顺序尝试，命中即停：

1. **JWT** — `header.payload.signature` 结构，解出 header / payload JSON
2. **转义 JSON** — `"..."` 或含 `\"` 的转义字符串
3. **URL** — 百分号编码 `%XX`
4. **时间戳** — 10 位（秒）/ 13 位（毫秒）Unix epoch，限合理年份窗口
5. **日期字符串** — `Date.parse` 可识别、带日期/时间分隔符的字符串
6. **Base64** — 标准 / URL-safe，可打印率 ≥ 95%

命中后产出 `plugin.clipbus.toolbox.decode.preview` 附件，由折叠卡片渲染：chip 标注编码类型、一行预览、复制按钮、展开 chevron。展开体显示完整解码内容（JSON 语法高亮）或时间详情（local / UTC / ISO / epoch）。卡片高度用 SDK `autoFit` 在 32–480px 间自适应。时间格式读取宿主设置 `timestampFormat`（默认 `yyyy-MM-dd HH:mm:ss`）。

## 工程结构

```text
clipbus-toolbox-plugin/
├── manifest.json                       ← plugin.clipbus.toolbox
├── package.json                        ← 依赖 @clipbus/plugin-sdk（独立 npm 包）
├── scripts/                            ← build:runtime / build:ui / verify:build
├── src/
│   ├── features/decode-renderer/       ← detector + 解码器 + renderer + Vue 卡片
│   │   ├── detection.ts                ← 优先链编排
│   │   ├── decoders.ts                 ← 各编码的解码器（JWT/Base64/URL/时间戳/日期…）
│   │   ├── detector.ts                 ← detector 入口（detect → artifact[]）
│   │   ├── payload.ts                  ← 附件 payload 类型与构建/解析
│   │   ├── renderer.ts                 ← resolveAttachment（displayName + 按钮 seed）
│   │   ├── timeFormat.ts               ← LDML 风格时间格式化
│   │   ├── app.vue                     ← 折叠卡片 UI（autoFit 自适应高度）
│   │   └── main.ts / index.html        ← Vite 入口
│   ├── shared/                         ← jsonHighlight、base.css、composables
│   ├── preview/                        ← 本地预览工作台（dev-only）
│   └── plugin.ts                       ← definePlugin 入口（注册 decode-detector / decode-renderer）
└── tests/runtime/                      ← detector / renderer / project / timeFormat 集成测试
```

## 常用命令

```sh
npm install       # 装依赖（含 @clipbus/plugin-sdk）
npm run dev       # 启动 Vite 预览工作台（解码卡片，多场景 + 主题切换）
npm test          # 运行 tests/ 下集成测试
npm run build     # typecheck + lint + 生产构建到 dist/
```

SDK 完整 API、字段规范与权限模型见 [GUIDE.md](./GUIDE.md) 与包内 `API.md`（[`@clipbus/plugin-sdk`](https://www.npmjs.com/package/@clipbus/plugin-sdk)）。
