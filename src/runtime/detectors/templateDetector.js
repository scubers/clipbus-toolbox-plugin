const {
  buildTemplateSearchProjection,
  buildTemplateExpandedSearchProjection,
  createTemplateAttachmentPayload,
  createTemplateExpandedPayload
} = require("../shared/templateAttachmentPayload");

async function detectTemplateAttachment(input) {
  const compactPayload = createTemplateAttachmentPayload(input);
  if (!compactPayload) {
    return [];
  }

  const artifacts = [
    {
      attachmentType: "plugin.template.full.preview",
      attachmentKey: "primary",
      payloadJson: JSON.stringify(compactPayload),
      searchProjection: buildTemplateSearchProjection(compactPayload),
      attachmentSyncScope: "syncable"
    }
  ];

  const expandedPayload = createTemplateExpandedPayload(input);
  if (expandedPayload) {
    artifacts.push({
      attachmentType: "plugin.template.full.expanded",
      attachmentKey: "expanded",
      payloadJson: JSON.stringify(expandedPayload),
      searchProjection: buildTemplateExpandedSearchProjection(expandedPayload),
      attachmentSyncScope: "syncable"
    });
  }

  return artifacts;
}

function createTemplateDetector() {
  return {
    async detect(input) {
      return {
        artifacts: await detectTemplateAttachment(input)
      };
    }
  };
}

module.exports = {
  createTemplateDetector,
  detectTemplateAttachment
};
