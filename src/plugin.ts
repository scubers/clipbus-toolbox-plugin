import { definePlugin } from "@pasty/plugin-sdk/runtime";
import { features } from "./features/index.ts";
import { mergeFeatures } from "./features/registry.ts";

export default definePlugin({
  setup() {
    return mergeFeatures(features);
  },
});
