const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "..", "..");
const manifestPath = path.resolve(projectRoot, "manifest.json");

function loadManifest() {
  return JSON.parse(fs.readFileSync(manifestPath, "utf8"));
}

test("manifest registers template detector, renderer, and actions", () => {
  const manifest = loadManifest();

  assert.equal(manifest.plugin.id, "plugin.template.full");
  assert.equal(manifest.detectors.length, 1);
  assert.equal(manifest.attachmentRenderers.length, 2);
  assert.equal(manifest.actions.length, 4);

  const detector = manifest.detectors.find((entry) => entry.id === "template-detector");
  assert.ok(detector, "expected template-detector to be declared in manifest");
  assert.deepEqual(detector.supportedInputKinds, ["text", "image", "path_reference"]);
  assert.deepEqual(
    detector.attachmentTypes,
    ["plugin.template.full.preview", "plugin.template.full.expanded"]
  );

  const renderer = manifest.attachmentRenderers.find((entry) => entry.id === "template-renderer");
  assert.ok(renderer, "expected template-renderer to be declared in manifest");
  assert.equal(renderer.attachmentType, "plugin.template.full.preview");
  assert.equal(renderer.uiEntry, "renderers/template-renderer/index.html");
  assert.equal(renderer.height, 220);

  const autoAction = manifest.actions.find((entry) => entry.id === "template-auto-action");
  assert.ok(autoAction, "expected template-auto-action to be declared in manifest");
  assert.equal(autoAction.lifecycle, "auto-run");
  assert.deepEqual(autoAction.supportedItemTypes, ["text", "image", "path_reference"]);

  const draftAction = manifest.actions.find((entry) => entry.id === "template-draft-action");
  assert.ok(draftAction, "expected template-draft-action to be declared in manifest");
  assert.equal(draftAction.lifecycle, "draft");
  assert.deepEqual(draftAction.supportedItemTypes, ["text", "image", "path_reference"]);
  assert.equal(draftAction.uiEntry, "actions/template-draft-action/index.html");
});

test("manifest declares expanded renderer with bounded auto-fit height policy", () => {
  const manifest = loadManifest();
  const expanded = manifest.attachmentRenderers.find(
    (entry) => entry.id === "template-expanded-renderer"
  );

  assert.ok(expanded, "expected template-expanded-renderer to be declared in manifest");
  assert.equal(expanded.attachmentType, "plugin.template.full.expanded");
  assert.equal(expanded.uiEntry, "renderers/template-expanded-renderer/index.html");
  assert.deepEqual(expanded.height, { min: 120, max: 480 });
});

test("package declares only the template build dependencies", () => {
  const packageJSON = JSON.parse(
    fs.readFileSync(path.resolve(projectRoot, "package.json"), "utf8")
  );

  assert.equal(packageJSON.name, "@pasty/template-plugin");
  assert.ok(packageJSON.dependencies.vue, "expected vue dependency");
  assert.ok(packageJSON.scripts.dev, "expected local preview dev script");
  assert.ok(packageJSON.scripts["dev:renderer"], "expected renderer preview dev script");
  assert.ok(packageJSON.scripts["dev:action"], "expected action preview dev script");
  assert.equal(packageJSON.dependencies.gridjs, undefined);
  assert.equal(packageJSON.dependencies.luxon, undefined);
  assert.equal(packageJSON.dependencies.yaml, undefined);
});

test("runtime setup registers template handlers", () => {
  const pluginDefinition = require(path.resolve(projectRoot, "src/runtime/index.js"));
  const runtime = pluginDefinition.setup({});

  assert.ok(runtime.detectors["template-detector"], "expected template-detector runtime handler");
  assert.ok(
    runtime.attachmentRenderers["template-renderer"],
    "expected template-renderer runtime handler"
  );
  assert.ok(
    runtime.attachmentRenderers["template-expanded-renderer"],
    "expected template-expanded-renderer runtime handler"
  );
  assert.ok(runtime.actions["template-auto-action"], "expected template-auto-action runtime handler");
  assert.ok(
    runtime.actions["template-auto-action-text"],
    "expected template-auto-action-text runtime handler"
  );
  assert.ok(
    runtime.actions["template-auto-action-image"],
    "expected template-auto-action-image runtime handler"
  );
  assert.ok(
    runtime.actions["template-draft-action"],
    "expected template-draft-action runtime handler"
  );
});

