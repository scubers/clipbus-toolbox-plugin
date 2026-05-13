const { rendererResult } = require("@pasty/plugin-sdk/runtime");
const {
  decodeTemplateExpandedPayload,
  formatTemplateAttachmentPayload
} = require("../shared/templateAttachmentPayload");
const {
  formatTemplateDebugJSON
} = require("../shared/templateCapabilityMetadata");

function resolveAttachment(input) {
  const payload = decodeTemplateExpandedPayload(input?.attachment?.payloadJson);
  if (!payload) {
    return {
      displayName: "Template Expanded Preview",
      tintHex: "#6B7280",
      buttons: [
        { id: "toggle-debug", title: "Toggle", isEnabled: false },
        { id: "copy-debug-json", title: "Copy Debug", isEnabled: false }
      ]
    };
  }

  const headline = payload?.display?.headline;
  return {
    displayName: headline ? `Template Expanded · ${headline}` : "Template Expanded",
    tintHex: "#2563EB",
    buttons: [
      // Native action: clicking dispatches `pasty-plugin-renderer-action` to the
      // WebView so the Vue page can toggle its debug section (parallel to the
      // in-WebView Show/Hide Debug button). Runtime side is a no-op acknowledge.
      { id: "toggle-debug", title: "Toggle", isEnabled: true },
      { id: "copy-debug-json", title: "Copy Debug", isEnabled: true }
    ]
  };
}

async function invokeOperation(input, ctx) {
  const payload = decodeTemplateExpandedPayload(input?.attachment?.payloadJson);
  if (!payload) {
    return rendererResult.failure("Invalid template expanded payload");
  }

  if (input.buttonID === "copy-debug-json") {
    await ctx.host.clipboard.copyText(
      formatTemplateDebugJSON({
        kind: payload.kind,
        extended: payload.extended,
        debug: payload.debug,
        context: {
          contentBytes: input?.content?.payload?.bytes ?? null,
          attachments: (input?.attachments ?? []).map(a => ({
            attachmentType: a.attachmentType,
            attachmentKey: a.attachmentKey
          }))
        }
      })
    );
    return rendererResult.success({ userMessage: "Template expanded debug copied" });
  }

  if (input.buttonID === "toggle-debug") {
    // UI handles DOM toggle locally; runtime acknowledges so attachAutoFit can
    // observe the resulting height change and drive bridge.setHeight via the
    // ResizeObserver wired up in ExpandedAttachmentTemplateApp.vue.
    return rendererResult.success();
  }

  if (input.buttonID === "copy-payload-json") {
    await ctx.host.clipboard.copyText(formatTemplateAttachmentPayload(payload));
    return rendererResult.success({ userMessage: "Template expanded payload copied" });
  }

  return rendererResult.success();
}

function createTemplateExpandedRenderer() {
  return {
    async resolveAttachment(input, ctx) {
      return resolveAttachment(input, ctx);
    },
    async invokeOperation(input, ctx) {
      return invokeOperation(input, ctx);
    }
  };
}

module.exports = {
  createTemplateExpandedRenderer,
  invokeOperation,
  resolveAttachment
};
