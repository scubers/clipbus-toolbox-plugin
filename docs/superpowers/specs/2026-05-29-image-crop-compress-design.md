# Draft Action「裁剪与压缩」设计

> 日期：2026-05-29　状态：待批准（brainstorming 产出，待用户复审后进 writing-plans）

## 背景与目标

新增一个 **draft lifecycle 的 Action**「image-edit」，对剪贴板里的图片做**裁剪 + 压缩**。Draft 页面只负责参数编辑（压缩质量、裁剪区域）与交互；用户确认后由 Action 在 Node 侧用 sharp 生成处理后的图片，**结果由宿主原生 UI 展示**，Draft 页面不展示最终结果预览。原图保持不变（只读临时副本）。

## 决策

经 brainstorming 确认（用户三选）：

1. **图片处理库 = sharp**（用户推荐）。代价：sharp 是原生模块，需在 esbuild 标为 `external`，运行时从 host `node_modules` 解析；依赖 `install.mjs` 安装时 `npm install` 拉取平台二进制 → 列为真机验证项。
2. **输出 = 保留原格式**。质量滑块语义按格式映射（见下表）。
3. **裁剪框 = 自研 Pointer Events**（零依赖，契合现有「仅 Vue」技术栈）。

关键 SDK 事实（核对 `@clipbus/plugin-sdk@0.3.0` 的 `API.md` / `README.md` / 生成 `.d.ts`，均为实际编译依赖的 node_modules 版本）：

- draft action 完整支持：`manifest.actions[].lifecycle:"draft"` + 必填 `uiEntry`；`resolveSession(input,ctx)`（可选）播种 `initialDraft` + seed 按钮；UI 自管表单，最终 `clipbus.action.complete({result})` 提交。**没有** `clipbus.action.draft.update()`，draft 只读。
- **`clipbus.asset.currentItemImageUrl()`（0.3.0 新增，UI 侧，context 任意）→ `{url?}`**：返回不透明 `clipbus-asset://` 令牌 URL，`<img src>` 直接渲染当前 item 原图，真实路径不进 JS（沙箱 block `file://`）。**这是 WebView 显示原图的指定机制**——无需 base64、无需 runtime 往返。
- image 结果的 `imageTempPath` **只能** runtime 侧 `host.action.allocateImageTempPath({formatHint})` 分配（UI 端无此能力）；runtime 写文件后把路径回传 UI，UI 用 `clipbus.action.complete({result:{resultKind:"image",imageTempPath,imageFormatHint}})` 提交。
- runtime 侧 `host.item.materializeImagePath()→{path}` 把原图复制到临时文件供 sharp 读取（invocation 结束宿主自动清理；同一 invocation 幂等）。
- **没有 `clipbus.ready()`**（0.3.0 移除）：模块加载即注册 `.on()`，`.current()` 取快照并用 `?.`/`??` 兜底。`autoFit` 在 `@clipbus/plugin-sdk/dom`。
- **无需新权限**：`materializeImagePath` / `allocateImageTempPath` / `asset.currentItemImageUrl` 均不受门控；本功能不写 attachment，故不需要 `setAttachment`。`manifest.permissions` 保持不变。

> 旁注：仓库内嵌 `sdk/` 是过时副本（无 `asset`、含已废弃 `clipbus.ready`），**不参与构建**（`tsconfig` 无 paths 别名、`vite` 无 alias，源码 import `@clipbus/plugin-sdk` 解析到 node_modules@0.3.0）。实现时以 node_modules 的类型为准，勿被 `sdk/` 误导。

## 架构（生命周期）

