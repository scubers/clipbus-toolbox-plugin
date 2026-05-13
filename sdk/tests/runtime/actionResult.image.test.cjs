// Pasty - Copyright (c) 2026. MIT License.
// Contract lock: actionResult.image() shape — resultKind:"image", imageTempPath, imageFormatHint.

"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { actionResult } = require("../../dist/runtime/index.cjs");

describe("actionResult.image", () => {
  it("builds locked shape with required imageTempPath", () => {
    const result = actionResult.image("/tmp/abc.png");
    assert.deepEqual(result, {
      result: { resultKind: "image", imageTempPath: "/tmp/abc.png", imageFormatHint: null },
      userMessage: null,
    });
  });

  it("accepts formatHint option", () => {
    const result = actionResult.image("/tmp/abc.jpeg", { formatHint: "jpeg" });
    assert.equal(result.result.imageFormatHint, "jpeg");
    assert.equal(result.result.resultKind, "image");
  });

  it("accepts userMessage option", () => {
    const result = actionResult.image("/tmp/x.png", { userMessage: "Image copied" });
    assert.equal(result.userMessage, "Image copied");
  });

  it("preserves null userMessage", () => {
    const result = actionResult.image("/tmp/x.png", { userMessage: null });
    assert.equal(result.userMessage, null);
  });

  it("does not include base64 or dataBase64 in output", () => {
    const result = actionResult.image("/tmp/x.png");
    const json = JSON.stringify(result);
    assert.ok(!json.includes("dataBase64"), "must not contain dataBase64");
    assert.ok(!json.includes("base64"), "must not contain base64");
  });

  it("resultKind is image, not text or none", () => {
    const result = actionResult.image("/tmp/x.png");
    assert.equal(result.result.resultKind, "image");
    assert.ok(!("text" in result.result), "must not have text field");
  });
});
