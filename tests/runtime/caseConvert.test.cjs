"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "..", "..");
const { caseConvertFeature } = require(path.resolve(projectRoot, "src/features/case-convert/feature.ts"));

function textInput(text) {
  return {
    item: { id: "1", type: "text", tags: [], sourceAppID: "" },
    content: { kind: "text", text },
    attachments: [],
  };
}

function imageInput() {
  return {
    item: { id: "1", type: "image", tags: [], sourceAppID: "" },
    content: { kind: "image", width: 1, height: 1, format: "png", bytes: 1 },
    attachments: [],
  };
}

test("uppercase action converts text content to upper case", async () => {
  const out = await caseConvertFeature.actions.uppercase.runAutoAction(textInput("Hello, World"));
  assert.equal(out.result.resultKind, "text");
  assert.equal(out.result.text, "HELLO, WORLD");
  assert.equal(out.userMessage, "Converted to uppercase");
});

test("lowercase action converts text content to lower case", async () => {
  const out = await caseConvertFeature.actions.lowercase.runAutoAction(textInput("Hello, World"));
  assert.equal(out.result.resultKind, "text");
  assert.equal(out.result.text, "hello, world");
  assert.equal(out.userMessage, "Converted to lowercase");
});

test("case actions emit no result for non-text content", async () => {
  const out = await caseConvertFeature.actions.uppercase.runAutoAction(imageInput());
  assert.equal(out.result.resultKind, "none");
});

test("auto-run actions expose an empty resolve session", async () => {
  const session = await caseConvertFeature.actions.lowercase.resolveSession();
  assert.deepEqual(session, { buttons: [], initialDraft: {} });
});