```
宿主对 image item 触发 action「image-edit」(lifecycle:"draft")
        │
resolveSession(Node)：读 content.{width,height,format}（不 materialize，秒开）
   → initialDraft = { origWidth, origHeight, format, quality:80 }
     buttons = [{ id:"apply", title:"应用", isEnabled:true }], defaultButtonID:"apply"
        ▼
Draft UI（Vue WebView）：
   const { url } = await clipbus.asset.currentItemImageUrl(); img.src = url   ← 原图全分辨率直显
   裁剪框覆盖层（自研）+ 质量滑块 + 实时读数（宽 × 高 px · 宽高比）
        │  用户点「应用」(clipbus.action.onHostInvoke → buttonID==="apply")
        ▼
   clipbus.runtime.invoke("image-edit/process-image", { quality, crop:{x,y,width,height}(原图像素) })
        → runtime messageHandler：
             materializeImagePath() → sharp().metadata() 取真实格式
             服务端再 clamp crop 到 [0,W]×[0,H]、边长≥1
             allocateImageTempPath({ formatHint }) → sharp(src).extract(crop).<fmt>({quality}).toFile(out)
             return { imageTempPath, imageFormatHint }
        ▼
   clipbus.action.complete({ result:{resultKind:"image", imageTempPath, imageFormatHint}, userMessage:"已裁剪并压缩" })
        ▼
宿主原生 UI 展示结果图（原图不动）
```

要点：图片字节**不**经 `runtime.invoke` 传输（GUIDE 明确警告大图会卡）；显示走 asset 令牌协议，处理走 runtime 文件路径。

## 模块结构与边界

```
src/features/image-edit/
├── contracts.ts     纯类型 + 消息 key 常量（零 SDK 依赖；两端共享）
├── cropGeometry.ts  纯函数：clampBox / 显示坐标→原图裁剪 / 宽高比（无 DOM、可单测）
├── process.ts       runtime-only：sharp 裁剪+压缩、格式归一、quality→格式选项映射、crop 防御 clamp
├── feature.ts       注册 actions["image-edit"] + messageHandlers["image-edit/process-image"]
├── index.html       UI 模板（照搬 decode-renderer：引用 ./index.js / ./index.css）
├── main.ts          patchConsole(); patchTextInputState(); createApp(App).mount("#app"); import base.css
└── app.vue          Draft UI：asset 显图 + 自研裁剪框 + 质量滑块 + 读数 + 提交
```

**边界纪律（关键，防止 sharp/Node 代码漏进浏览器包）**：

- `app.vue` / `main.ts`（vite 打包）**绝不** import `process.ts` 或 `feature.ts`。
- `feature.ts` / `process.ts`（esbuild 打进 `dist/plugin.cjs`）只 import `@clipbus/plugin-sdk/runtime`、`sharp`、`contracts.ts`。
- `contracts.ts`、`cropGeometry.ts` 是纯模块（无 SDK / 无 DOM / 无 Node），两端及测试安全共享。

目录名 `image-edit` 不以 `-renderer` 结尾 → `build-ui.mjs` 自动归类为 action UI → 产物落 `dist/ui/actions/image-edit/`。目录名即 action id，与 manifest `id`、`uiEntry` 三者一致。

### 契约（`contracts.ts`，UI↔runtime 唯一接口）

```ts
export const PROCESS_IMAGE = "image-edit/process-image";

export interface CropRect { x: number; y: number; width: number; height: number; } // 原图像素，整数
export interface ImageEditDraft { origWidth: number; origHeight: number; format: string; quality: number; }
export interface ProcessImageReq { quality: number; crop: CropRect; }
export interface ProcessImageResp { imageTempPath: string; imageFormatHint: string; }
```

用纯字符串 key + 共享 interface（不引 `defineMessage`），避免 isomorphic 模块跨引 SDK 的 `/ui` 与 `/runtime` 入口。UI 用 `clipbus.runtime.invoke<ProcessImageResp>({key:PROCESS_IMAGE, payload})`；runtime 用 `messageHandlers[PROCESS_IMAGE]`（ctx 含 `host`）。

## 运行时侧（`feature.ts` + `process.ts`）

- **`resolveSession(input)`**：`content.kind!=="image"` 返回空兜底 session；否则用 `content.{width,height,format}` 播种 `initialDraft`（不 materialize，保证面板秒开）+ seed「应用」按钮。
- **`runAutoAction`**：桩，`return actionResult.none()`（类型要求二者都在；draft 永不调用，镜像 `case-convert` 桩 `resolveSession` 的写法）。
- **`messageHandlers["image-edit/process-image"](req, ctx)`**：
  1. `const { path: src } = await ctx.host.item.materializeImagePath();`
  2. `const meta = await sharp(src).metadata();` 取真实格式与尺寸。
  3. `const fmt = normalizeFormat(meta.format);`（png/jpeg/webp 显式，其它→png）。
  4. `const crop = clampCropToImage(req.crop, meta.width, meta.height);`（边长≥1，越界裁回，防 `extract` 抛错）。
  5. `const { path: out } = await ctx.host.action.allocateImageTempPath({ formatHint: fmt });`
  6. `await applyFormat(sharp(src).extract({left:crop.x,top:crop.y,width:crop.width,height:crop.height}), fmt, clampQuality(req.quality)).toFile(out);`
  7. `return { imageTempPath: out, imageFormatHint: fmt };`
