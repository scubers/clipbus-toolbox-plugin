"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "..", "..");

function loadHighlight() {
  return require(path.resolve(projectRoot, "src/shared/jsonHighlight.ts"));
}

// The decode renderer binds highlightJson()/escapeHtml() output via v-html on
// arbitrary clipboard-derived text. These tests lock the HTML-escaping invariant
// so a future tokenizer change can't silently open an XSS hole.

test("highlightJson escapes HTML in JSON string values", () => {
  const { highlightJson } = loadHighlight();
  const out = highlightJson('{"x":"<img src=x onerror=alert(1)>"}');
  assert.ok(!out.includes("<img"), "raw <img must not survive");
  assert.ok(!out.includes("onerror=alert(1)>"), "the unescaped closing > must not survive");
  assert.ok(out.includes("&lt;img"), "tag must be HTML-escaped");
});

test("highlightJson escapes HTML in JSON keys", () => {
  const { highlightJson } = loadHighlight();
  const out = highlightJson('{"<svg/onload=alert(1)>":1}');
  assert.ok(!out.includes("<svg"), "raw <svg must not survive in keys");
  assert.ok(out.includes("&lt;svg"), "key tag must be HTML-escaped");
});

test("highlightJson escapes non-JSON input via the fallback path", () => {
  const { highlightJson } = loadHighlight();
  const out = highlightJson("<script>alert(1)</script>");
  assert.ok(!out.includes("<script>"), "raw <script> must not survive");
  assert.ok(out.includes("&lt;script&gt;"), "must be HTML-escaped");
});

test("highlightJson wraps recognised tokens in jh-* spans", () => {
  const { highlightJson } = loadHighlight();
  const out = highlightJson('{"a":1}');
  assert.ok(out.includes('<span class="jh-key">'), "keys get a jh-key span");
  assert.ok(out.includes('<span class="jh-number">'), "numbers get a jh-number span");
});
