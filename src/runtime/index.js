const { definePlugin } = require("@pasty/plugin-sdk/runtime");
const { createDecodeDetector } = require("./detectors/decodeDetector");
const { createDecodeRenderer } = require("./renderers/decodeRenderer");

module.exports = definePlugin({
  setup() {
    return {
      detectors: {
        "decode-detector": createDecodeDetector()
      },
      attachmentRenderers: {
        "decode-renderer": createDecodeRenderer()
      }
    };
  }
});
