// Pasty - Copyright (c) 2026. MIT License.
// Regression guard: input envelope migration (plugin-input-shape change).
// Verifies detector / action contracts no longer rely on dataBase64 or item.text.

"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");

const projectRoot = path.resolve(__dirname, "..", "..");

// ─── (a) image detector: no dataBase64 in input, no base64 in artifacts ──────

test("(a) detector accepts image input without dataBase64 and emits clean artifacts", async () => {
  const { detectTemplateAttachment } = require(path.resolve(
    projectRoot,
    "src/runtime/detectors/templateDetector.js"
  ));

  const artifacts = await detectTemplateAttachment({
    item: { id: "img-1", type: "image", tags: [], sourceAppID: "test.app" },
    content: {
      kind: "image",
      payload: { bytes: 2048, width: 640, height: 480, format: "png" }
    },
    attachments: []
  });

  assert.ok(artifacts.length > 0, "expected at least one artifact from image input");

  for (const artifact of artifacts) {
    assert.ok(
      !artifact.payloadJson.includes("dataBase64"),
      `artifact payloadJson must not contain 'dataBase64': ${artifact.attachmentType}`
    );

    const payload = JSON.parse(artifact.payloadJson);

    // debug.content must not carry base64-encoded data (long alphanum-only runs)
    if (payload.debug?.content !== undefined) {
      const debugContentStr = JSON.stringify(payload.debug.content);
      assert.ok(
        !/[A-Za-z0-9+/]{80,}/.test(debugContentStr),
        `debug.content must not contain base64 data in ${artifact.attachmentType}: ${debugContentStr.slice(0, 120)}`
      );
    }
  }
});

// ─── (b) image-only action calls materializeImagePath via mock host ───────────

test("(b) image-only action calls materializeImagePath and path is valid", async () => {
  const { createTemplateAutoActionImageOnly } = require(path.resolve(
    projectRoot,
    "src/runtime/actions/templateAutoAction.js"
  ));

  const imageBytes = 512;
  const tmpFile = path.join(os.tmpdir(), `pasty-test-img-${Date.now()}.png`);
  fs.writeFileSync(tmpFile, Buffer.alloc(imageBytes, 0xab));

  try {
    const action = createTemplateAutoActionImageOnly();
    const input = {
      item: { id: "img-1", type: "image", tags: [], sourceAppID: "test" },
      content: { kind: "image", payload: { bytes: imageBytes, width: 100, height: 100, format: "png" } },
      attachments: [],
      actionID: "template-auto-action-image",
      draft: {},
      trigger: { kind: "auto" }
    };

    let materializeCallCount = 0;
    const mockHost = {
      item: {
        materializeImagePath: async () => {
          materializeCallCount++;
          return tmpFile;
        }
      }
    };

    const result = await action.invokeOperation(input, { host: mockHost });

    assert.equal(result.result?.resultKind, "text", "expected text result kind");
    assert.equal(materializeCallCount, 1, "expected materializeImagePath to be called exactly once");
    assert.ok(
      result.result?.text?.includes(tmpFile),
      "action output must include the materialized image path"
    );

    // Byte check: the file at the materialized path has the expected size
    const stat = fs.statSync(tmpFile);
    assert.equal(
      stat.size,
      input.content.payload.bytes,
      "materialized image file size must match input.content.payload.bytes"
    );
  } finally {
    fs.rmSync(tmpFile, { force: true });
  }
});

// ─── (d) legacy old-shape input (no envelope) falls back to generic headline ──

test("(d) legacy old-shape input without content envelope uses generic headline, not item.text", async () => {
  const { detectTemplateAttachment } = require(path.resolve(
    projectRoot,
    "src/runtime/detectors/templateDetector.js"
  ));

  // Old shape: item.text at top level, no content envelope.
  // mapContentKind(undefined) → "text"; buildTextDisplay(undefined) → headline =
  // "Text clipboard item". The detector must NOT read item.text — it has been
  // removed in favor of content.payload.text.
  const artifacts = await detectTemplateAttachment({
    item: { id: "txt-1", type: "text", tags: [], sourceAppID: "test.app", text: "hi" }
    // no `content` field — old callers omitted it entirely
  });

  // Must produce at least one artifact (the fallback path still generates a display).
  assert.ok(artifacts.length > 0, "expected fallback artifacts even with no content envelope");

  for (const artifact of artifacts) {
    const payload = JSON.parse(artifact.payloadJson);
    // Headline must be the text-fallback sentinel, NOT the item.text value "hi".
    // If someone re-introduces an item.text shortcut this assertion will catch it.
    assert.equal(
      payload.display?.headline,
      "Text clipboard item",
      "headline must be the generic fallback, not derived from item.text"
    );
  }
});

