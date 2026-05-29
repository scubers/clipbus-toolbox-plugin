"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const os = require("node:os");
const fsp = require("node:fs/promises");
const sharp = require("sharp");

const projectRoot = path.resolve(__dirname, "..", "..");
const proc = require(path.resolve(projectRoot, "src/features/image-edit/process.ts"));

test("normalizeFormat maps known formats and falls back to png", () => {
  assert.equal(proc.normalizeFormat("jpeg"), "jpeg");
  assert.equal(proc.normalizeFormat("JPG"), "jpeg");
  assert.equal(proc.normalizeFormat("png"), "png");
  assert.equal(proc.normalizeFormat("webp"), "webp");
  assert.equal(proc.normalizeFormat("gif"), "png");
  assert.equal(proc.normalizeFormat(undefined), "png");
  assert.equal(proc.normalizeFormat(null), "png");
});

test("clampQuality clamps to 1..100 and defaults non-finite to 80", () => {
  assert.equal(proc.clampQuality(0), 1);
  assert.equal(proc.clampQuality(150), 100);
  assert.equal(proc.clampQuality(70.6), 71);
  assert.equal(proc.clampQuality(Number.NaN), 80);
});

test("clampCropToImage fits the crop inside the image with sides >= 1", () => {
  assert.deepEqual(proc.clampCropToImage({ x: -5, y: -5, width: 10000, height: 10000 }, 100, 80), {
    x: 0,
    y: 0,
    width: 100,
    height: 80,
  });
  const c = proc.clampCropToImage({ x: 90, y: 70, width: 50, height: 50 }, 100, 80);
  assert.ok(c.x + c.width <= 100);
  assert.ok(c.y + c.height <= 80);
  assert.ok(c.width >= 1 && c.height >= 1);
});

test("processImage crops + re-encodes to the host temp path, preserving format", async () => {
  const dir = await fsp.mkdtemp(path.join(os.tmpdir(), "ie-proc-"));
  const srcPath = path.join(dir, "src.png");
  const outPath = path.join(dir, "out.png");
  try {
    // Build a known 100x80 PNG fixture.
    await sharp({
      create: { width: 100, height: 80, channels: 3, background: { r: 200, g: 50, b: 50 } },
    })
      .png()
      .toFile(srcPath);

    const host = {
      item: { materializeImagePath: async () => ({ path: srcPath }) },
      action: { allocateImageTempPath: async () => ({ path: outPath }) },
    };

    const resp = await proc.processImage(host, { quality: 70, crop: { x: 10, y: 5, width: 40, height: 30 } });

    assert.equal(resp.imageTempPath, outPath);
    assert.equal(resp.imageFormatHint, "png");

    const outMeta = await sharp(resp.imageTempPath).metadata();
    assert.equal(outMeta.width, 40);
    assert.equal(outMeta.height, 30);
    assert.equal(outMeta.format, "png");
  } finally {
    await fsp.rm(dir, { recursive: true, force: true });
  }
});

test("processImage clamps an out-of-bounds crop instead of throwing", async () => {
  const dir = await fsp.mkdtemp(path.join(os.tmpdir(), "ie-proc-"));
  const srcPath = path.join(dir, "src.jpg");
  const outPath = path.join(dir, "out.jpg");
  try {
    await sharp({
      create: { width: 60, height: 40, channels: 3, background: { r: 10, g: 120, b: 200 } },
    })
      .jpeg()
      .toFile(srcPath);

    const host = {
      item: { materializeImagePath: async () => ({ path: srcPath }) },
      action: { allocateImageTempPath: async () => ({ path: outPath }) },
    };

    // Crop extends past the image; processImage must clamp it.
    const resp = await proc.processImage(host, { quality: 80, crop: { x: 40, y: 30, width: 999, height: 999 } });
    assert.equal(resp.imageFormatHint, "jpeg");
    const outMeta = await sharp(resp.imageTempPath).metadata();
    assert.ok(outMeta.width >= 1 && outMeta.width <= 60);
    assert.ok(outMeta.height >= 1 && outMeta.height <= 40);
    assert.equal(outMeta.format, "jpeg");
  } finally {
    await fsp.rm(dir, { recursive: true, force: true });
  }
});

test("lower quality produces a smaller JPEG (spec acceptance baseline)", async () => {
  const dir = await fsp.mkdtemp(path.join(os.tmpdir(), "ie-proc-"));
  const srcPath = path.join(dir, "src.jpg");
  const outHigh = path.join(dir, "high.jpg");
  const outLow = path.join(dir, "low.jpg");
  try {
    // Deterministic high-entropy content so JPEG quality clearly affects size.
    const w = 128;
    const h = 128;
    const raw = Buffer.alloc(w * h * 3);
    for (let i = 0; i < raw.length; i++) raw[i] = (i * 37 + ((i * i) % 251)) % 256;
    await sharp(raw, { raw: { width: w, height: h, channels: 3 } }).jpeg({ quality: 100 }).toFile(srcPath);

    let outPath = outHigh;
    const host = {
      item: { materializeImagePath: async () => ({ path: srcPath }) },
      action: { allocateImageTempPath: async () => ({ path: outPath }) },
    };

    await proc.processImage(host, { quality: 90, crop: { x: 0, y: 0, width: w, height: h } });
    outPath = outLow;
    await proc.processImage(host, { quality: 20, crop: { x: 0, y: 0, width: w, height: h } });

    const sizeHigh = (await fsp.stat(outHigh)).size;
    const sizeLow = (await fsp.stat(outLow)).size;
    assert.ok(sizeLow < sizeHigh, `expected low quality (${sizeLow}B) < high quality (${sizeHigh}B)`);
  } finally {
    await fsp.rm(dir, { recursive: true, force: true });
  }
});
