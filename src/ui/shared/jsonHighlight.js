/**
 * Lightweight JSON syntax highlighter.
 * Returns an HTML string with <span class="jh-{type}"> tokens.
 * Falls back to plain HTML-escaped text if input is not valid JSON.
 */

const ESC = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
function escHtml(s) {
  return s.replace(/[&<>"']/g, (c) => ESC[c]);
}

function span(type, text) {
  return `<span class="jh-${type}">${escHtml(text)}</span>`;
}

/**
 * Tokenize a JSON string into [{type, raw}] preserving original text.
 * Context tracks whether the previous non-whitespace token was a colon
 * so we can distinguish key strings from value strings.
 */
function tokenize(text) {
  const tokens = [];
  let i = 0;
  let lastMeaningful = ""; // last non-whitespace token raw value

  while (i < text.length) {
    const ch = text[i];

    // Whitespace
    if (/\s/.test(ch)) {
      let j = i + 1;
      while (j < text.length && /\s/.test(text[j])) j++;
      tokens.push({ type: "whitespace", raw: text.slice(i, j) });
      i = j;
      continue;
    }

    // String
    if (ch === '"') {
      let j = i + 1;
      while (j < text.length) {
        if (text[j] === "\\") { j += 2; continue; }
        if (text[j] === '"') { j++; break; }
        j++;
      }
      const raw = text.slice(i, j);
      // Determine if this string is a key: peek ahead past whitespace for ':'
      let peek = j;
      while (peek < text.length && /\s/.test(text[peek])) peek++;
      const isKey = text[peek] === ":";
      tokens.push({ type: isKey ? "key" : "string", raw });
      lastMeaningful = raw;
      i = j;
      continue;
    }

    // Number
    if (ch === "-" || (ch >= "0" && ch <= "9")) {
      let j = i + 1;
      while (j < text.length && /[0-9eE+\-.]/.test(text[j])) j++;
      const raw = text.slice(i, j);
      tokens.push({ type: "number", raw });
      lastMeaningful = raw;
      i = j;
      continue;
    }

    // Boolean
    if (text.startsWith("true", i) || text.startsWith("false", i)) {
      const raw = text.startsWith("true", i) ? "true" : "false";
      tokens.push({ type: "bool", raw });
      lastMeaningful = raw;
      i += raw.length;
      continue;
    }

    // Null
    if (text.startsWith("null", i)) {
      tokens.push({ type: "null", raw: "null" });
      lastMeaningful = "null";
      i += 4;
      continue;
    }

    // Punctuation: { } [ ] : ,
    tokens.push({ type: "punct", raw: ch });
    lastMeaningful = ch;
    i++;
  }

  return tokens;
}

/**
 * @param {string} text
 * @returns {string} HTML string
 */
export function highlightJson(text) {
  try {
    JSON.parse(text);
  } catch {
    return escHtml(text);
  }

  const tokens = tokenize(text);
  return tokens
    .map((t) => (t.type === "whitespace" ? t.raw : span(t.type, t.raw)))
    .join("");
}