test("manifest declares more actions than free-tier quota to demo plugin-pro gating", () => {
  // Plugin Pro free-tier quota (PluginProjectionQuota.freeDefault) is 3 actions.
  // Declaring 4 ensures PluginsSettingsView shows a 4/3 quota chip and one
  // action is gated when the host is on the free tier — letting plugin
  // developers see commit 7b7bd286's behavior end-to-end.
  const manifest = loadManifest();
  const FREE_TIER_ACTION_QUOTA = 3;
  assert.ok(
    manifest.actions.length > FREE_TIER_ACTION_QUOTA,
    `template manifest should declare more than ${FREE_TIER_ACTION_QUOTA} actions to exercise plugin-pro gating`
  );

  const variantIDs = manifest.actions.map((entry) => entry.id);
  assert.ok(variantIDs.includes("template-auto-action-text"));
  assert.ok(variantIDs.includes("template-auto-action-image"));
});

test("template source files exist in runtime and ui trees", () => {
  const requiredPaths = [
    "src/runtime/shared/templateCapabilityMetadata.js",
    "src/runtime/shared/templateAttachmentPayload.js",
    "src/runtime/detectors/templateDetector.js",
    "src/runtime/renderers/templateRenderer.js",
    "src/runtime/renderers/templateExpandedRenderer.js",
    "src/runtime/actions/templateAutoAction.js",
    "src/runtime/actions/templateDraftAction.js",
    "src/ui/AttachmentTemplateApp.vue",
    "src/ui/ExpandedAttachmentTemplateApp.vue",
    "src/ui/DraftActionTemplateApp.vue",
    "src/ui/preview/PreviewShellApp.vue",
    "src/ui/preview/preview-host/main.js",
    "src/ui/preview/preview-host/index.html",
    "src/ui/preview/scenarios/attachmentScenarios.js",
    "src/ui/preview/scenarios/actionScenarios.js",
    "src/ui/renderers/template-renderer/index.html",
    "src/ui/renderers/template-renderer/main.js",
    "src/ui/renderers/template-expanded-renderer/index.html",
    "src/ui/renderers/template-expanded-renderer/main.js",
    "src/ui/actions/template-draft-action/index.html",
    "src/ui/actions/template-draft-action/main.js"
  ];

  for (const relativePath of requiredPaths) {
    assert.ok(
      fs.existsSync(path.resolve(projectRoot, relativePath)),
      `expected ${relativePath} to exist`
    );
  }
});

test("preview workbench uses resizable host viewport instead of fixed shell sizes", () => {
  const previewShellSource = fs.readFileSync(
    path.resolve(projectRoot, "src/ui/preview/PreviewShellApp.vue"),
    "utf8"
  );

  assert.equal(
    previewShellSource.includes('height: "320px"'),
    false,
    "expected renderer preview height to stop using a fixed 320px shell"
  );
  assert.equal(
    previewShellSource.includes('width: "350px"'),
    false,
    "expected action preview width to stop using a fixed 350px shell"
  );
  assert.equal(
    previewShellSource.includes('height: "250px"'),
    false,
    "expected action preview height to stop using a fixed 250px shell"
  );
  assert.equal(
    previewShellSource.includes("Responsive height 320"),
    false,
    "expected static renderer size label to be removed"
  );
  assert.equal(
    previewShellSource.includes("Fixed size 350 × 250"),
    false,
    "expected static action size label to be removed"
  );
  assert.match(
    previewShellSource,
    /host-frame__viewport|viewportStyle|startResize/,
    "expected preview shell to implement a resizable viewport"
  );
  assert.match(
    previewShellSource,
    /host-frame__chrome|Host resize/,
    "expected resize affordance to be presented as host chrome"
  );
  const viewportStart = previewShellSource.indexOf('<div class="host-frame__viewport"');
  const viewportEnd = previewShellSource.indexOf("</div>", viewportStart);
  const chromeStart = previewShellSource.indexOf('<div class="host-frame__chrome">');
  const handleStart = previewShellSource.indexOf('class="host-frame__resize-handle"');

  assert.notEqual(viewportStart, -1, "expected preview shell viewport markup");
  assert.notEqual(chromeStart, -1, "expected host chrome wrapper markup");
  assert.notEqual(handleStart, -1, "expected resize handle markup");
  assert.ok(
    chromeStart > viewportEnd,
    "expected host chrome to be rendered after the plugin content viewport"
  );
  assert.ok(
    handleStart > chromeStart,
    "expected resize handle to live inside host chrome instead of plugin content"
  );
});

