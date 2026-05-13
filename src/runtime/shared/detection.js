"use strict";

const {
  tryDecodeJWT,
  tryDecodeEscapedJson,
  tryDecodeUrl,
  tryDecodeBase64
} = require("./decoders");

const MAX_INPUT_CHARS = 256 * 1024;

function preprocess(rawText) {
  if (typeof rawText !== "string") {
    return { trimmed: "", bail: true };
  }
  const trimmed = rawText.trim();
  if (trimmed.length === 0) {
    return { trimmed: "", bail: true };
  }
  if (trimmed.length > MAX_INPUT_CHARS) {
    return { trimmed, bail: true };
  }
  return { trimmed, bail: false };
}

function runPriorityChain(trimmed) {
  if (typeof trimmed !== "string" || trimmed.length === 0) {
    return null;
  }

  // 1. JWT
  const jwt = tryDecodeJWT(trimmed);
  if (jwt) {
    return {
      encoding: "jwt",
      decoded: JSON.stringify({ header: jwt.header, payload: jwt.payload }, null, 2),
      jwt
    };
  }

  // 2. Escaped JSON string
  const escapedJson = tryDecodeEscapedJson(trimmed);
  if (escapedJson !== null) {
    return {
      encoding: "escaped_json",
      decoded: escapedJson
    };
  }

  // 3. URL
  const url = tryDecodeUrl(trimmed);
  if (url !== null) {
    return {
      encoding: "url",
      decoded: url
    };
  }

  // 4. Base64 / Base64URL
  const base64 = tryDecodeBase64(trimmed);
  if (base64 !== null) {
    return {
      encoding: "base64",
      decoded: base64
    };
  }

  return null;
}

module.exports = {
  preprocess,
  runPriorityChain,
  MAX_INPUT_CHARS
};
