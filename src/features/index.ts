import type { PluginFeature } from "./registry.ts";
import { decodeFeature } from "./decode-renderer/feature.ts";
import { caseConvertFeature } from "./case-convert/feature.ts";

// Roster of every feature this plugin ships. Adding a feature = create its
// src/features/<name>/ folder with a feature.ts, then list it here.
export const features: PluginFeature[] = [decodeFeature, caseConvertFeature];
