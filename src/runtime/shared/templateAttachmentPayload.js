const {
  buildContentDisplay,
  buildSearchText,
  cloneJSON,
  estimateBase64Bytes,
  mapContentKind,
  safeArray,
  truncateText
} = require("./templateCapabilityMetadata");

function buildTemplateAttachmentKey(payload) {
  const slug = String(payload?.display?.headline || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return `template-preview-${slug || "item"}`;
}

function sanitizeContentForDebug(content) {
  return cloneJSON(content);
}

function createTemplateAttachmentPayload(input) {
  const contentKind = mapContentKind(input?.content?.kind);
  const contentPayload = input?.content?.payload ?? null;
  const display = buildContentDisplay(contentKind, contentPayload);
  if (!display?.headline) {
    return null;
  }

  return {
    kind: "template_preview",
    version: 2,
    contentKind,
    display,
    debug: {
      item: cloneJSON(input?.item),
      content: sanitizeContentForDebug(input?.content)
    }
  };
}

function decodeTemplateAttachmentPayload(payloadJson) {
  try {
    const parsed = JSON.parse(payloadJson || "{}");
    if (
      parsed.kind !== "template_preview" ||
      typeof parsed.contentKind !== "string" ||
      typeof parsed.display !== "object" ||
      parsed.display === null
    ) {
      return null;
    }

    return {
      kind: "template_preview",
      version: Number(parsed.version) || 1,
      contentKind: parsed.contentKind,
      display: {
        typeLabel: String(parsed.display.typeLabel || ""),
        headline: String(parsed.display.headline || ""),
        subheadline: String(parsed.display.subheadline || ""),
        facts: Array.isArray(parsed.display.facts)
          ? parsed.display.facts.map((fact) => ({
              label: String(fact?.label || ""),
              value: String(fact?.value || "")
            }))
          : []
      },
      debug: typeof parsed.debug === "object" && parsed.debug !== null
        ? parsed.debug
        : {
            item: null,
            content: null
          }
    };
  } catch {
    return null;
  }
}

function formatTemplateAttachmentPayload(payload) {
  return JSON.stringify(payload, null, 2);
}

function buildTemplateSearchProjection(payload) {
  const searchText = buildSearchText(payload);
  if (!searchText.trim()) {
    return null;
  }

  return {
    scope: "template_preview",
    searchText,
    label: payload?.display?.typeLabel || "Template"
  };
}

function buildExtendedExtras(contentKind, contentPayload, input) {
  const itemTags = safeArray(input?.item?.tags).map((tag) => String(tag));
  const sourceAppID = String(input?.item?.sourceAppID || "");
  const base = {
    contentKind,
    sourceAppID,
    tags: itemTags
  };

  if (contentKind === "text") {
    return {
      ...base,
      text: truncateText(contentPayload?.text || "", 480)
    };
  }
  if (contentKind === "image") {
    return {
      ...base,
      width: Number(contentPayload?.width) || 0,
      height: Number(contentPayload?.height) || 0,
      format: String(contentPayload?.format || ""),
      bytes: Number(contentPayload?.bytes) || 0
    };
  }
  return {
    ...base,
    entries: safeArray(contentPayload?.entries).slice(0, 10).map((entry) => ({
      kind: String(entry?.kind || ""),
      path: String(entry?.path || ""),
      displayName: String(entry?.displayName || entry?.path || "")
    }))
  };
}

function createTemplateExpandedPayload(input) {
  const contentKind = mapContentKind(input?.content?.kind);
  const contentPayload = input?.content?.payload ?? null;
  const display = buildContentDisplay(contentKind, contentPayload);
  if (!display?.headline) {
    return null;
  }

  return {
    kind: "template_expanded",
    version: 1,
    contentKind,
    display,
    extended: buildExtendedExtras(contentKind, contentPayload, input),
    debug: {
      item: cloneJSON(input?.item),
      content: sanitizeContentForDebug(input?.content)
    }
  };
}

function decodeTemplateExpandedPayload(payloadJson) {
  try {
    const parsed = JSON.parse(payloadJson || "{}");
    if (
      parsed.kind !== "template_expanded" ||
      typeof parsed.contentKind !== "string" ||
      typeof parsed.display !== "object" ||
      parsed.display === null
    ) {
      return null;
    }

    return {
      kind: "template_expanded",
      version: Number(parsed.version) || 1,
      contentKind: parsed.contentKind,
      display: {
        typeLabel: String(parsed.display.typeLabel || ""),
        headline: String(parsed.display.headline || ""),
        subheadline: String(parsed.display.subheadline || ""),
        facts: Array.isArray(parsed.display.facts)
          ? parsed.display.facts.map((fact) => ({
              label: String(fact?.label || ""),
              value: String(fact?.value || "")
            }))
          : []
      },
      extended: typeof parsed.extended === "object" && parsed.extended !== null
        ? parsed.extended
        : null,
      debug: typeof parsed.debug === "object" && parsed.debug !== null
        ? parsed.debug
        : { item: null, content: null }
    };
  } catch {
    return null;
  }
}

function buildTemplateExpandedSearchProjection(payload) {
  const searchText = buildSearchText(payload);
  if (!searchText.trim()) {
    return null;
  }

  return {
    scope: "template_expanded",
    searchText,
    label: payload?.display?.typeLabel || "Template (Expanded)"
  };
}

module.exports = {
  buildTemplateSearchProjection,
  buildTemplateExpandedSearchProjection,
  buildTemplateAttachmentKey,
  createTemplateAttachmentPayload,
  createTemplateExpandedPayload,
  decodeTemplateAttachmentPayload,
  decodeTemplateExpandedPayload,
  formatTemplateAttachmentPayload
};
