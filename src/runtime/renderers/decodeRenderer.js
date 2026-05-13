"use strict";

const { rendererResult } = require("@pasty/plugin-sdk/runtime");
const {
  decodeDecodePayload,
  encodingLabel
} = require("../shared/decodePayload");

const ATTACHMENT_TYPE = "plugin.pasty.awesome.decode.preview";
const ATTACHMENT_KEY = "primary";

function buttonsFor(payload) {
  // Host consumes `isEnabled` to decide whether to render the native button.
  // The protocol is: return only buttons that should appear (omit unavailable
  // ones), and every returned button must carry `isEnabled: true`.
  const buttons = [];
  buttons.push({ id: "copy-decoded", title: "Copy", isEnabled: true });
  if (payload.encoding === "jwt" || payload.decodedIsJSON === true) {
    buttons.push({ id: "copy-json", title: "Copy as JSON", isEnabled: true });
  }
  buttons.push({
    id: "toggle-expand",
    title: payload.expanded === true ? "Show Less" : "Show More",
    isEnabled: true
  });
  return buttons;
}

function resolveAttachment(input) {
  const payload = decodeDecodePayload(input?.attachment?.payloadJson);
  if (!payload) {
    return {
      displayName: "Decoded Preview",
      tintHex: null,
      buttons: []
    };
  }

  const label = encodingLabel(payload.encoding);
  return {
    displayName: `Decoded Preview · ${label}`,
    // tintHex: null lets the host apply its theme accent automatically.
    tintHex: null,
    buttons: buttonsFor(payload)
  };
}

async function invokeOperation(input, ctx) {
  const payload = decodeDecodePayload(input?.attachment?.payloadJson);
  if (!payload) {
    return rendererResult.failure("Invalid decode payload");
  }

  const buttonID = input?.buttonID;
  const clipboard = ctx?.host?.clipboard;

  if (buttonID === "copy-decoded") {
    await clipboard.copyText(payload.decoded);
    return rendererResult.success({ userMessage: "Decoded copied" });
  }

  if (buttonID === "copy-json") {
    try {
      const parsed = JSON.parse(payload.decoded);
      const pretty = JSON.stringify(parsed, null, 2);
      await clipboard.copyText(pretty);
      return rendererResult.success({ userMessage: "JSON copied" });
    } catch {
      await clipboard.copyText(payload.decoded);
      return rendererResult.success({
        userMessage: "JSON parse failed, copied raw"
      });
    }
  }

  if (buttonID === "toggle-expand") {
    const nextExpanded = payload.expanded !== true;
    const nextPayload = { ...payload, expanded: nextExpanded };
    const attachmentType =
      input?.attachment?.attachmentType || ATTACHMENT_TYPE;
    const attachmentKey =
      input?.attachment?.attachmentKey || ATTACHMENT_KEY;

    await ctx.host.item.setAttachments({
      attachments: [
        {
          attachmentType,
          attachmentKey,
          payloadJson: JSON.stringify(nextPayload),
          attachmentSyncScope: "syncable"
        }
      ]
    });

    return rendererResult.success({
      userMessage: nextExpanded ? "Expanded" : "Collapsed"
    });
  }

  return rendererResult.success();
}

function createDecodeRenderer() {
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
  createDecodeRenderer,
  resolveAttachment,
  invokeOperation
};
