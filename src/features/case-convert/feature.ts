import { actionResult } from "@pasty/plugin-sdk/runtime";
import type { PluginAutoRunActionHandler } from "@pasty/plugin-sdk/runtime";
import type { PluginFeature } from "../registry.ts";

// The SDK handler type covers both action lifecycles in one shape, so it lists
// resolveSession as required even for auto-run. These actions never open a
// draft session; the empty resolveSession only satisfies the type contract and
// the host ignores it for auto-run lifecycle.
function createCaseAction(
  transform: (text: string) => string,
  userMessage: string,
): PluginAutoRunActionHandler {
  return {
    async resolveSession() {
      return { buttons: [], initialDraft: {} };
    },
    async runAutoAction(input) {
      if (input.content.kind !== "text") {
        return actionResult.none();
      }
      return actionResult.text(transform(input.content.text), { userMessage });
    },
  };
}

export const caseConvertFeature: PluginFeature = {
  actions: {
    uppercase: createCaseAction((text) => text.toUpperCase(), "Converted to uppercase"),
    lowercase: createCaseAction((text) => text.toLowerCase(), "Converted to lowercase"),
  },
};
