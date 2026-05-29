"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "..", "..");
const geom = require(path.resolve(projectRoot, "src/features/image-edit/cropGeometry.ts"));

test("clampBox keeps the box inside bounds", () => {
  assert.deepEqual(geom.clampBox({ x: -10, y: -10, width: 50, height: 50 }, 100, 100, 8), {
    x: 0,
    y: 0,
    width: 50,
    height: 50,
  });
  assert.deepEqual(geom.clampBox({ x: 90, y: 90, width: 50, height: 50 }, 100, 100, 8), {
    x: 50,
    y: 50,
    width: 50,
    height: 50,
  });
});

test("clampBox enforces minimum size", () => {
  const b = geom.clampBox({ x: 0, y: 0, width: 2, height: 2 }, 100, 100, 8);
  assert.equal(b.width, 8);
  assert.equal(b.height, 8);
});

test("displayBoxToCrop scales display pixels up to original pixels", () => {
  // Original 800px shown at 400px display → scale ×2.
  assert.deepEqual(geom.displayBoxToCrop({ x: 10, y: 20, width: 100, height: 50 }, 400, 800), {
    x: 20,
    y: 40,
    width: 200,
    height: 100,
  });
});

test("displayBoxToCrop is identity when display equals original", () => {
  assert.deepEqual(geom.displayBoxToCrop({ x: 5, y: 6, width: 7, height: 8 }, 300, 300), {
    x: 5,
    y: 6,
    width: 7,
    height: 8,
  });
});

test("applyDrag move keeps size and stays in bounds", () => {
  const b = geom.applyDrag({ x: 10, y: 10, width: 20, height: 20 }, "move", 1000, 1000, 100, 100, 8);
  assert.deepEqual(b, { x: 80, y: 80, width: 20, height: 20 });
});

test("applyDrag east edge grows width, clamped to the bound", () => {
  const b = geom.applyDrag({ x: 0, y: 0, width: 20, height: 20 }, "e", 1000, 0, 100, 100, 8);
  assert.equal(b.width, 100);
  assert.equal(b.x, 0);
});

test("applyDrag west edge respects minimum size anchored at the right edge", () => {
  const b = geom.applyDrag({ x: 0, y: 0, width: 20, height: 20 }, "w", 1000, 0, 100, 100, 8);
  // Right edge stays at 20; left can't pass right - minSize.
  assert.equal(b.width, 8);
  assert.equal(b.x, 12);
});

test("applyDrag corner resizes both axes", () => {
  const b = geom.applyDrag({ x: 10, y: 10, width: 20, height: 20 }, "se", 30, 40, 200, 200, 8);
  assert.equal(b.x, 10);
  assert.equal(b.y, 10);
  assert.equal(b.width, 50);
  assert.equal(b.height, 60);
});

test("applyDrag north edge grows upward, clamped to the top bound", () => {
  const b = geom.applyDrag({ x: 0, y: 20, width: 30, height: 30 }, "n", 0, -1000, 100, 100, 8);
  assert.equal(b.y, 0);
  assert.equal(b.height, 50); // bottom edge (50) stays fixed
});

test("applyDrag south edge respects minimum size anchored at the top", () => {
  const b = geom.applyDrag({ x: 0, y: 0, width: 30, height: 30 }, "s", 0, -1000, 100, 100, 8);
  assert.equal(b.y, 0);
  assert.equal(b.height, 8);
});

test("applyDrag nw corner clamps both edges to the origin", () => {
  const b = geom.applyDrag({ x: 20, y: 20, width: 30, height: 30 }, "nw", -1000, -1000, 100, 100, 8);
  assert.deepEqual(b, { x: 0, y: 0, width: 50, height: 50 });
});

test("aspectRatioLabel returns a dash for degenerate sizes", () => {
  assert.equal(geom.aspectRatioLabel(0.5, 0.5), "—");
  assert.equal(geom.aspectRatioLabel(-1, 10), "—");
  assert.equal(geom.aspectRatioLabel(Number.NaN, 10), "—");
});

test("aspectRatioLabel simplifies tidy ratios, decimal otherwise", () => {
  assert.equal(geom.aspectRatioLabel(800, 600), "4:3");
  assert.equal(geom.aspectRatioLabel(1920, 1080), "16:9");
  assert.equal(geom.aspectRatioLabel(803, 601), (803 / 601).toFixed(2));
  assert.equal(geom.aspectRatioLabel(0, 100), "—");
});
