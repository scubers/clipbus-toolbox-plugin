'use strict';
// Tests that UI source code has NO direct bridge/window references
// (grep-style assertions on source text)
// Note: src/ui/preview/ is excluded — the preview host is allowed to set
// bootstrap globals because it simulates what the native host does.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '../..');

function collectUISource() {
  const uiDir = path.join(projectRoot, 'src/ui');
  const files = [];
  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      // Exclude preview/ — it simulates the host and is allowed to set bootstrap globals
      if (entry.isDirectory()) {
        if (entry.name === 'preview') continue;
        walk(full);
        continue;
      }
      if (/\.(js|vue)$/.test(entry.name)) files.push(full);
    }
  }
  walk(uiDir);
  return files.map(f => ({ path: f, content: fs.readFileSync(f, 'utf8') }));
}

test('UI source has no direct window.webkit.messageHandlers calls', () => {
  const files = collectUISource();
  for (const { path: p, content } of files) {
    assert.ok(
      !content.includes('window.webkit.messageHandlers'),
      `${p}: must not use window.webkit.messageHandlers directly`
    );
  }
});

test('UI source has no direct window.__PASTY_PLUGIN_BOOTSTRAP__ access', () => {
  const files = collectUISource();
  for (const { path: p, content } of files) {
    assert.ok(
      !content.includes('window.__PASTY_PLUGIN_BOOTSTRAP__'),
      `${p}: must not access window.__PASTY_PLUGIN_BOOTSTRAP__ directly`
    );
  }
});

test('UI source has no createAttachmentBridge or createActionBridge', () => {
  const files = collectUISource();
  for (const { path: p, content } of files) {
    assert.ok(!content.includes('createAttachmentBridge'), `${p}: must not use createAttachmentBridge`);
    assert.ok(!content.includes('createActionBridge'), `${p}: must not use createActionBridge`);
  }
});

test('UI source has no addEventListener for pasty-plugin-* custom events', () => {
  const files = collectUISource();
  for (const { path: p, content } of files) {
    assert.ok(
      !content.includes("addEventListener('pasty-plugin-") && !content.includes('addEventListener("pasty-plugin-'),
      `${p}: must not listen to pasty-plugin-* events directly`
    );
  }
});