// ─── (e) unknown content kind silently maps to text (gap documented) ──────────

// SKIP: the assertion here cannot be made meaningful without deciding whether
// unknown content kinds should be (a) rejected with an error / empty artifacts,
// or (b) silently mapped to "text" and documented as such.
//
// Current production behavior (mapContentKind in templateCapabilityMetadata.js):
//   mapContentKind("video") → "text"  (falls through the if-chain)
//
// The previous assertion (`payload.contentKind !== "video"`) was tautological:
// when artifacts is [] (e.g. after a hardened reject path), the for-loop body
// never runs and the assertion trivially passes. It would not catch the gap
// getting worse.
//
// When the gap is closed, replace this with one of:
//   - assert.rejects(...) if mapContentKind is hardened to throw on unknown kinds
//   - assert.equal(artifacts.length, 0, "unknown kind must produce no artifacts")
//   - assert.equal(artifacts[0].contentKind, "text", "unknown kind maps to text")
//     + assert.ok(artifacts.length > 0, "fallback artifacts must be produced")
//
// TODO: decide and implement the policy for unknown content kinds.
test.skip("(e) unknown content kind 'video' handling — gap not yet closed", async () => {
  const { detectTemplateAttachment } = require(path.resolve(
    projectRoot,
    "src/runtime/detectors/templateDetector.js"
  ));

  const artifacts = await detectTemplateAttachment({
    item: { id: "vid-1", type: "text", tags: [], sourceAppID: "test.app" },
    content: { kind: "video", payload: { url: "https://example.com/clip.mp4" } },
    attachments: []
  });

  // Placeholder — update when unknown-kind policy is decided.
  assert.fail("test body not yet implemented — see TODO above");
});

// ─── (f) empty/missing content produces generic-fallback artifacts ────────────

test("(f) empty or missing content field falls back to generic text display", async () => {
  const { detectTemplateAttachment } = require(path.resolve(
    projectRoot,
    "src/runtime/detectors/templateDetector.js"
  ));

  // content: {} — mapContentKind(undefined) → "text"; buildTextDisplay(undefined) →
  // headline = "Text clipboard item". Artifacts ARE produced.
  // content: missing — same code path, same result.
  //
  // These assertions are meaningful: they fail if:
  //   - the detector starts throwing on empty/missing content (length check fails)
  //   - the fallback headline changes (regression in buildTextDisplay)
  //   - dataBase64 leaks into the artifact (regression in sanitizeContentForDebug)
  const artifactsEmpty = await detectTemplateAttachment({
    item: { id: "empty-1", type: "text", tags: [], sourceAppID: "test.app" },
    content: {},
    attachments: []
  });

  const artifactsNoContent = await detectTemplateAttachment({
    item: { id: "empty-2", type: "text", tags: [], sourceAppID: "test.app" },
    attachments: []
  });

  for (const [label, artifacts] of [["content: {}", artifactsEmpty], ["no content field", artifactsNoContent]]) {
    assert.ok(artifacts.length > 0, `${label}: expected at least one artifact from fallback path`);

    for (const artifact of artifacts) {
      const payload = JSON.parse(artifact.payloadJson);
      assert.equal(
        payload.display?.headline,
        "Text clipboard item",
        `${label}: headline must be the generic text fallback`
      );
      assert.ok(
        !artifact.payloadJson.includes("dataBase64"),
        `${label}: artifact must not contain dataBase64`
      );
    }
  }
});

// ─── (c) grep guard: no source reads input.item.text ─────────────────────────

test("(c) no detector or action source reads input.item.text", () => {
  const srcDirs = [
    path.resolve(projectRoot, "src/runtime/detectors"),
    path.resolve(projectRoot, "src/runtime/actions"),
    path.resolve(projectRoot, "src/runtime/shared")
  ];

  const banned = ["input.item.text", "input?.item?.text"];

  for (const dir of srcDirs) {
    const files = fs.readdirSync(dir).filter(f => f.endsWith(".js"));
    for (const file of files) {
      const content = fs.readFileSync(path.join(dir, file), "utf8");
      for (const pattern of banned) {
        assert.ok(
          !content.includes(pattern),
          `${path.relative(projectRoot, path.join(dir, file))} must not reference '${pattern}' — use input.content.payload.text instead`
        );
      }
    }
  }
});
