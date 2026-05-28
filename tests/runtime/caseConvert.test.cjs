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

test("camelCase action converts text to camelCase", async () => {
  const out = await caseConvertFeature.actions.camelCase.runAutoAction(textInput("Hello world FOO"));
  assert.equal(out.result.resultKind, "text");
  assert.equal(out.result.text, "helloWorldFoo");
  assert.equal(out.userMessage, "Converted to camelCase");
});

test("pascalCase action converts text to PascalCase", async () => {
  const out = await caseConvertFeature.actions.pascalCase.runAutoAction(textInput("hello world"));
  assert.equal(out.result.text, "HelloWorld");
  assert.equal(out.userMessage, "Converted to PascalCase");
});

test("snakeCase action converts text to snake_case", async () => {
  const out = await caseConvertFeature.actions.snakeCase.runAutoAction(textInput("Hello World"));
  assert.equal(out.result.text, "hello_world");
  assert.equal(out.userMessage, "Converted to snake_case");
});

test("kebabCase action converts text to kebab-case", async () => {
  const out = await caseConvertFeature.actions.kebabCase.runAutoAction(textInput("Hello World"));
  assert.equal(out.result.text, "hello-world");
  assert.equal(out.userMessage, "Converted to kebab-case");
});

test("style conversions recognise separators, camelCase, and acronym runs", async () => {
  const snake = await caseConvertFeature.actions.snakeCase.runAutoAction(textInput("getHTTPResponseCode"));
  assert.equal(snake.result.text, "get_http_response_code");

  const kebab = await caseConvertFeature.actions.kebabCase.runAutoAction(textInput("foo_bar-baz"));
  assert.equal(kebab.result.text, "foo-bar-baz");

  const camel = await caseConvertFeature.actions.camelCase.runAutoAction(textInput("PascalToCamel"));
  assert.equal(camel.result.text, "pascalToCamel");
});

test("case actions emit no result for non-text content", async () => {
  const out = await caseConvertFeature.actions.uppercase.runAutoAction(imageInput());
  assert.equal(out.result.resultKind, "none");
});

test("auto-run actions expose an empty resolve session", async () => {
  const session = await caseConvertFeature.actions.lowercase.resolveSession();
  assert.deepEqual(session, { buttons: [], initialDraft: {} });
});
