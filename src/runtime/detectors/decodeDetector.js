"use strict";

const { preprocess, runPriorityChain } = require("../shared/detection");
const {
  createDecodePayload,
  buildSearchProjection
} = require("../shared/decodePayload");

function detectArtifacts(input) {
  if (!input || typeof input !== "object") {
    return [];
  }
  const content = input.content;
  if (!content || content.kind !== "text") {
    return [];
  }
  const rawText = content.payload && typeof content.payload.text === "string"
    ? content.payload.text
    : null;
  if (rawText === null) {
    return [];
  }

  const { trimmed, bail } = preprocess(rawText);
  if (bail) {
    return [];
  }

  const detection = runPriorityChain(trimmed);
  if (!detection) {
    return [];
  }

  const payload = createDecodePayload({
    encoding: detection.encoding,
    decoded: detection.decoded,
    jwt: detection.jwt || null,
    original: trimmed
  });
  if (!payload) {
    return [];
  }

  return [
    {
      attachmentType: "plugin.pasty.awesome.decode.preview",
      attachmentKey: "primary",
      payloadJson: JSON.stringify(payload),
      searchProjection: buildSearchProjection(payload),
      attachmentSyncScope: "syncable"
    }
  ];
}

function createDecodeDetector() {
  return {
    async detect(input) {
      return { artifacts: detectArtifacts(input) };
    }
  };
}

module.exports = {
  createDecodeDetector,
  detectArtifacts
};
