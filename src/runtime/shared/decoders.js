"use strict";

// ─── JWT ────────────────────────────────────────────────────────────────────

const JWT_REGEX = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]*$/;

function base64UrlDecodeToBuffer(segment) {
  if (typeof segment !== "string") {
    return null;
  }
  // Pad to multiple of 4
  const remainder = segment.length % 4;
  const padded = remainder === 0 ? segment : segment + "=".repeat(4 - remainder);
  try {
    return Buffer.from(padded, "base64url");
  } catch {
    return null;
  }
}

function safeJsonParse(text) {
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch {
    return { ok: false, value: null };
  }
}

function tryDecodeJWT(input) {
  if (typeof input !== "string" || !JWT_REGEX.test(input)) {
    return null;
  }
  const [headerSeg, payloadSeg /* signature segment ignored */] = input.split(".");

  const headerBuf = base64UrlDecodeToBuffer(headerSeg);
  const payloadBuf = base64UrlDecodeToBuffer(payloadSeg);
  if (!headerBuf || !payloadBuf) {
    return null;
  }

  // Spec: third segment must "successfully Base64URL decode" — we verify it.
  const segments = input.split(".");
  if (segments[2] !== undefined && segments[2] !== "") {
    const sigBuf = base64UrlDecodeToBuffer(segments[2]);
    if (!sigBuf) {
      return null;
    }
  }

  let headerText;
  let payloadText;
  try {
    headerText = headerBuf.toString("utf8");
    payloadText = payloadBuf.toString("utf8");
  } catch {
    return null;
  }

  const headerParse = safeJsonParse(headerText);
  if (!headerParse.ok) {
    return null;
  }
  const header = headerParse.value;
  if (header === null || typeof header !== "object" || Array.isArray(header)) {
    return null;
  }
  if (typeof header.alg !== "string" || header.alg.length === 0) {
    return null;
  }

  const payloadParse = safeJsonParse(payloadText);
  // Deviation from spec §4.2.1: the spec only requires the header to be valid
  // JSON, but we additionally require the payload to parse as JSON. Real-world
  // JWTs always carry a JSON payload, and enforcing this lets the produced
  // decode_preview always set `decodedIsJSON: true` for the JWT case (which
  // the renderer relies on to enable "Copy as JSON").
  if (!payloadParse.ok) {
    return null;
  }

  return {
    header,
    payload: payloadParse.value
  };
}

// ─── Escaped JSON ───────────────────────────────────────────────────────────

function tryDecodeEscapedJson(input) {
  if (typeof input !== "string") {
    return null;
  }

  // Path A — complete JSON string literal with outer quotes.
  // Example: `"hello\nworld"` → "hello\nworld" (a JS string)
  if (input.length >= 2 && input[0] === '"' && input[input.length - 1] === '"') {
    let parsed;
    try {
      parsed = JSON.parse(input);
    } catch {
      parsed = undefined;
    }
    if (typeof parsed === "string") {
      return parsed;
    }
    // fall through to Path B
  }

  // Path B — escaped JSON content with outer quotes stripped.
  // Typical case: a JSON string was printed to a log; the surrounding quotes
  // were lost in copy/paste, leaving `{\n    \"foo\": 1\n}` style content.
  // Strategy: wrap in quotes and JSON.parse to unescape, then verify the
  // unescaped result is itself a JSON object/array. The object-or-array
  // requirement rejects false positives like `\"hello\"` whose unescape is
  // just a scalar string.
  if (input.includes('\\"')) {
    let unescaped;
    try {
      unescaped = JSON.parse('"' + input + '"');
    } catch {
      return null;
    }
    if (typeof unescaped !== "string") {
      return null;
    }
    let validated;
    try {
      validated = JSON.parse(unescaped);
    } catch {
      return null;
    }
    if (validated === null || typeof validated !== "object") {
      return null;
    }
    return unescaped;
  }

  return null;
}

// ─── URL ────────────────────────────────────────────────────────────────────

const URL_PERCENT_RE = /%[0-9A-Fa-f]{2}/;

function tryDecodeUrl(input) {
  if (typeof input !== "string") {
    return null;
  }
  if (!URL_PERCENT_RE.test(input)) {
    return null;
  }
  let decoded;
  try {
    decoded = decodeURIComponent(input);
  } catch {
    return null;
  }
  if (decoded === input) {
    return null;
  }
  return decoded;
}

// ─── Base64 ─────────────────────────────────────────────────────────────────

const BASE64_STANDARD_RE = /^[A-Za-z0-9+/]+={0,2}$/;
const BASE64_URLSAFE_RE = /^[A-Za-z0-9_-]+={0,2}$/;
const CONTROL_RE = /\p{C}/u;

function isPrintableChar(codePoint, char) {
  // ASCII printable \x20–\x7E and common whitespace \t \n \r
  if (codePoint >= 0x20 && codePoint <= 0x7e) {
    return true;
  }
  if (char === "\t" || char === "\n" || char === "\r") {
    return true;
  }
  // Any non-control Unicode char counts as printable
  return !CONTROL_RE.test(char);
}

function printableRatio(text) {
  if (text.length === 0) {
    return 0;
  }
  let printable = 0;
  let total = 0;
  for (const ch of text) {
    // for...of iterates code points (handles surrogate pairs as one)
    total += 1;
    if (isPrintableChar(ch.codePointAt(0), ch)) {
      printable += 1;
    }
  }
  if (total === 0) {
    return 0;
  }
  return printable / total;
}

function tryDecodeBase64(input) {
  if (typeof input !== "string") {
    return null;
  }
  const stripped = input.replace(/\s+/g, "");
  if (stripped.length < 8) {
    return null;
  }

  const matchesStandard = BASE64_STANDARD_RE.test(stripped);
  const matchesUrlsafe = BASE64_URLSAFE_RE.test(stripped);
  if (!matchesStandard && !matchesUrlsafe) {
    return null;
  }

  // Prefer URL-safe interpretation when:
  //  - the alphabet is strictly URL-safe (contains _ or -), OR
  //  - the string only uses [A-Za-z0-9] (both alphabets accept it) and its
  //    length is not a multiple of 4 (unpadded URL-safe per RFC 4648 §5).
  const containsUrlSafeOnlyChar = /[_\-]/.test(stripped);
  const lengthMultipleOfFour = stripped.length % 4 === 0;
  const useUrlSafe =
    containsUrlSafeOnlyChar || (!lengthMultipleOfFour && matchesUrlsafe);

  if (!useUrlSafe && !lengthMultipleOfFour) {
    return null;
  }

  let buffer;
  try {
    buffer = Buffer.from(stripped, useUrlSafe ? "base64url" : "base64");
  } catch {
    return null;
  }

  if (!buffer || buffer.length === 0) {
    return null;
  }

  // Round-trip check: bytes → utf8 string → bytes must equal original buffer.
  let decoded;
  try {
    decoded = buffer.toString("utf8");
  } catch {
    return null;
  }
  const roundTrip = Buffer.from(decoded, "utf8");
  if (!roundTrip.equals(buffer)) {
    return null;
  }

  if (printableRatio(decoded) < 0.95) {
    return null;
  }

  return decoded;
}

module.exports = {
  tryDecodeJWT,
  tryDecodeEscapedJson,
  tryDecodeUrl,
  tryDecodeBase64
};
