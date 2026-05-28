import type { PluginFeature } from "../registry.ts";
import { createDecodeDetector } from "./detector.ts";
import { createDecodeRenderer } from "./renderer.ts";

export const decodeFeature: PluginFeature = {
  detectors: { "decode-detector": createDecodeDetector() },
  attachmentRenderers: { "decode-renderer": createDecodeRenderer() },
};
