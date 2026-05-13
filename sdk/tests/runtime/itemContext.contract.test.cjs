// Pasty - Copyright (c) 2026. MIT License.
// Contract lock: ItemContext triple present on all five handler input types.
// Reads ctx.d.ts text directly so the test catches type regressions before
// any runtime code is reached.

"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const sdkRoot = path.resolve(__dirname, "..", "..");
const ctxDts = fs.readFileSync(
  path.resolve(sdkRoot, "dist/runtime/types/ctx.d.ts"),
  "utf8"
);

/**
 * Extract the set of top-level field names declared in a TypeScript interface
 * body. Uses balanced-brace scanning so inline `{ ... }` object types don't
 * confuse the boundary detection.
 */
function fieldsOf(dtsText, interfaceName) {
  // Find the opening `interface Name ... {`
  const startRe = new RegExp(`interface ${interfaceName}[^{]*\\{`, "g");
  const startMatch = startRe.exec(dtsText);
  if (!startMatch) return null;

  // Collect the balanced interface body
  let depth = 1;
  let i = startMatch.index + startMatch[0].length;
  const bodyParts = [];
  while (i < dtsText.length && depth > 0) {
    const ch = dtsText[i];
    if (ch === "{") { depth++; bodyParts.push(ch); }
    else if (ch === "}") { depth--; if (depth > 0) bodyParts.push(ch); }
    else { bodyParts.push(ch); }
    i++;
  }
  const body = bodyParts.join("");

  // Extract names that appear at top-level (no surrounding braces)
  const names = new Set();
  const lineRe = /^ {4}(\w+)\??[\s:(]/gm;
  let m;
  while ((m = lineRe.exec(body)) !== null) {
    const before = body.slice(0, m.index);
    const depth0 = (before.match(/\{/g) || []).length === (before.match(/\}/g) || []).length;
    if (depth0) names.add(m[1]);
  }
  return names;
}

// ─── ItemContext itself ───────────────────────────────────────────────────────

test("ItemContext declares exactly {item, content, attachments}", () => {
  const fields = fieldsOf(ctxDts, "ItemContext");
  assert.ok(fields, "ItemContext must be declared in ctx.d.ts");
  assert.deepEqual(
    [...fields].sort(),
    ["attachments", "content", "item"],
    "ItemContext must have exactly item, content, attachments"
  );
});

// ─── Five handler input types must all extend ItemContext ─────────────────────

test("DetectorInput extends ItemContext with no own fields", () => {
  assert.ok(ctxDts.includes("DetectorInput extends ItemContext"), "DetectorInput must extend ItemContext");
  const ownFields = fieldsOf(ctxDts, "DetectorInput");
  assert.ok(ownFields !== null, "DetectorInput must be declared");
  assert.equal(ownFields.size, 0, "DetectorInput must add no own fields beyond ItemContext");
});

test("ResolveAttachmentInput extends ItemContext and adds {attachment, declaredActions}", () => {
  assert.ok(ctxDts.includes("ResolveAttachmentInput extends ItemContext"), "ResolveAttachmentInput must extend ItemContext");
  const fields = fieldsOf(ctxDts, "ResolveAttachmentInput");
  assert.ok(fields, "ResolveAttachmentInput must be declared");
  assert.ok(fields.has("attachment"), "must have attachment");
  assert.ok(fields.has("declaredActions"), "must have declaredActions");
});

test("AttachmentOperationInput extends ItemContext and adds handler fields", () => {
  assert.ok(ctxDts.includes("AttachmentOperationInput extends ItemContext"), "AttachmentOperationInput must extend ItemContext");
  const fields = fieldsOf(ctxDts, "AttachmentOperationInput");
  assert.ok(fields, "AttachmentOperationInput must be declared");
  assert.ok(fields.has("attachment"), "must have attachment");
  assert.ok(fields.has("buttonID"), "must have buttonID");
  assert.ok(fields.has("params"), "must have params");
  assert.ok(fields.has("triggerSource"), "must have triggerSource");
  assert.ok(!fields.has("dataBase64"), "must not expose dataBase64");
});

test("ActionSessionResolveInput extends ItemContext and adds {action}", () => {
  assert.ok(ctxDts.includes("ActionSessionResolveInput extends ItemContext"), "ActionSessionResolveInput must extend ItemContext");
  const fields = fieldsOf(ctxDts, "ActionSessionResolveInput");
  assert.ok(fields, "ActionSessionResolveInput must be declared");
  assert.ok(fields.has("action"), "must have action");
});

test("ActionRunInput extends ItemContext and adds {actionID, draft, buttonID}", () => {
  assert.ok(ctxDts.includes("ActionRunInput extends ItemContext"), "ActionRunInput must extend ItemContext");
  const fields = fieldsOf(ctxDts, "ActionRunInput");
  assert.ok(fields, "ActionRunInput must be declared");
  assert.ok(fields.has("actionID"), "must have actionID");
  assert.ok(fields.has("draft"), "must have draft");
  assert.ok(fields.has("buttonID"), "must have buttonID");
  assert.ok(!fields.has("text"), "ActionRunInput must not carry legacy text field");
});

// ─── HostItem and HostAction verb surface ────────────────────────────────────

test("HostItem declares materializeImagePath and readAttachment", () => {
  const fields = fieldsOf(ctxDts, "HostItem");
  assert.ok(fields, "HostItem must be declared");
  assert.ok(fields.has("materializeImagePath"), "HostItem must declare materializeImagePath");
  assert.ok(fields.has("readAttachment"), "HostItem must declare readAttachment");
});

test("HostAction declares allocateImageTempPath", () => {
  const fields = fieldsOf(ctxDts, "HostAction");
  assert.ok(fields, "HostAction must be declared");
  assert.ok(fields.has("allocateImageTempPath"), "HostAction must declare allocateImageTempPath");
});

// ─── ClipboardItem must not have legacy text field ───────────────────────────

test("ClipboardItem in data.d.ts does not expose text field", () => {
  const dataDts = fs.readFileSync(
    path.resolve(sdkRoot, "dist/runtime/types/data.d.ts"),
    "utf8"
  );
  const fields = fieldsOf(dataDts, "ClipboardItem");
  assert.ok(fields, "ClipboardItem must be declared");
  assert.ok(!fields.has("text"), "ClipboardItem must not expose legacy text field");
});
