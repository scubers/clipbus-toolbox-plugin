<template>
  <main class="workbench" :data-theme="selectedTheme">
    <section class="workbench__controls">
      <label class="workbench__control">
        <span>Scenario</span>
        <select v-model="selectedScenarioID">
          <option
            v-for="scenario in attachmentScenarios"
            :key="scenario.id"
            :value="scenario.id"
          >
            {{ scenario.label }}
          </option>
        </select>
      </label>

      <label class="workbench__control">
        <span>Theme</span>
        <select v-model="selectedTheme">
          <option value="dark">Dark Host</option>
          <option value="light">Light Host</option>
        </select>
      </label>
    </section>

    <section class="workbench__canvas">
      <div class="host-frame">
        <div class="host-frame__title">
          <span>Decode Renderer</span>
          <span>{{ frameSizeLabel }}</span>
        </div>

        <div class="host-frame__surface">
          <div class="host-frame__viewport-shell">
            <div class="host-frame__viewport" :style="viewportStyle">
              <div class="host-frame__webview">
                <DecodeRendererApp :key="componentKey" />
              </div>
            </div>

            <div class="host-frame__chrome">
              <span class="host-frame__chrome-label">Host resize</span>
              <button
                class="host-frame__resize-handle"
                type="button"
                aria-label="Resize host preview viewport"
                @pointerdown="startResize"
              />
            </div>
          </div>

          <div class="host-frame__strip">
            <button
              v-for="button in activeButtons"
              :key="button.id"
              class="host-frame__button"
              type="button"
              @click="previewHostButton(button)"
            >
              {{ button.title }}
            </button>
          </div>
        </div>
      </div>

      <aside class="workbench__notes">
        <p class="workbench__notes-title">Preview Notes</p>
        <p class="workbench__notes-body">
          Simulates host chrome, theme changes, and bootstrap events for the decode renderer.
        </p>
        <p class="workbench__notes-body">
          Drag the host resize control below the viewport to watch autoFit drive the card height. In local preview, bridge calls fall back to console logging.
        </p>
        <p class="workbench__notes-status">{{ statusMessage }}</p>
      </aside>
    </section>
  </main>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from "vue";
import DecodeRendererApp from "../features/decode-renderer/app.vue";
import { attachmentScenarios } from "./scenarios/attachmentScenarios";

type ThemeKey = "light" | "dark";

const query = new URLSearchParams(window.location.search);
const selectedTheme = ref<ThemeKey>(query.get("theme") === "light" ? "light" : "dark");
const statusMessage = ref<string>("Ready for local UI iteration.");

interface HostButton { id: string; title: string; isEnabled?: boolean }
const activeButtons = ref<HostButton[]>([]);

function previewHostButton(button: HostButton): void {
  // Attachment-renderer host invokes carry `{ buttonID }` on the
  // pasty-plugin-attachment-host-invoke stream (post plugin-api-shrink wire).
  window.dispatchEvent(
    new CustomEvent("pasty-plugin-attachment-host-invoke", { detail: { buttonID: button.id } }),
  );
}

onMounted(() => {
  window.addEventListener("pasty-plugin-set-buttons", (e) => {
    const ev = e as CustomEvent<{ buttons?: HostButton[] }>;
    activeButtons.value = Array.isArray(ev.detail?.buttons) ? ev.detail.buttons : [];
  });
});

const selectedScenarioID = ref<string>(resolveInitialScenarioID());

const activeScenario = computed(() =>
  attachmentScenarios.find((scenario) => scenario.id === selectedScenarioID.value) || attachmentScenarios[0],
);

const componentKey = computed<string>(() => `renderer:${activeScenario.value?.id ?? "unknown"}`);

interface ViewportSize { width: number; height: number; }

const minimumViewportSize: ViewportSize = { width: 320, height: 80 };
const viewportSize = reactive<ViewportSize>({ width: 560, height: 240 });

const viewportStyle = computed(() => ({
  width: `${viewportSize.width}px`,
  height: `${viewportSize.height}px`,
}));

const frameSizeLabel = computed<string>(() => `${viewportSize.width} × ${viewportSize.height}`);

interface ResizeSession {
  startPointerX: number;
  startPointerY: number;
  startWidth: number;
  startHeight: number;
}

let resizeSession: ResizeSession | null = null;

watch(
  [selectedScenarioID, selectedTheme],
  () => {
    applyPreviewState();
    syncQuery();
  },
  { immediate: true },
);