test("template detector emits preview attachment for text input", async () => {
  const { detectTemplateAttachment } = require(path.resolve(
    projectRoot,
    "src/runtime/detectors/templateDetector.js"
  ));

  const artifacts = await detectTemplateAttachment({
    content: {
      kind: "text",
      payload: {
        text: "Template plugin headline\nSecond line\nThird line"
      }
    }
  });

  assert.equal(artifacts.length, 2);
  const compact = artifacts.find(
    (artifact) => artifact.attachmentType === "plugin.template.full.preview"
  );
  assert.ok(compact, "expected compact preview artifact");
  assert.equal(compact.searchProjection.scope, "template_preview");

  const payload = JSON.parse(compact.payloadJson);
  assert.equal(payload.kind, "template_preview");
  assert.equal(payload.contentKind, "text");
  assert.equal(payload.display.typeLabel, "Text");
  assert.equal(payload.display.headline, "Template plugin headline");
  assert.equal(payload.display.facts[0].value, "3");
  assert.equal(payload.display.facts[1].value, "47");
});

test("template detector emits compact payloads for image and path-reference input", async () => {
  const { detectTemplateAttachment } = require(path.resolve(
    projectRoot,
    "src/runtime/detectors/templateDetector.js"
  ));

  const imageArtifacts = await detectTemplateAttachment({
    item: {
      id: "image-item",
      type: "image",
      tags: [],
      sourceAppID: "preview.app"
    },
    content: {
      kind: "image",
      payload: {
        bytes: 11,
        width: 320,
        height: 200,
        format: "png"
      }
    }
  });
  assert.equal(imageArtifacts.length, 2);
  const imageCompact = imageArtifacts.find(
    (artifact) => artifact.attachmentType === "plugin.template.full.preview"
  );
  assert.ok(imageCompact, "expected compact image artifact");
  assert.equal(JSON.parse(imageCompact.payloadJson).display.typeLabel, "Image");

  const pathArtifacts = await detectTemplateAttachment({
    item: {
      id: "path-item",
      type: "path_reference",
      tags: [],
      sourceAppID: "finder"
    },
    content: {
      kind: "path_reference",
      payload: {
        entries: [
          { kind: "file", path: "/tmp/report.txt", displayName: "report.txt" },
          { kind: "folder", path: "/tmp/archive", displayName: "archive" }
        ]
      }
    }
  });
  assert.equal(pathArtifacts.length, 2);
  const pathCompact = pathArtifacts.find(
    (artifact) => artifact.attachmentType === "plugin.template.full.preview"
  );
  assert.ok(pathCompact, "expected compact path artifact");
  assert.equal(JSON.parse(pathCompact.payloadJson).display.typeLabel, "Path");
});

