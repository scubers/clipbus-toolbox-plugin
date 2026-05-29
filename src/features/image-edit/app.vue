<template>
  <div ref="rootEl" class="ie-shell">
    <p v-if="errorMsg" class="ie-error">{{ errorMsg }}</p>

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
        <span
          v-for="h in HANDLES"
          :key="h"
          class="ie-handle"
          :class="`ie-handle--${h}`"
          @pointerdown.stop="startDrag(h, $event)"
        />
      </div>
    </div>

    <div class="ie-controls">
      <div class="ie-readout">
        <template v-if="cropOriginal">
          <span class="ie-dims">{{ cropOriginal.width }} × {{ cropOriginal.height }} px</span>
          <span class="ie-ratio">{{ ratioLabel }}</span>
        </template>
        <span v-else class="ie-dims">—</span>
      </div>

      <label class="ie-quality">
        <span class="ie-quality-label">压缩质量</span>
        <input
          v-model.number="quality"
          class="ie-slider"
          type="range"
          min="1"
          max="100"
          step="1"
        />
        <span class="ie-quality-value">{{ quality }}%</span>
      </label>

      <p class="ie-format-note">{{ formatNote }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";
import { pasty } from "@pasty/plugin-sdk/ui";
import { autoFit } from "@pasty/plugin-sdk/dom";
import { PROCESS_IMAGE, type ImageEditDraft, type ProcessImageResp } from "./contracts";
import { applyDrag, aspectRatioLabel, displayBoxToCrop, type Box, type DragMode } from "./cropGeometry";

const MIN_SIZE = 16; // minimum crop side, display px
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
.ie-shell {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 8px;
  background: var(--pasty-surface, transparent);
}

.ie-error {
  margin: 0;
  font-size: 12px;
  color: var(--pasty-danger, #dc2626);
}

.ie-stage {
  position: relative;
  display: inline-block;
  align-self: center;
  max-width: 100%;
  line-height: 0;
}

.ie-img {
  display: block;
  max-width: 100%;
  max-height: 56vh;
  width: auto;
  height: auto;
  user-select: none;
  -webkit-user-drag: none;
}

.ie-crop {
  position: absolute;
  box-sizing: border-box;
  border: 1px solid var(--pasty-accent, #3b82f6);
  box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.45);
  cursor: move;
  touch-action: none;
}

.ie-handle {
  position: absolute;
  width: 10px;
  height: 10px;
  background: var(--pasty-accent, #3b82f6);
  border: 1px solid #fff;
  border-radius: 2px;
  touch-action: none;
}

.ie-handle--n {
  top: -5px;
  left: 50%;
  margin-left: -5px;
  cursor: ns-resize;
}
.ie-handle--s {
  bottom: -5px;
  left: 50%;
  margin-left: -5px;
  cursor: ns-resize;
}
.ie-handle--e {
  top: 50%;
  right: -5px;
  margin-top: -5px;
  cursor: ew-resize;
}
.ie-handle--w {
  top: 50%;
  left: -5px;
  margin-top: -5px;
  cursor: ew-resize;
}
.ie-handle--ne {
  top: -5px;
  right: -5px;
  cursor: nesw-resize;
}
.ie-handle--nw {
  top: -5px;
  left: -5px;
  cursor: nwse-resize;
}
.ie-handle--se {
  bottom: -5px;
  right: -5px;
  cursor: nwse-resize;
}
.ie-handle--sw {
  bottom: -5px;
  left: -5px;
  cursor: nesw-resize;
}

.ie-controls {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  gap: 6px;
  background: var(--pasty-surface, transparent);
}

.ie-readout {
  display: flex;
  gap: 10px;
  align-items: baseline;
  font-family: "SF Mono", "Menlo", "Consolas", monospace;
  font-size: 12px;
  color: var(--pasty-text-primary, inherit);
}

.ie-ratio {
  color: var(--pasty-text-secondary, #64748b);
}

.ie-quality {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
}

.ie-quality-label {
  white-space: nowrap;
  color: var(--pasty-text-secondary, #64748b);
}

.ie-slider {
  flex: 1;
  min-width: 0;
}

.ie-quality-value {
  width: 42px;
  text-align: right;
  font-variant-numeric: tabular-nums;
  color: var(--pasty-text-primary, inherit);
}

.ie-format-note {
  margin: 0;
  font-size: 11px;
  color: var(--pasty-text-tertiary, #94a3b8);
}
</style>
