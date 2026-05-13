'use strict';
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');

function freshPastyWithTheme(snapshot) {
  Object.keys(require.cache).forEach(k => { if (k.includes('dist/ui')) delete require.cache[k]; });
  const d = new JSDOM('', { url: 'http://localhost' });
  global.window = d.window;
  global.document = d.window.document;
  const sampleItem = { id: '1', type: 'text', text: 'hi', tags: [], sourceAppID: 'test' };
  global.window.__PASTY_PLUGIN_BOOTSTRAP__ = {
    item: sampleItem,
    attachment: { rendererID: 'r1', attachmentType: 'at', attachmentKey: 'k', payloadJson: '{}', item: sampleItem, buttons: [] }
  };
  global.window.webkit = {
    messageHandlers: {
      pastyPluginHostSync: {
        async postMessage(json) {
          return JSON.stringify(snapshot);
        }
      }
    }
  };
  return require('../../dist/ui/index.cjs').pasty;
}

describe('theme.refresh', () => {
  it('calls hostSync getThemeSnapshot and resolves with snapshot', async () => {
    const snapshot = { scheme: 'dark', tokens: { '--pasty-accent': '#5AC8FA' } };
    const pasty = freshPastyWithTheme(snapshot);
    const result = await pasty.theme.refresh();
    assert.equal(result.scheme, 'dark');
    assert.equal(result.tokens['--pasty-accent'], '#5AC8FA');
  });

  it('theme.on fires when pasty-plugin-theme-updated dispatched', () => {
    const snapshot = { scheme: 'light', tokens: {} };
    const pasty = freshPastyWithTheme(snapshot);
    const received = [];
    pasty.theme.on((v) => received.push(v));
    global.window.dispatchEvent(new global.window.CustomEvent('pasty-plugin-theme-updated', {
      detail: { scheme: 'dark', tokenSnapshot: { '--pasty-accent': '#000' } }
    }));
    assert.equal(received.length, 1);
    assert.equal(received[0].scheme, 'dark');
  });
});
