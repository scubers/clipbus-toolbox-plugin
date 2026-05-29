<template>
  <div ref="rootEl" class="ie-shell">
    <p v-if="errorMsg" class="ie-error">{{ errorMsg }}</p>

    <!-- 顶部控制区：质量滑块 + 格式说明 -->
    <div class="ie-controls">
      <label class="ie-quality">
        <span class="ie-quality-label">质量</span>
        <input
          v-model.number="quality"
          class="ie-slider"
          type="range"
          min="1"
          max="100"
          step="1"
          :style="{ '--ie-pct': quality + '%' }"
        />
        <span class="ie-quality-value">{{ quality }}%</span>
      </label>
      <p v-if="formatNote" class="ie-format-note">{{ formatNote }}</p>
    </div>

    <!-- 图片 + 裁剪框 -->
    <div v-if="previewUrl" class="ie-stage">
      <img
        ref="imgEl"
        class="ie-img"
        :src="previewUrl"
        alt=""
        draggable="false"
        @load="onImageLoad"
        @error="onImageError"
      />
      <div
        v-if="box && displayWidth > 0"
        ref="cropBoxEl"
        class="ie-crop"
        :style="boxStyle"
        @pointerdown="startDrag('move', $event)"
        @pointermove="onDrag"
        @pointerup="endDrag"
        @pointercancel="endDrag"
      >
        <!-- 四角为 L 形角标、四边为透明热区（样式见 CSS） -->
        <span
          v-for="h in HANDLES"
          :key="h"
          class="ie-handle"
          :class="`ie-handle--${h}`"
          @pointerdown.stop="startDrag(h, $event)"
        />
      </div>
    </div>

    <!-- 尺寸控制区：宽 / 高输入 + 比例（图片下方） -->
    <div v-if="cropOriginal" class="ie-readout">
      <label class="ie-dim-field">
        <span class="ie-dim-unit">W</span>
        <input
          v-model="cropWInput"
          class="ie-dim-input"
          type="number"
          min="1"
          :max="origWidth"
          step="1"
          inputmode="numeric"
          @input="applyDimInput"
          @focus="onDimFocus"
          @blur="onDimBlur"
          @keyup.enter="blurOnEnter"
        />
        <span class="ie-dim-suffix">px</span>
      </label>

      <span class="ie-dims-sep">×</span>

      <label class="ie-dim-field">
        <span class="ie-dim-unit">H</span>
        <input
          v-model="cropHInput"
          class="ie-dim-input"
          type="number"
          min="1"
          :max="origHeight"
          step="1"
          inputmode="numeric"
          @input="applyDimInput"
          @focus="onDimFocus"
          @blur="onDimBlur"
          @keyup.enter="blurOnEnter"
        />
        <span class="ie-dim-suffix">px</span>
      </label>

      <span class="ie-ratio">{{ ratioLabel }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import { pasty } from "@pasty/plugin-sdk/ui";
import { autoFit } from "@pasty/plugin-sdk/dom";
import { PROCESS_IMAGE, type ImageEditDraft, type ProcessImageResp } from "./contracts";
import {
  applyDrag,
  aspectRatioLabel,
  boxFromCropSize,
  displayBoxToCrop,
  parseDimInput,
  type Box,
  type DragMode,
} from "./cropGeometry";

const MIN_SIZE = 16; // minimum crop side when dragging, display px
const HANDLES: DragMode[] = ["n", "s", "e", "w", "ne", "nw", "se", "sw"];
const AUTO_FIT_MIN = 120;
const AUTO_FIT_MAX = 560;

const rootEl = ref<HTMLElement | null>(null);
const imgEl = ref<HTMLImageElement | null>(null);
const cropBoxEl = ref<HTMLElement | null>(null);

const previewUrl = ref<string>("");
const errorMsg = ref<string>("");
const origWidth = ref<number>(0);
const origHeight = ref<number>(0);
const format = ref<string>("");
const quality = ref<number>(80);
const busy = ref<boolean>(false);

const displayWidth = ref<number>(0);
const displayHeight = ref<number>(0);
const box = ref<Box | null>(null);

const dragMode = ref<DragMode | null>(null);
let dragStart: { px: number; py: number; box: Box } | null = null;

const cropOriginal = computed(() => {
  if (!box.value || displayWidth.value <= 0 || origWidth.value <= 0) return null;
  return displayBoxToCrop(box.value, displayWidth.value, origWidth.value);
});

const ratioLabel = computed(() =>
  cropOriginal.value ? aspectRatioLabel(cropOriginal.value.width, cropOriginal.value.height) : "—",
);

// 宽 / 高输入框用本地草稿值，与 box 解耦。editingDims 标记「用户正在输入」：此时
// 不让 watch 回填，避免删字符被旧值顶回；非编辑态（如拖拽改框）则把真实尺寸同步进来。
// 注意：<input type="number" v-model> 会被 Vue 自动转成 number（即便没写 .number 修饰，
// 见 runtime-dom 的 castToNumber），所以草稿值类型是 string | number。统一交给 parseDimInput
// 兜底——旧代码当成 string 调 .trim() 会在 number 上抛错，导致整个 applyDimInput 中断、框不更新。
const cropWInput = ref<string | number>("");
const cropHInput = ref<string | number>("");
const editingDims = ref<boolean>(false);

watch(
  cropOriginal,
  (c) => {
    if (!c || editingDims.value) return;
    cropWInput.value = String(c.width);
    cropHInput.value = String(c.height);
  },
  { immediate: true },
);

// 输入即时联动裁剪框：按原图像素设宽 / 高，锚定左上角，clamp 到 [1, 原图] 与图片边界。
// 设成固定大小后，用户可直接拖动框体选择位置。minSize=1 让输入能裁到很小（不套拖拽的 16px 下限）。
function applyDimInput(): void {
  if (!box.value || displayWidth.value <= 0) return;
  box.value = boxFromCropSize(
    box.value,
    { width: parseDimInput(cropWInput.value), height: parseDimInput(cropHInput.value) },
    displayWidth.value,
    displayHeight.value,
    origWidth.value,
    origHeight.value,
    1,
  );
}

function onDimFocus(): void {
  editingDims.value = true;
}

// 失焦：退出编辑态，用 clamp 后的真实值回填，纠正越界 / 空输入的显示。
function onDimBlur(): void {
  editingDims.value = false;
  const c = cropOriginal.value;
  if (c) {
    cropWInput.value = String(c.width);
    cropHInput.value = String(c.height);
  }
}

function blurOnEnter(e: KeyboardEvent): void {
  (e.target as HTMLInputElement).blur();
}

const boxStyle = computed(() =>
  box.value
    ? {
        left: `${box.value.x}px`,
        top: `${box.value.y}px`,
        width: `${box.value.width}px`,
        height: `${box.value.height}px`,
      }
    : {},
);

const formatNote = computed(() => {
  const f = (format.value || "").toLowerCase();
  if (f === "png") return "PNG：质量调节调色板量化（无损格式，低值减小体积）";
  if (f === "jpeg" || f === "jpg") return "JPEG：质量为有损压缩等级";
  if (f === "webp") return "WebP：质量为有损压缩等级";
  if (f) return "该格式将以 PNG 无损输出（质量不改画质）";
  return "";
});

function applyDraft(raw: Record<string, unknown> | undefined): void {
  if (!raw) return;
  const d = raw as Partial<ImageEditDraft>;
  if (typeof d.origWidth === "number" && d.origWidth > 0) origWidth.value = d.origWidth;
  if (typeof d.origHeight === "number" && d.origHeight > 0) origHeight.value = d.origHeight;
  if (typeof d.format === "string") format.value = d.format;
  if (typeof d.quality === "number") quality.value = Math.min(100, Math.max(1, Math.round(d.quality)));
}

function fullBox(): Box {
  return { x: 0, y: 0, width: displayWidth.value, height: displayHeight.value };
}

// (Re)measure the rendered image and keep the crop box aligned across resizes.
function remeasure(): void {
  const el = imgEl.value;
  if (!el) return;
  const w = el.clientWidth;
  const h = el.clientHeight;
  if (w <= 0 || h <= 0) return;
  // The asset URL serves the full-resolution original, so naturalWidth equals
  // the original pixel width — a safe fallback if the draft didn't carry dims.
  if (origWidth.value <= 0 && el.naturalWidth > 0) {
    origWidth.value = el.naturalWidth;
    origHeight.value = el.naturalHeight;
  }
  const prevW = displayWidth.value;
  if (box.value && prevW > 0 && w !== prevW) {
    const f = w / prevW;
    box.value = {
      x: box.value.x * f,
      y: box.value.y * f,
      width: box.value.width * f,
      height: box.value.height * f,
    };
    // If a drag is mid-flight, rescale its captured anchor to the new display
    // size so the next pointermove doesn't snap (the start box was recorded in
    // pre-resize display pixels).
    if (dragStart) {
      dragStart = {
        px: dragStart.px,
        py: dragStart.py,
        box: {
          x: dragStart.box.x * f,
          y: dragStart.box.y * f,
          width: dragStart.box.width * f,
          height: dragStart.box.height * f,
        },
      };
    }
  }
  displayWidth.value = w;
  displayHeight.value = h;
  if (!box.value) box.value = fullBox();
}

function onImageLoad(): void {
  remeasure();
}

function onImageError(): void {
  errorMsg.value = "图片预览加载失败。";
}

function startDrag(mode: DragMode, e: PointerEvent): void {
  if (!box.value || !cropBoxEl.value) return;
  dragMode.value = mode;
  dragStart = { px: e.clientX, py: e.clientY, box: { ...box.value } };
  try {
    cropBoxEl.value.setPointerCapture(e.pointerId);
  } catch {
    /* capture is best-effort */
  }
  e.preventDefault();
}

function onDrag(e: PointerEvent): void {
  if (!dragMode.value || !dragStart) return;
  const dx = e.clientX - dragStart.px;
  const dy = e.clientY - dragStart.py;
  box.value = applyDrag(dragStart.box, dragMode.value, dx, dy, displayWidth.value, displayHeight.value, MIN_SIZE);
}

function endDrag(e: PointerEvent): void {
  dragMode.value = null;
  dragStart = null;
  try {
    cropBoxEl.value?.releasePointerCapture(e.pointerId);
  } catch {
    /* noop */
  }
}

async function loadPreview(): Promise<void> {
  try {
    const { url } = await pasty.asset.currentItemImageUrl();
    if (url) previewUrl.value = url;
    else errorMsg.value = "当前项目不是图片，无法编辑。";
  } catch {
    errorMsg.value = "无法加载图片预览。";
  }
}

async function setApplyButton(title: string, isEnabled: boolean): Promise<void> {
  try {
    await pasty.action.setButtons({ buttons: [{ id: "apply", title, isEnabled }] });
  } catch {
    // Local preview workbench has no host bridge.
  }
}

async function apply(): Promise<void> {
  if (busy.value) return;
  const crop = cropOriginal.value;
  if (!crop || crop.width < 1 || crop.height < 1) {
    errorMsg.value = "请先框选有效的裁剪区域。";
    return;
  }
  busy.value = true;
  errorMsg.value = "";
  await setApplyButton("处理中…", false);
  try {
    const resp = await pasty.runtime.invoke<ProcessImageResp>({
      key: PROCESS_IMAGE,
      payload: { quality: quality.value, crop },
      timeoutMs: 60_000,
    });
    await pasty.action.complete({
      result: {
        resultKind: "image",
        imageTempPath: resp.imageTempPath,
        imageFormatHint: resp.imageFormatHint,
      },
      userMessage: "已裁剪并压缩",
    });
    // Success is terminal: complete() ends the action session and the host
    // tears down this WebView, so we deliberately leave `busy` set (no reset).
  } catch (err) {
    errorMsg.value = `处理失败：${err instanceof Error ? err.message : String(err)}`;
    busy.value = false;
    await setApplyButton("应用", true);
  }
}

let unsubDraft: (() => void) | null = null;
let unsubHostInvoke: (() => void) | null = null;
let disconnectAutoFit: (() => void) | null = null;
let resizeObserver: ResizeObserver | null = null;

onMounted(() => {
  applyDraft(pasty.action.draft.current());
  unsubDraft = pasty.action.draft.on(applyDraft);
  unsubHostInvoke = pasty.action.onHostInvoke.on((payload) => {
    if (payload.buttonID === "apply") void apply();
  });
  void loadPreview();
  if (rootEl.value) {
    disconnectAutoFit = autoFit({ min: AUTO_FIT_MIN, max: AUTO_FIT_MAX, target: rootEl.value });
  }
  if (imgEl.value && typeof ResizeObserver !== "undefined") {
    resizeObserver = new ResizeObserver(() => remeasure());
    resizeObserver.observe(imgEl.value);
  }
});

onUnmounted(() => {
  unsubDraft?.();
  unsubDraft = null;
  unsubHostInvoke?.();
  unsubHostInvoke = null;
  disconnectAutoFit?.();
  disconnectAutoFit = null;
  resizeObserver?.disconnect();
  resizeObserver = null;
});
</script>

<style scoped>
/* ===== 根容器（透明，融入宿主原生背景）===== */
.ie-shell {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 0;
  background: transparent;
  -webkit-font-smoothing: antialiased;
}

.ie-error {
  margin: 0;
  padding: 6px 10px;
  font-size: 11.5px;
  line-height: 1.4;
  color: var(--pasty-danger, #e53e3e);
  background: color-mix(in srgb, var(--pasty-danger, #e53e3e) 10%, transparent);
  border: 0.5px solid color-mix(in srgb, var(--pasty-danger, #e53e3e) 30%, transparent);
  border-radius: 6px;
}

/* ===== 控制区（顶部）===== */
.ie-controls {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.ie-quality {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
}

.ie-quality-label {
  flex-shrink: 0;
  white-space: nowrap;
  font-size: 11.5px;
  letter-spacing: 0.01em;
  color: var(--pasty-text-secondary, inherit);
}

.ie-quality-value {
  flex-shrink: 0;
  width: 36px;
  text-align: right;
  font-size: 12px;
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.01em;
  color: var(--pasty-text-primary, inherit);
}

/* 自定义滑块：细 track + 白圆点 thumb，已填充段用 native accent 色 */
.ie-slider {
  flex: 1;
  min-width: 0;
  height: 16px;
  margin: 0;
  padding: 0;
  background: transparent;
  cursor: pointer;
  -webkit-appearance: none;
  appearance: none;
}

.ie-slider:focus {
  outline: none;
}

.ie-slider::-webkit-slider-runnable-track {
  height: 3px;
  border-radius: 999px;
  background: linear-gradient(
    to right,
    var(--pasty-accent, #3b82f6) 0 var(--ie-pct, 80%),
    var(--pasty-divider, rgba(127, 127, 127, 0.18)) var(--ie-pct, 80%) 100%
  );
}

.ie-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 13px;
  height: 13px;
  margin-top: -5px;
  border-radius: 50%;
  background: #fff;
  border: 0.5px solid rgba(0, 0, 0, 0.1);
  box-shadow:
    0 1px 2px rgba(0, 0, 0, 0.25),
    0 0 0 0.5px rgba(0, 0, 0, 0.06);
  transition: box-shadow 0.12s ease;
}

.ie-slider:hover::-webkit-slider-thumb {
  box-shadow:
    0 1px 4px rgba(0, 0, 0, 0.28),
    0 0 0 0.5px rgba(0, 0, 0, 0.08);
}

.ie-slider:focus-visible::-webkit-slider-thumb {
  box-shadow:
    0 1px 2px rgba(0, 0, 0, 0.2),
    0 0 0 3px color-mix(in srgb, var(--pasty-accent, #3b82f6) 30%, transparent);
}

.ie-slider::-moz-range-track {
  height: 3px;
  border-radius: 999px;
  background: var(--pasty-divider, rgba(127, 127, 127, 0.18));
}

.ie-slider::-moz-range-progress {
  height: 3px;
  border-radius: 999px;
  background: var(--pasty-accent, #3b82f6);
}

.ie-slider::-moz-range-thumb {
  width: 13px;
  height: 13px;
  border-radius: 50%;
  background: #fff;
  border: 0.5px solid rgba(0, 0, 0, 0.1);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.25);
}

.ie-format-note {
  margin: 0;
  font-size: 10.5px;
  line-height: 1.45;
  letter-spacing: 0.005em;
  color: var(--pasty-text-tertiary, #94a3b8);
}

/* ===== 图片 + 裁剪框（下方）===== */
.ie-stage {
  position: relative;
  align-self: center;
  max-width: 100%;
  line-height: 0;
  border-radius: 5px;
  /* 把裁剪框的四周遮罩裁进图片内，不让它外溢到上方控制区 */
  overflow: hidden;
}

.ie-img {
  display: block;
  max-width: 100%;
  max-height: 52vh;
  width: auto;
  height: auto;
  user-select: none;
  -webkit-user-drag: none;
}

/*
  裁剪框：极细双线描边（内层 accent 半透明 + 外层白色半透明 outline），让图片成为
  主角；在明、暗主题下都清晰。变暗遮罩用 box-shadow 实现，被 stage 的 overflow:hidden
  裁进图片内。
*/
.ie-crop {
  position: absolute;
  box-sizing: border-box;
  border: 1px solid color-mix(in srgb, var(--pasty-accent, #3b82f6) 70%, transparent);
  outline: 0.5px solid rgba(255, 255, 255, 0.35);
  outline-offset: -0.5px;
  box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.38);
  cursor: move;
  touch-action: none;
}

/*
  Handle：四角为 L 形角标（::before/::after 两条细臂），四边为透明热区（无视觉噪音）；
  全部贴框内侧定位 —— 既避免被 overflow:hidden 裁掉，又比实心方块克制。
*/
.ie-handle {
  position: absolute;
  --hc: var(--pasty-accent, #3b82f6); /* 角标颜色 */
  --hw: 2px; /* 角标线宽 */
  --hl: 10px; /* 角标臂长 */
  background: transparent;
  touch-action: none;
}

.ie-handle:hover {
  --hc: color-mix(in srgb, var(--pasty-accent, #3b82f6) 80%, #fff);
}

/* 四角：16px 触控热区，用 before/after 画 L 形角标 */
.ie-handle--nw,
.ie-handle--ne,
.ie-handle--sw,
.ie-handle--se {
  width: 16px;
  height: 16px;
}

.ie-handle--nw::before,
.ie-handle--nw::after,
.ie-handle--ne::before,
.ie-handle--ne::after,
.ie-handle--sw::before,
.ie-handle--sw::after,
.ie-handle--se::before,
.ie-handle--se::after {
  content: "";
  position: absolute;
  background: var(--hc);
  border-radius: 1px;
}

.ie-handle--nw { top: 0; left: 0; cursor: nwse-resize; }
.ie-handle--nw::before { top: 0; left: 0; width: var(--hw); height: var(--hl); }
.ie-handle--nw::after  { top: 0; left: 0; width: var(--hl); height: var(--hw); }

.ie-handle--ne { top: 0; right: 0; cursor: nesw-resize; }
.ie-handle--ne::before { top: 0; right: 0; width: var(--hw); height: var(--hl); }
.ie-handle--ne::after  { top: 0; right: 0; width: var(--hl); height: var(--hw); }

.ie-handle--sw { bottom: 0; left: 0; cursor: nesw-resize; }
.ie-handle--sw::before { bottom: 0; left: 0; width: var(--hw); height: var(--hl); }
.ie-handle--sw::after  { bottom: 0; left: 0; width: var(--hl); height: var(--hw); }

.ie-handle--se { bottom: 0; right: 0; cursor: nwse-resize; }
.ie-handle--se::before { bottom: 0; right: 0; width: var(--hw); height: var(--hl); }
.ie-handle--se::after  { bottom: 0; right: 0; width: var(--hl); height: var(--hw); }

/* 四边：仅透明热区，居中贴边 */
.ie-handle--n { top: 0; left: 50%; transform: translateX(-50%); width: 40%; height: 12px; cursor: ns-resize; }
.ie-handle--s { bottom: 0; left: 50%; transform: translateX(-50%); width: 40%; height: 12px; cursor: ns-resize; }
.ie-handle--e { right: 0; top: 50%; transform: translateY(-50%); width: 12px; height: 40%; cursor: ew-resize; }
.ie-handle--w { left: 0; top: 50%; transform: translateY(-50%); width: 12px; height: 40%; cursor: ew-resize; }

/* ===== 尺寸控制区（图片下方，居中）===== */
.ie-readout {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 6px;
}

/* 宽 / 高输入字段 */
.ie-dim-field {
  display: flex;
  align-items: center;
  gap: 3px;
  padding: 2px 6px 2px 5px;
  border-radius: 5px;
  background: color-mix(in srgb, var(--pasty-surface, #808080) 8%, transparent);
  border: 0.5px solid var(--pasty-border, rgba(128, 128, 128, 0.2));
  cursor: text;
  transition:
    border-color 0.1s ease,
    background 0.1s ease;
}

.ie-dim-field:focus-within {
  border-color: color-mix(in srgb, var(--pasty-accent, #3b82f6) 60%, transparent);
  background: color-mix(in srgb, var(--pasty-accent, #3b82f6) 6%, transparent);
}

.ie-dim-unit {
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--pasty-text-tertiary, #94a3b8);
  user-select: none;
  transition: color 0.1s ease;
}

.ie-dim-field:focus-within .ie-dim-unit {
  color: var(--pasty-accent, #3b82f6);
}

.ie-dim-input {
  width: 44px;
  padding: 0;
  border: none;
  background: transparent;
  font-family: "SF Mono", "Menlo", "Consolas", ui-monospace, monospace;
  font-size: 11.5px;
  font-variant-numeric: tabular-nums;
  text-align: right;
  color: var(--pasty-text-primary, inherit);
  outline: none;
  -webkit-appearance: none;
  -moz-appearance: textfield;
  appearance: textfield;
}

.ie-dim-input::-webkit-inner-spin-button,
.ie-dim-input::-webkit-outer-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

.ie-dim-suffix {
  font-size: 10px;
  letter-spacing: 0.02em;
  color: var(--pasty-text-tertiary, #94a3b8);
  user-select: none;
}

.ie-dims-sep {
  flex-shrink: 0;
  font-size: 11px;
  color: var(--pasty-text-tertiary, #94a3b8);
  user-select: none;
}

/* 比例标签（整数比，如 16:9） */
.ie-ratio {
  padding: 2px 5px;
  border-radius: 4px;
  background: color-mix(in srgb, var(--pasty-surface, #808080) 6%, transparent);
  border: 0.5px solid var(--pasty-divider, rgba(128, 128, 128, 0.12));
  font-family: "SF Mono", "Menlo", "Consolas", ui-monospace, monospace;
  font-size: 10.5px;
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.02em;
  color: var(--pasty-text-tertiary, #94a3b8);
  user-select: none;
}
</style>