test("template detector emits both compact and expanded artifacts per input", async () => {
  const { detectTemplateAttachment } = require(path.resolve(
    projectRoot,
    "src/runtime/detectors/templateDetector.js"
  ));

  const artifacts = await detectTemplateAttachment({
    item: {
      id: "text-item",
      type: "text",
      tags: ["template-plugin", "expanded-demo"],
      sourceAppID: "com.preview.editor"
    },
    content: {
      kind: "text",
      payload: { text: "Expanded preview demo\nSecond line" }
    }
  });

  assert.equal(artifacts.length, 2);
  const compact = artifacts.find(
    (artifact) => artifact.attachmentType === "plugin.template.full.preview"
  );
  const expanded = artifacts.find(
    (artifact) => artifact.attachmentType === "plugin.template.full.expanded"
  );
  assert.ok(compact, "expected compact artifact");
  assert.ok(expanded, "expected expanded artifact");

  assert.equal(compact.attachmentKey, "primary");
  assert.equal(expanded.attachmentKey, "expanded");

  const expandedPayload = JSON.parse(expanded.payloadJson);
  assert.equal(expandedPayload.kind, "template_expanded");
  assert.equal(expandedPayload.extended.contentKind, "text");
  assert.deepEqual(expandedPayload.extended.tags, ["template-plugin", "expanded-demo"]);
  assert.equal(expanded.searchProjection.scope, "template_expanded");
});

test("template detector manifest and runtime reject legacy pathReference spelling", async () => {
  const manifest = loadManifest();
  const detector = manifest.detectors.find((entry) => entry.id === "template-detector");

  assert.ok(detector, "expected template-detector to be declared in manifest");
  assert.equal(detector.supportedInputKinds.includes("pathReference"), false);

  const { detectTemplateAttachment } = require(path.resolve(
    projectRoot,
    "src/runtime/detectors/templateDetector.js"
  ));

  await assert.rejects(
    () =>
      detectTemplateAttachment({
        item: {
          id: "path-item",
          type: "path_reference",
          tags: [],
          sourceAppID: "finder"
        },
        content: {
          kind: "pathReference",
          payload: {
            entries: [
              { kind: "file", path: "/tmp/report.txt", displayName: "report.txt" }
            ]
          }
        }
      }),
    /path_reference/
  );
});

test("template renderer resolves buttons and copies payload json", async () => {
  const { resolveAttachment, invokeOperation } = require(path.resolve(
    projectRoot,
    "src/runtime/renderers/templateRenderer.js"
  ));

  const payloadJson = JSON.stringify({
    kind: "template_preview",
    version: 2,
    contentKind: "text",
    display: {
      typeLabel: "Text",
      headline: "Template plugin headline",
      subheadline: "Second line",
      facts: [
        { label: "Lines", value: "2" },
        { label: "Chars", value: "36" }
      ]
    }
  });
  const attachment = { payloadJson };
  const resolved = resolveAttachment({ attachment });

  assert.equal(resolved.displayName, "Template Preview · Template plugin headline");
  assert.deepEqual(
    resolved.buttons.map((entry) => entry.id),
    ["copy-payload-json", "copy-renderer-context"]
  );

  let copiedText = null;
  const output = await invokeOperation(
    {
      attachment,
      buttonID: "copy-payload-json"
    },
    {
      host: {
        clipboard: {
          async copyText(value) {
            copiedText = value;
          }
        }
      }
    }
  );

  assert.equal(output.success, true);
  assert.equal(output.userMessage, "Template payload copied");
  assert.match(copiedText, /"kind": "template_preview"/);
});

test("template draft action applies tags and pin state", async () => {
  const { createTemplateDraftAction } = require(path.resolve(
    projectRoot,
    "src/runtime/actions/templateDraftAction.js"
  ));

  const action = createTemplateDraftAction();
  const session = await action.resolveSession({
    item: {
      tags: ["existing"]
    },
    content: {
      kind: "text",
      payload: { text: "Draft action example" }
    }
  });

  assert.deepEqual(
    session.buttons.map((entry) => entry.id),
    ["copy-item-json", "copy-session-json", "copy-draft-json", "apply-metadata"]
  );
  assert.equal(session.initialDraft.templateTag, "template-plugin");

  let appliedTags = null;
  let pinnedValue = null;

  const result = await action.invokeOperation(
    {
      item: {
        tags: ["existing"]
      },
      content: {
        kind: "text",
        payload: { text: "Draft action example" }
      },
      draft: {
        templateTag: "release-note",
        shouldPin: true
      },
      buttonID: "apply-metadata"
    },
    {
      host: {
        capabilities: {
          canSetTags: true,
          canSetPinned: true
        },
        item: {
          async setTags(nextTags) {
            appliedTags = nextTags;
          },
          async setPinned(nextPinned) {
            pinnedValue = nextPinned;
          }
        }
      }
    }
  );

  assert.equal(result.result.resultKind, "none");
  assert.equal(result.userMessage, "Template metadata applied and pinned");
  assert.deepEqual(appliedTags, ["existing", "template-plugin", "release-note"]);
  assert.equal(pinnedValue, true);
});

