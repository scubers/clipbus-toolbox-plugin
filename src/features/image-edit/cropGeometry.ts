// Pure crop-box geometry. No DOM, no SDK — every function is a deterministic
// transform so the interaction logic can be unit-tested without a browser.
// The crop box lives in DISPLAY pixels (relative to the rendered <img>); the
// emitted CropRect is in ORIGINAL image pixels.

import type { CropRect } from "./contracts.ts";

/** Crop box in display (rendered <img>) pixels. */
export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** "move" drags the whole box; the rest drag an edge/corner. */
export type DragMode = "move" | "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";

/** Clamp a box to stay within [0,boundsW]×[0,boundsH] with each side ≥ minSize. */
export function clampBox(box: Box, boundsW: number, boundsH: number, minSize: number): Box {
  const width = Math.min(Math.max(minSize, box.width), boundsW);
  const height = Math.min(Math.max(minSize, box.height), boundsH);
  const x = Math.min(Math.max(0, box.x), boundsW - width);
  const y = Math.min(Math.max(0, box.y), boundsH - height);
  return { x, y, width, height };
}

/**
 * Apply a pointer drag (move or edge/corner resize) to a starting box and
 * return the new box, clamped to the image bounds with sides ≥ minSize. dx/dy
 * are display-pixel deltas from where the drag started.
 */
export function applyDrag(
  start: Box,
  mode: DragMode,
  dx: number,
  dy: number,
  boundsW: number,
  boundsH: number,
  minSize: number,
): Box {
  if (mode === "move") {
    return clampBox(
      { x: start.x + dx, y: start.y + dy, width: start.width, height: start.height },
      boundsW,
      boundsH,
      minSize,
    );
  }

  let left = start.x;
  let top = start.y;
  let right = start.x + start.width;
  let bottom = start.y + start.height;

  if (mode.includes("w")) left = start.x + dx;
  if (mode.includes("e")) right = start.x + start.width + dx;
  if (mode.includes("n")) top = start.y + dy;
  if (mode.includes("s")) bottom = start.y + start.height + dy;

  // Clamp dragged edges to the image bounds.
  left = Math.max(0, left);
  top = Math.max(0, top);
  right = Math.min(boundsW, right);
  bottom = Math.min(boundsH, bottom);

  // Enforce min size by pushing the DRAGGED edge back, leaving the anchor fixed.
  if (right - left < minSize) {
    if (mode.includes("w")) left = right - minSize;
    else right = left + minSize;
  }
  if (bottom - top < minSize) {
    if (mode.includes("n")) top = bottom - minSize;
    else bottom = top + minSize;
  }

  // Final safety clamp in case the min-size push crossed a bound.
  left = Math.max(0, left);
  top = Math.max(0, top);
  right = Math.min(boundsW, right);
  bottom = Math.min(boundsH, bottom);

  return { x: left, y: top, width: right - left, height: bottom - top };
}

/**
 * Convert a display-pixel box to an ORIGINAL-pixel crop rect. The displayed
 * preview may be any size; only the displayWidth↔origWidth ratio matters, so a
 * downscaled preview still yields exact original-pixel coordinates.
 */
export function displayBoxToCrop(box: Box, displayWidth: number, origWidth: number): CropRect {
  const scale = displayWidth > 0 ? origWidth / displayWidth : 1; // original px per display px
  const toOrig = (v: number): number => Math.round(v * scale);
  return {
    x: toOrig(box.x),
    y: toOrig(box.y),
    width: toOrig(box.width),
    height: toOrig(box.height),
  };
}

/** Human-readable aspect ratio: simplified `a:b` when tidy, else 2-dp decimal. */
export function aspectRatioLabel(width: number, height: number): string {
  if (!(width >= 1) || !(height >= 1)) return "—";
  const w = Math.round(width);
  const h = Math.round(height);
  const g = gcd(w, h);
  const a = w / g;
  const b = h / g;
  if (a <= 64 && b <= 64) return `${a}:${b}`;
  return (width / height).toFixed(2);
}

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}
