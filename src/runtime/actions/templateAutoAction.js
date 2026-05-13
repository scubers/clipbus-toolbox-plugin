const { actionResult } = require("@pasty/plugin-sdk/runtime");
const {
  buildActionExecutionSnapshot,
  buildItemDisplay,
  formatTemplateDebugJSON
} = require("../shared/templateCapabilityMetadata");

function summarizeExecution(displayName, input, ctx) {
  const display = buildItemDisplay(input?.item, input?.content);
  const snapshot = buildActionExecutionSnapshot(input, ctx);
  return [
    displayName,
    `${display.typeLabel}: ${display.headline}`,
    display.subheadline,
    "",
    formatTemplateDebugJSON(snapshot)
  ].join("\n").trim();
}

function createAutoActionVariant({ displayName, userMessage }) {
  return {
    async resolveSession() {
      return {
        displayName,
        buttons: [],
        defaultButtonID: null,
        initialDraft: {}
      };
    },

    async invokeOperation(input, ctx) {
      return actionResult.text(summarizeExecution(displayName, input, ctx), {
        userMessage
      });
    }
  };
}

function createTemplateAutoAction() {
  return createAutoActionVariant({
    displayName: "Template Auto Action",
    userMessage: "Template action context ready"
  });
}

// Plugin Pro quota demo: paired with templateAutoActionTextOnly /
// templateAutoActionImageOnly, the manifest declares 4 actions in total. On
// free-tier hosts the action quota is 3, so PluginsSettingsView shows a 4/3
// chip and one action becomes gated — exercising the gating from commit
// 7b7bd286 ("Implement plugin pro quota gating").
function createTemplateAutoActionTextOnly() {
  return createAutoActionVariant({
    displayName: "Template Auto Action (Text)",
    userMessage: "Template text-only action context ready"
  });
}

function createTemplateAutoActionImageOnly() {
  return {
    async resolveSession() {
      return {
        displayName: "Template Auto Action (Image)",
        buttons: [],
        defaultButtonID: null,
        initialDraft: {}
      };
    },

    async invokeOperation(input, ctx) {
      const display = buildItemDisplay(input?.item, input?.content);
      const snapshot = buildActionExecutionSnapshot(input, ctx);

      let imagePath = null;
      try {
        imagePath = await ctx?.host?.item?.materializeImagePath?.();
      } catch {
        // host may not support verb — degrade gracefully
      }

      const lines = [
        "Template Auto Action (Image)",
        `${display.typeLabel}: ${display.headline}`,
        display.subheadline
      ];

      if (imagePath) {
        lines.push(`Image path: ${imagePath}`);
      }

      lines.push("", formatTemplateDebugJSON(snapshot));

      return actionResult.text(lines.join("\n").trim(), {
        userMessage: "Template image-only action context ready"
      });
    }
  };
}

module.exports = {
  createTemplateAutoAction,
  createTemplateAutoActionTextOnly,
  createTemplateAutoActionImageOnly
};
