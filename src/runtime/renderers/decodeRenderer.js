"use strict";

const { rendererResult } = require("@pasty/plugin-sdk/runtime");
const {
  decodeDecodePayload,
  encodingLabel
} = require("../shared/decodePayload");

const ENCODING_TINT = Object.freeze({
  jwt: "#7C3AED",
  escaped_json: "#0F766E",
  url: "#2563EB",
  base64: "#D97706"
});

function buttonsFor(payload) {
  const copyJsonEnabled =
    payload.encoding === "jwt" || payload.decodedIsJSON === true;
  return [
    { id: "copy-decoded", title: "Copy Decoded", isEnabled: true },
    { id: "copy-json", title: "Copy as JSON", isEnabled: copyJsonEnabled }
  ];
}

function resolveAttachment(input) {
  const payload = decodeDecodePayload(input?.attachment?.payloadJson);
  if (!payload) {
    return {
      displayName: "Decoded Preview",
      tintHex: "#6B7280",
      buttons: [
        { id: "copy-decoded", title: "Copy Decoded", isEnabled: false },
        { id: "copy-json", title: "Copy as JSON", isEnabled: false }
      ]
    };
  }

  const label = encodingLabel(payload.encoding);
  return {
    displayName: `Decoded Preview · ${label}`,
    tintHex: ENCODING_TINT[payload.encoding] || "#6B7280",
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