- `process.ts` 把**纯决策逻辑**（`normalizeFormat` / `clampCropToImage` / `clampQuality` / `formatOptions`）与**副作用**（sharp 读写 + ctx.host 调用）分离，前者可脱离 host 单测。

### 质量滑块语义（保留原格式，滑块 1–100）

| 源格式 | 输出 | 映射 |
|---|---|---|
| JPEG | JPEG | `.jpeg({ quality })` 有损质量，最直观 |
| WebP | WebP | `.webp({ quality })` 有损质量 |
| PNG | PNG | `.png({ quality, compressionLevel:9, palette:true })` 调色板量化（libimagequant）；高值近无损、低值显著减体积。**语义不同于 JPEG** |
| 其它（TIFF/GIF/HEIC…） | 兜底 PNG（无损） | 滑块对无损输出不改画质，仅 best-effort |

UI 依据 `draft.format` 在滑块旁显示一行格式说明（如「PNG：调色板量化」），避免「拖 PNG 滑块看不出变化」的困惑。

## UI 侧（`app.vue`，自研 Pointer Events）

布局：
```
┌────────────────────────────────────┐
│  ┌──────────────────────────────┐  │  预览区：<img object-fit:contain>
│  │   ░░░┌──────────┐░░░          │  │  上覆绝对定位裁剪框 + 框外暗化遮罩
│  │   ░░░│   crop   │░░░◄ handle  │  │  4 角 + 4 边 共 8 手柄；框体可整体拖动
│  │   ░░░└──────────┘░░░          │  │
│  └──────────────────────────────┘  │
│  裁剪区域： 800 × 600 px · 4:3       │  实时读数（原图像素 + 宽高比）
│  压缩质量： ●────────○ 80%  (说明)   │  <input type=range min=1 max=100>
│                          [ 应用 ]    │  宿主渲染的 seed 按钮
└────────────────────────────────────┘
```

- **取图**：`onMounted` → `const {url}=await clipbus.asset.currentItemImageUrl(); if(url) previewUrl=url;` 否则显示错误占位。
- **坐标基准**：原图 `W×H` 取自 `clipbus.action.draft.current()`（兜底 `img.naturalWidth/Height`）。`<img @load>` 后量 `clientWidth` → 显示比例 `s = clientWidth / origWidth`。裁剪框以**显示坐标**存储；读数与提交时 `÷s` 并 `Math.round` 得原图像素（`cropGeometry.ts` 负责换算）。
- **裁剪框交互**：`pointerdown` 命中手柄/框体 → `setPointerCapture` → `pointermove` 按手柄类型更新 x/y/w/h，全程 `clampBox` 限制在 `[0,clientW]×[0,clientH]` 内且 ≥ 最小边长（显示 16px）→ `pointerup` 释放。默认框 = 整图。
- **质量滑块**：`<input type=range min=1 max=100 v-model.number=quality>`（默认 80）+ `{{quality}}%`，无实时预览（符合非目标）。
- **提交**：`clipbus.action.onHostInvoke(({buttonID})=> buttonID==="apply" && apply())`。`apply()`：先 `setButtons([{id:"apply",title:"应用",isEnabled:false}])` 防重复 → `await clipbus.runtime.invoke<ProcessImageResp>({key:PROCESS_IMAGE,payload:{quality,crop:原图裁剪},timeoutMs:60_000})` → `await clipbus.action.complete({result:{resultKind:"image",imageTempPath,imageFormatHint},userMessage:"已裁剪并压缩"})`。失败 → 恢复按钮 + 显示错误文案，不调用 `complete`。
- 样式复用 `shared/base.css` + `clipbus.theme` 主题 token；用 `@clipbus/plugin-sdk/dom` 的 `autoFit({min,max,target})` 适配面板高度。无 `clipbus.ready()`。

