<template>
  <main class="decode-shell">
    <template v-if="payload">
      <header class="decode-header">
        <span
          class="decode-badge"
          :class="`decode-badge--${payload.encoding}`"
        >{{ encodingLabel }}</span>
        <span class="decode-sizes" aria-hidden="true">
          {{ payload.originalLength }} → {{ payload.decodedLength }}
        </span>
      </header>

      <section class="decode-body">
        <template v-if="payload.encoding === 'jwt' && payload.jwt">
          <div class="decode-section">
            <p class="decode-section-label">Header</p>
            <pre class="decode-code">{{ headerPretty }}</pre>
          </div>
          <div class="decode-section">
            <p class="decode-section-label">Payload</p>
            <pre class="decode-code">{{ payloadPretty }}</pre>
          </div>
        </template>
        <template v-else>
          <pre class="decode-code">{{ bodyText }}</pre>
        </template>
      </section>
    </template>

    <p v-else class="decode-empty">No decoded payload available.</p>
  </main>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted } from "vue";
import { pasty } from "@pasty/plugin-sdk/ui";
import { usePluginAttachmentSession } from "./composables/usePluginAttachmentSession";

const ENCODING_LABELS = {
  jwt: "JWT",
  escaped_json: "Escaped JSON",
  url: "URL",
  base64: "Base64"
};

const { payload } = usePluginAttachmentSession();

let disposeAutoFit = null;

const encodingLabel = computed(
  () => ENCODING_LABELS[payload.value?.encoding] || ""
);

function safeStringify(value) {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return "";
  }
}

const headerPretty = computed(() => safeStringify(payload.value?.jwt?.header ?? null));
const payloadPretty = computed(() => safeStringify(payload.value?.jwt?.payload ?? null));
const bodyText = computed(() => payload.value?.decoded ?? "");

onMounted(async () => {
  try {
    disposeAutoFit = await pasty.window.autoFit({ min: 60, max: 480 });
  } catch (error) {
    if (typeof console !== "undefined") {
      console.warn("[decode-renderer] autoFit failed:", error);
    }
  }
});

onBeforeUnmount(() => {
  if (typeof disposeAutoFit === "function") {
    disposeAutoFit();
    disposeAutoFit = null;
  }
});
</script>

<style scoped>
.decode-shell {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 8px 4px;
  color: var(--pasty-text-primary, #0f172a);
  background: transparent;
}

.decode-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 0 4px;
}

.decode-badge {
  display: inline-flex;
  align-items: center;
  padding: 3px 10px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--pasty-accent-contrast, #ffffff);
  background: var(--pasty-accent, #2563eb);
}

.decode-badge--jwt {
  background: var(--pasty-accent, #7c3aed);
}
.decode-badge--escaped_json {
  background: var(--pasty-success, #0f766e);
}
.decode-badge--url {
  background: var(--pasty-accent, #2563eb);
}
.decode-badge--base64 {
  background: var(--pasty-warning, #d97706);
}

.decode-sizes {
  font-size: 11px;
  color: var(--pasty-text-tertiary, #64748b);
  font-variant-numeric: tabular-nums;
}

.decode-body {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 0 4px;
}

.decode-section {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.decode-section-label {
  margin: 0;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--pasty-text-tertiary, #64748b);
}

.decode-code {
  margin: 0;
  padding: 0;
  font-family: "SF Mono", "Menlo", "Consolas", "Liberation Mono", monospace;
  font-size: 12px;
  line-height: 1.45;
  white-space: pre-wrap;
  word-break: break-all;
  color: var(--pasty-text-primary, #0f172a);
}

.decode-empty {
  margin: 0;
  padding: 8px 4px;
  font-size: 12px;
  color: var(--pasty-text-tertiary, #64748b);
}
</style>
