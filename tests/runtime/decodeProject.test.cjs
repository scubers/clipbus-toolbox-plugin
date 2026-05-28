"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "..", "..");

function loadJSON(relativePath) {
  return JSON.parse(fs.readFileSync(path.resolve(projectRoot, relativePath), "utf8"));
}

test("manifest declares the toolbox plugin identity and the decode feature", () => {
  const manifest = loadJSON("manifest.json");
  assert.equal(manifest.plugin.id, "plugin.pasty.toolbox");
  assert.equal(manifest.plugin.title, "Pasty Toolbox");
  assert.equal(manifest.runtime.nodeEntry, "dist/plugin.cjs");
  assert.deepEqual(manifest.permissions, ["setAttachment"]);

  assert.equal(manifest.attachmentRenderers.length, 1);
  assert.equal(manifest.attachmentRenderers[0].id, "decode-renderer");
  assert.equal(manifest.attachmentRenderers[0].attachmentType, "plugin.pasty.toolbox.decode.preview");
  assert.deepEqual(manifest.attachmentRenderers[0].height, { min: 32, max: 480 });
  assert.equal(manifest.attachmentRenderers[0].uiEntry, "renderers/decode-renderer/index.html");

  assert.equal(manifest.detectors.length, 1);
  assert.equal(manifest.detectors[0].id, "decode-detector");
  assert.deepEqual(manifest.detectors[0].supportedInputKinds, ["text"]);
  assert.deepEqual(manifest.detectors[0].attachmentTypes, ["plugin.pasty.toolbox.decode.preview"]);

  assert.equal(manifest.actions.length, 6);
  assert.deepEqual(
    manifest.actions.map((action) => action.id),
    ["uppercase", "lowercase", "camelCase", "pascalCase", "snakeCase", "kebabCase"],
  );
  for (const action of manifest.actions) {
    assert.deepEqual(action.supportedItemTypes, ["text"]);
    assert.equal(action.lifecycle, "auto-run");
    assert.equal(action.uiEntry, undefined);
  }
});

test("package declares toolbox identity and verification scripts", () => {
  const packageJSON = loadJSON("package.json");
  assert.equal(packageJSON.name, "@pasty/toolbox-plugin");
  assert.ok(packageJSON.scripts["build:runtime"]);
  assert.ok(packageJSON.scripts["build:ui"]);
  assert.ok(packageJSON.scripts["verify:build"]);
  assert.ok(packageJSON.scripts.typecheck);
  assert.ok(packageJSON.scripts.lint);
});

test("feature registry merges decode handlers and omits empty slots", () => {
  const { features } = require(path.resolve(projectRoot, "src/features/index.ts"));
  const { mergeFeatures } = require(path.resolve(projectRoot, "src/features/registry.ts"));
  const runtime = mergeFeatures(features);

  assert.ok(runtime.detectors["decode-detector"]);
  assert.ok(runtime.attachmentRenderers["decode-renderer"]);
  assert.ok(runtime.actions.uppercase);
  assert.ok(runtime.actions.lowercase);
  assert.ok(runtime.actions.camelCase);
  assert.ok(runtime.actions.pascalCase);
  assert.ok(runtime.actions.snakeCase);
  assert.ok(runtime.actions.kebabCase);
  assert.equal(runtime.messageHandlers, undefined);

  assert.throws(
    () => mergeFeatures([{ detectors: { dup: {} } }, { detectors: { dup: {} } }]),
    /Duplicate/,
  );
});

test("decode UI uses SDK APIs instead of removed bridge APIs", () => {
  const source = fs.readFileSync(path.resolve(projectRoot, "src/features/decode-renderer/app.vue"), "utf8");
  assert.ok(source.includes("pasty.attachmentRenderer.onHostInvoke.on"));
  assert.ok(source.includes("pasty.attachmentRenderer.setButtons"));
  // Height is driven by the SDK autoFit helper from @pasty/plugin-sdk/dom
  // (replaces the hand-rolled ResizeObserver/MutationObserver + manual
  // pasty.window.setHeight loop used before the template migration). autoFit
  // calls window.setHeight internally.
  assert.ok(source.includes("@pasty/plugin-sdk/dom"));
  assert.ok(source.includes("autoFit("));
  assert.ok(!source.includes("pasty.window.autoFit"));
  assert.ok(!source.includes("pasty.ready"));
  assert.ok(!source.includes("pasty.item.setAttachments"));
  assert.ok(!source.includes("window.webkit.messageHandlers"));
  assert.ok(!source.includes("addEventListener(\"pasty-plugin-"));
});