## Manifest 与构建改动（精确清单）

1. `package.json` → dependencies 增 `"sharp"`（最新稳定，约 `^0.34`）。
2. `scripts/build-runtime.mjs` → esbuild `build({ … external: ["sharp"] })`，令 `plugin.cjs` 运行时从 host `node_modules` 解析 sharp（其余依赖仍内联打包）。
3. `manifest.json` → `actions` 数组加一项（**无新权限**）：
   ```json
   { "id":"image-edit", "title":"Crop & Compress", "supportedItemTypes":["image"],
     "lifecycle":"draft", "uiEntry":"actions/image-edit/index.html",
     "keywords":["crop","compress","resize","裁剪","压缩"] }
   ```
4. `src/features/index.ts` → 引入并注册 `imageEditFeature`。
5. 新增 `src/features/image-edit/` 全部文件。
6. `scripts/verify-build.mjs`、`scripts/build-ui.mjs` **无需改**（通用自发现：verify 自动遍历 `manifest.actions[].uiEntry` 校验产物，并检查 runtime bundle 含 action id `"image-edit"` —— 该字符串经 `feature.ts` 注册自然进 bundle）。

## 错误处理与边界

- 非 image item：`supportedItemTypes:["image"]` 已限制宿主只对图片提供；`resolveSession` 与 handler 内再兜底。
- `currentItemImageUrl()` 返回空 / 图片加载失败：UI 显示错误占位，禁用「应用」。
- `materializeImagePath` / sharp 抛错（损坏图、不支持格式、crop 越界）：handler catch 抛出 → `invoke` reject → UI 显示错误并恢复按钮，不 `complete`。
- 空 / 零面积裁剪：UI 强制最小边长；服务端 `clampCropToImage` 再保证边长≥1。
- 质量越界：UI 限 1–100；runtime `clampQuality` 再夹紧。

## 测试策略（贴合「CLI 无真机宿主」现状）

- **Node 单测（无宿主，沿用 `node --test`）**：
  - `cropGeometry.ts` 纯函数：clampBox 边界、显示↔原图换算、宽高比、最小边长。
  - `process.ts` 纯部分：`normalizeFormat`（含未知→png）、`clampCropToImage`（越界/零面积）、`clampQuality`、`formatOptions`。
  - `process.ts` 集成：用 `tests/fixtures` 小图 + mock `ctx.host`（`materializeImagePath`→fixture 路径、`allocateImageTempPath`→tmp 路径），断言输出尺寸 == crop、输出格式正确、低质量文件更小。
- **vite workbench（`pnpm dev`，`?view=action`）**：新增 action 预览 scenario，mock `clipbus.asset.currentItemImageUrl` 回传内置样图（data URL 或 vite 静态资源），让裁剪框/滑块/读数可手动开发验证；`process-image` / `complete` 在 workbench 中打日志空跑。
- **真机端到端**：仅真实 Clipbus 宿主可验，列入下方延迟项。

## 待真机验证项（拟同步进 memory，与现有 host-only 项同类）

1. `external:["sharp"]` 后 `plugin.cjs` 运行时能否从 host `node_modules` 解析到 sharp（host 的 cwd / node_modules 布局未知；`install.mjs` 已会 `npm install`）。
2. `clipbus-asset://` 在宿主 WebView CSP 下渲染（宿主自家协议，风险低；但本插件页若加 CSP 需放行 `img-src clipbus-asset:`）。
3. draft 面板的按钮 / 高度 / `autoFit` 在真机表现。

## 非目标（均不实现）

压缩结果实时预览、裁剪结果实时预览、旋转、镜像、滤镜、多图批处理、固定比例裁剪。

## 验收

`npm run build && npm test` 全绿（typecheck + lint + 构建 + manifest 驱动的 verify-build + 单测/集成测试）。功能层面以「裁剪+压缩纯逻辑单测 + sharp 集成测试」为自动化验收基线；真机端到端为延迟验证项。
