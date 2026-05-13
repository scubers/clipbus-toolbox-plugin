const { definePlugin } = require("@pasty/plugin-sdk/runtime");
const { createTemplateDetector } = require("./detectors/templateDetector");
const { createTemplateRenderer } = require("./renderers/templateRenderer");
const { createTemplateExpandedRenderer } = require("./renderers/templateExpandedRenderer");
const {
  createTemplateAutoAction,
  createTemplateAutoActionTextOnly,
  createTemplateAutoActionImageOnly
} = require("./actions/templateAutoAction");
const { createTemplateDraftAction } = require("./actions/templateDraftAction");

module.exports = definePlugin({
  setup() {
    return {
      attachmentRenderers: {
        "template-renderer": createTemplateRenderer(),
        "template-expanded-renderer": createTemplateExpandedRenderer()
      },
      detectors: {
        "template-detector": createTemplateDetector()
      },
      actions: {
        "template-auto-action": createTemplateAutoAction(),
        "template-auto-action-text": createTemplateAutoActionTextOnly(),
        "template-auto-action-image": createTemplateAutoActionImageOnly(),
        "template-draft-action": createTemplateDraftAction()
      }
    };
  }
});