test("template draft action reads optional external settings label with fallback", async () => {
  const { createTemplateDraftAction } = require(path.resolve(
    projectRoot,
    "src/runtime/actions/templateDraftAction.js"
  ));

  const action = createTemplateDraftAction();
  const configured = await action.resolveSession(
    {
      item: {
        tags: []
      },
      content: {
        kind: "text",
        payload: { text: "Draft action example" }
      }
    },
    {
      host: {
        settings: {
          async get(key) {
            assert.equal(key, "plugin.template.full.label");
            return "Configured Template Label";
          }
        }
      }
    }
  );

  assert.equal(configured.displayName, "Configured Template Label");

  const fallback = await action.resolveSession(
    {
      item: {
        tags: []
      },
      content: {
        kind: "text",
        payload: { text: "Draft action example" }
      }
    },
    {
      host: {}
    }
  );

  assert.equal(fallback.displayName, "Template Draft Action");
});

test("expanded renderer resolves buttons and copies debug snapshot", async () => {
  const { resolveAttachment, invokeOperation } = require(path.resolve(
    projectRoot,
    "src/runtime/renderers/templateExpandedRenderer.js"
  ));

  const expandedPayload = {
    kind: "template_expanded",
    version: 1,
    contentKind: "text",
    display: {
      typeLabel: "Text",
      headline: "Expanded headline",
      subheadline: "Expanded subheadline",
      facts: [
        { label: "Lines", value: "2" },
        { label: "Chars", value: "36" }
      ]
    },
    extended: {
      contentKind: "text",
      sourceAppID: "preview.app",
      tags: ["template-plugin"],
      text: "Expanded headline\nExpanded subheadline"
    },
    debug: { item: null, content: null }
  };
  const attachment = { payloadJson: JSON.stringify(expandedPayload) };

  const resolved = resolveAttachment({ attachment });
  assert.equal(resolved.displayName, "Template Expanded · Expanded headline");
  assert.equal(resolved.tintHex, "#2563EB");
  assert.deepEqual(
    resolved.buttons.map((entry) => entry.id),
    ["toggle-debug", "copy-debug-json"]
  );

  let copiedText = null;
  const copyResult = await invokeOperation(
    { attachment, buttonID: "copy-debug-json" },
    {
      host: {
        clipboard: {
          async copyText(value) {
            copiedText = value;
          }
        }
      }
    }
  );
  assert.equal(copyResult.success, true);
  assert.match(copiedText, /"template_expanded"/);
  assert.match(copiedText, /"extended"/);

  const toggleResult = await invokeOperation(
    { attachment, buttonID: "toggle-debug" },
    { host: { clipboard: { async copyText() {} } } }
  );
  assert.equal(toggleResult.success, true);
});