function resolveInitialScenarioID(): string {
  const requested = query.get("scenario");
  return attachmentScenarios.some((scenario) => scenario.id === requested)
    ? (requested as string)
    : attachmentScenarios[0].id;
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function dispatchPreviewEvent(name: string, detail: unknown): void {
  window.dispatchEvent(new CustomEvent(name, { detail }));
}

function buildThemeSnapshot(accentHex: string): { scheme: string; tokens: Record<string, string> } {
  const light = selectedTheme.value === "light";
  return {
    scheme: selectedTheme.value,
    tokens: {
      surface: light ? "#ffffff" : "#1e293b",
      surfaceElevated: light ? "#f8fafc" : "#0f172a",
      textPrimary: light ? "#0f172a" : "#e2e8f0",
      textSecondary: light ? "#475569" : "#cbd5e1",
      textTertiary: light ? "#64748b" : "#94a3b8",
      accent: accentHex,
      accentContrast: "#ffffff",
      border: "rgba(148, 163, 184, 0.3)",
      divider: "rgba(148, 163, 184, 0.4)",
      success: "#16a34a",
      warning: "#f59e0b",
      danger: "#dc2626",
    },
  };
}

function applyPreviewState(): void {
  const scenario = activeScenario.value;
  if (!scenario) {
    return;
  }

  const bootstrap = clone(scenario.bootstrap) as unknown as Record<string, unknown>;

  window.__PASTY_PLUGIN_CONTEXT__ = null;
  window.__PASTY_PLUGIN_ITEM__ = null;
  window.__PASTY_PLUGIN_ATTACHMENT__ = null;
  window.__PASTY_PLUGIN_THEME__ = null;

  const pluginID = String(bootstrap.pluginID ?? "plugin.pasty.toolbox");
  const themeSnapshot = buildThemeSnapshot(scenario.accentHex ?? "#2563eb");
  const context = { mode: "attachmentRenderer", pluginID };
  const itemPayload = bootstrap.item;
  const attachmentPayload = { item: bootstrap.item, attachment: bootstrap.attachment };

  window.__PASTY_PLUGIN_CONTEXT__ = context;
  window.__PASTY_PLUGIN_ITEM__ = itemPayload;
  window.__PASTY_PLUGIN_ATTACHMENT__ = attachmentPayload;
  window.__PASTY_PLUGIN_THEME__ = themeSnapshot;

  dispatchPreviewEvent("pasty-plugin-context", context);
  dispatchPreviewEvent("pasty-plugin-item", itemPayload);
  dispatchPreviewEvent("pasty-plugin-attachment", attachmentPayload);
  dispatchPreviewEvent("pasty-plugin-theme", themeSnapshot);

  // Seed the host button strip from the scenario bootstrap. In local preview
  // the SDK does not emit setButtons over a window event, so the live
  // renderer's syncHostButtons() is a no-op here; the seed keeps the strip
  // populated. Clicks still flow through pasty-plugin-attachment-host-invoke.
  activeButtons.value = scenario.bootstrap.buttons;
  statusMessage.value = `Renderer preview loaded: ${scenario.label}`;
}

function syncQuery(): void {
  const next = new URL(window.location.href);
  next.searchParams.set("scenario", selectedScenarioID.value);
  next.searchParams.set("theme", selectedTheme.value);
  window.history.replaceState({}, "", next);
}

function startResize(event: PointerEvent): void {
  event.preventDefault();
  stopResize();
  resizeSession = {
    startPointerX: event.clientX,
    startPointerY: event.clientY,
    startWidth: viewportSize.width,
    startHeight: viewportSize.height,
  };
  window.addEventListener("pointermove", handleResizePointerMove);
  window.addEventListener("pointerup", stopResize);
  window.addEventListener("pointercancel", stopResize);
}

function stopResize(): void {
  resizeSession = null;
  window.removeEventListener("pointermove", handleResizePointerMove);
  window.removeEventListener("pointerup", stopResize);
  window.removeEventListener("pointercancel", stopResize);
}

function handleResizePointerMove(event: PointerEvent): void {
  if (!resizeSession) {
    return;
  }
  const { startPointerX, startPointerY, startWidth, startHeight } = resizeSession;
  viewportSize.width = Math.max(minimumViewportSize.width, Math.round(startWidth + (event.clientX - startPointerX)));
  viewportSize.height = Math.max(minimumViewportSize.height, Math.round(startHeight + (event.clientY - startPointerY)));
}

onBeforeUnmount(() => {
  stopResize();
});
</script>

<style scoped>
.workbench {
  min-height: 100%;
  padding: 24px;
  color: #e2e8f0;
  background:
    radial-gradient(circle at top left, rgba(15, 118, 110, 0.22), transparent 24%),
    linear-gradient(180deg, #111827, #0f172a);
}

.workbench[data-theme="light"] {
  color: #0f172a;
  background:
    radial-gradient(circle at top left, rgba(14, 165, 233, 0.18), transparent 24%),
    linear-gradient(180deg, #e2e8f0, #cbd5e1);
}

.workbench__controls {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 20px;
}

.workbench__control {
  display: grid;
  gap: 6px;
}

.workbench__control span {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: rgba(226, 232, 240, 0.72);
}

.workbench[data-theme="light"] .workbench__control span {
  color: rgba(15, 23, 42, 0.62);
}

.workbench__control select {
  min-width: 170px;
  padding: 10px 12px;
  border-radius: 12px;
  border: 1px solid rgba(148, 163, 184, 0.26);
  background: rgba(15, 23, 42, 0.48);
  color: inherit;
}

.workbench[data-theme="light"] .workbench__control select {
  background: rgba(255, 255, 255, 0.82);
}

.workbench__canvas {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 260px;
  gap: 20px;
  align-items: start;
}

.host-frame {
  padding: 18px;
  border-radius: 22px;
  background: rgba(15, 23, 42, 0.34);
  border: 1px solid rgba(45, 212, 191, 0.2);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);
  overflow: auto;
}

.workbench[data-theme="light"] .host-frame {
  background: rgba(248, 250, 252, 0.52);
  border-color: rgba(148, 163, 184, 0.28);
}

.host-frame__title {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.04em;
  color: rgba(226, 232, 240, 0.8);
}

.workbench[data-theme="light"] .host-frame__title {
  color: rgba(15, 23, 42, 0.7);
}

.host-frame__surface {
  display: grid;
  gap: 12px;
  justify-items: start;
}

.host-frame__viewport-shell {
  display: grid;
  gap: 8px;
  justify-items: start;
}

.host-frame__webview {
  width: 100%;
  height: 100%;
  overflow: hidden;
  border-radius: 20px;
}

.host-frame__chrome {
  width: 100%;
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 8px;
  padding-right: 4px;
}

.host-frame__chrome-label {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: rgba(148, 163, 184, 0.88);
}

.host-frame__resize-handle {
  width: 20px;
  height: 20px;
  border: 0;
  padding: 0;
  border-radius: 999px;
  background:
    linear-gradient(135deg, transparent 0 48%, rgba(148, 163, 184, 0.82) 48% 56%, transparent 56% 100%),
    rgba(15, 23, 42, 0.78);
  box-shadow: 0 4px 14px rgba(15, 23, 42, 0.22);
  cursor: nwse-resize;
}

.host-frame__resize-handle:hover {
  background:
    linear-gradient(135deg, transparent 0 48%, rgba(226, 232, 240, 0.96) 48% 56%, transparent 56% 100%),
    rgba(15, 23, 42, 0.92);
}

.host-frame__strip {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.host-frame__button {
  appearance: none;
  border: 1px solid rgba(148, 163, 184, 0.24);
  border-radius: 999px;
  padding: 10px 16px;
  background: rgba(30, 41, 59, 0.54);
  color: #cbd5e1;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
}

.workbench[data-theme="light"] .host-frame__button {
  background: rgba(255, 255, 255, 0.82);
  color: #334155;
}

.workbench[data-theme="light"] .host-frame__chrome-label {
  color: rgba(71, 85, 105, 0.92);
}

.workbench[data-theme="light"] .host-frame__resize-handle {
  background:
    linear-gradient(135deg, transparent 0 48%, rgba(71, 85, 105, 0.82) 48% 56%, transparent 56% 100%),
    rgba(255, 255, 255, 0.92);
}

.workbench__notes {
  padding: 16px;
  border-radius: 18px;
  background: rgba(15, 23, 42, 0.42);
  border: 1px solid rgba(148, 163, 184, 0.16);
}

.workbench[data-theme="light"] .workbench__notes {
  background: rgba(255, 255, 255, 0.76);
}

.workbench__notes-title {
  margin: 0;
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.workbench__notes-body,
.workbench__notes-status {
  margin: 10px 0 0;
  font-size: 13px;
  line-height: 1.5;
  color: rgba(226, 232, 240, 0.78);
}

.workbench[data-theme="light"] .workbench__notes-body,
.workbench[data-theme="light"] .workbench__notes-status {
  color: rgba(15, 23, 42, 0.72);
}

.workbench__notes-status {
  font-weight: 600;
}

@media (max-width: 980px) {
  .workbench__canvas {
    grid-template-columns: minmax(0, 1fr);
  }

  .workbench__notes {
    order: -1;
  }
}
</style>
