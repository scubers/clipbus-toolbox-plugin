"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "..", "..");

function loadRenderer() {
  return require(path.resolve(projectRoot, "src/features/decode-renderer/renderer.ts"));
}

function buildPayloadJson(overrides = {}) {
  const base = {
    kind: "decode_preview",
    version: 1,
    encoding: "base64",
    original: "SGVsbG8sIFdvcmxkIQ==",
    truncated: false,
    decoded: "Hello, World!",
    decodedIsJSON: false,
    jwt: null,
    originalLength: 20,
    decodedLength: 13,
    expanded: false,
  };
  return JSON.stringify({ ...base, ...overrides });
}

test("resolveAttachment returns Copy + toggle-expand for plain Base64", () => {
  const { resolveAttachment } = loadRenderer();
  const out = resolveAttachment({
    attachment: { payloadJson: buildPayloadJson({ encoding: "base64", decodedIsJSON: false }) },
  });
  assert.equal(out.displayName, "Decoded Preview - Base64");
  assert.deepEqual(out.buttons.map((button) => button.id), ["copy-decoded", "toggle-expand"]);
  // Non-JSON decodes keep the plain "Copy" label (no minified/pretty distinction).
  assert.equal(out.buttons.find((button) => button.id === "copy-decoded").title, "Copy");
});

test("resolveAttachment toggle-expand title reflects payload.expanded flag", () => {
  const { resolveAttachment } = loadRenderer();
  const collapsed = resolveAttachment({
    attachment: { payloadJson: buildPayloadJson({ expanded: false }) },
  });
  assert.equal(collapsed.buttons.find((button) => button.id === "toggle-expand").title, "Show More");

  const expanded = resolveAttachment({
    attachment: { payloadJson: buildPayloadJson({ expanded: true }) },
  });
  assert.equal(expanded.buttons.find((button) => button.id === "toggle-expand").title, "Show Less");
});

test("resolveAttachment labels JSON decodes and JWTs as Copy minified + Copy pretty", () => {
  const { resolveAttachment } = loadRenderer();
  const jsonOut = resolveAttachment({
    attachment: { payloadJson: buildPayloadJson({ decoded: '{"a":1}', decodedIsJSON: true }) },
  });
  assert.equal(jsonOut.buttons.find((button) => button.id === "copy-decoded").title, "Copy minified");
  assert.equal(jsonOut.buttons.find((button) => button.id === "copy-json").title, "Copy pretty");

  const jwtOut = resolveAttachment({
    attachment: {
      payloadJson: buildPayloadJson({
        encoding: "jwt",
        decoded: '{"header":{"alg":"HS256"},"payload":{"sub":"a"}}',
        decodedIsJSON: true,
        jwt: { header: { alg: "HS256" }, payload: { sub: "a" } },
      }),
    },
  });
  assert.equal(jwtOut.buttons.find((button) => button.id === "copy-decoded").title, "Copy minified");
  assert.equal(jwtOut.buttons.find((button) => button.id === "copy-json").title, "Copy pretty");
});

test("resolveAttachment hides invalid payloads", () => {
  const { resolveAttachment } = loadRenderer();
  const out = resolveAttachment({ attachment: { payloadJson: "not-json" } });
  assert.equal(out.shouldDisplay, false);
  assert.deepEqual(out.buttons, []);
});

test("createDecodeRenderer exposes only the new resolveAttachment interface", () => {
  const { createDecodeRenderer } = loadRenderer();
  const renderer = createDecodeRenderer();
  assert.equal(typeof renderer.resolveAttachment, "function");
  assert.equal(renderer.invokeOperation, undefined);
});