test("expanded renderer Vue uses attachAutoFit bounds matching manifest height", () => {
  const manifest = loadManifest();
  const expanded = manifest.attachmentRenderers.find(
    (entry) => entry.id === "template-expanded-renderer"
  );
  assert.ok(expanded, "expected expanded renderer in manifest");

  const vueSource = fs.readFileSync(
    path.resolve(projectRoot, "src/ui/ExpandedAttachmentTemplateApp.vue"),
    "utf8"
  );

  const minMatch = vueSource.match(/autoFit\(\s*\{[^}]*min:\s*(\d+)/);
  const maxMatch = vueSource.match(/autoFit\(\s*\{[^}]*max:\s*(\d+)/);
  assert.ok(minMatch && maxMatch, "expected autoFit({ min, max }) call");
  assert.equal(Number(minMatch[1]), expanded.height.min);
  assert.equal(Number(maxMatch[1]), expanded.height.max);
});

test("attachment / draft / expanded Vue files use pasty CSS tokens instead of raw hex", () => {
  const filesToScan = [
    "src/ui/AttachmentTemplateApp.vue",
    "src/ui/DraftActionTemplateApp.vue",
    "src/ui/ExpandedAttachmentTemplateApp.vue"
  ];

  // CSS color values that previously appeared in plain rules. They are allowed
  // when wrapped inside var(--pasty-..., #hex) as fallbacks, or inside box-shadow
  // rgba() calls (alpha-transparent shadow tints not covered by 12 tokens).
  const guardedHexes = [
    "#0f172a",
    "#475569",
    "#334155",
    "#64748b",
    "#f8fafc",
    "#f1f5f9",
    "#e2e8f0"
  ];

  function stripStringContent(source) {
    return source.replace(/\/\*[\s\S]*?\*\//g, "");
  }

  function extractScopedStyle(source) {
    const match = source.match(/<style scoped>([\s\S]*?)<\/style>/i);
    return match ? match[1] : "";
  }

  for (const relativePath of filesToScan) {
    const source = fs.readFileSync(path.resolve(projectRoot, relativePath), "utf8");
    const styleBlock = stripStringContent(extractScopedStyle(source));
    assert.ok(styleBlock.length > 0, `expected <style scoped> in ${relativePath}`);

    for (const hex of guardedHexes) {
      const lowercaseStyle = styleBlock.toLowerCase();
      let cursor = 0;
      while ((cursor = lowercaseStyle.indexOf(hex, cursor)) !== -1) {
        const contextStart = Math.max(0, cursor - 80);
        const context = lowercaseStyle.slice(contextStart, cursor);
        const lastVar = context.lastIndexOf("var(--pasty-");
        const lastClose = context.lastIndexOf(")");
        const insideVar = lastVar !== -1 && lastVar > lastClose;
        assert.ok(
          insideVar,
          `${relativePath}: hardcoded ${hex} must appear only as var(--pasty-..., ${hex}) fallback`
        );
        cursor += hex.length;
      }
    }
  }
});

test("template auto action returns copyable metadata for non-text items", async () => {
  const { createTemplateAutoAction } = require(path.resolve(
    projectRoot,
    "src/runtime/actions/templateAutoAction.js"
  ));

  const action = createTemplateAutoAction();
  const result = await action.invokeOperation(
    {
      item: {
        id: "image-item",
        type: "image",
        tags: ["asset"],
        sourceAppID: "preview.app"
      },
      content: {
        kind: "image",
        payload: { bytes: 0, width: 0, height: 0, format: "png" }
      },
      draft: {},
      buttonID: null,
      triggerSource: "autoRun"
    },
    {
      request: { id: "request-1" },
      plugin: { id: "plugin.template.full" },
      capability: { id: "template-auto-action" },
      host: { capabilities: {} }
    }
  );

  assert.equal(result.result.resultKind, "text");
  assert.match(result.result.text, /Template Auto Action/);
  assert.match(result.result.text, /Image: Image item/);
  assert.match(result.result.text, /"triggerSource": "autoRun"/);
});

test("no dataBase64 references in plugin runtime source files", () => {
  const srcDir = path.resolve(projectRoot, "src/runtime");
  // Only scan src/runtime — exclude test files which may reference the pattern in guardrail code
  const thisFile = __filename;

  function scanDir(dir) {
    if (!fs.existsSync(dir)) return [];
    const results = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        results.push(...scanDir(fullPath));
      } else if (/\.(js|ts|cjs|mjs)$/.test(entry.name)) {
        results.push(fullPath);
      }
    }
    return results;
  }

  const allFiles = scanDir(srcDir).filter((f) => f !== thisFile);
  const violations = [];

  for (const filePath of allFiles) {
    const source = fs.readFileSync(filePath, "utf8");
    const lines = source.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.includes("dataBase64")) {
        violations.push(`${filePath}:${i + 1}: ${line.trim()}`);
      }
    }
  }

  assert.deepEqual(
    violations,
    [],
    `Found forbidden 'dataBase64' references in plugin source:\n${violations.join("\n")}`
  );
});
