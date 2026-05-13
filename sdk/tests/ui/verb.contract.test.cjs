'use strict';
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');

function freshPastyWithMock(attachmentBootstrap) {
  Object.keys(require.cache).forEach(k => { if (k.includes('dist/ui')) delete require.cache[k]; });
  const d = new JSDOM('', { url: 'http://localhost' });
  global.window = d.window;
  global.document = d.window.document;

  const calls = { setHeight: [], hostSync: [] };
  global.window.__PASTY_PLUGIN_BOOTSTRAP__ = attachmentBootstrap;

  global.window.webkit = {
    messageHandlers: {
      pastyPluginSetHeight: {
        postMessage(json) { calls.setHeight.push(JSON.parse(json)); }
      },
      pastyPluginHostSync: {
        async postMessage(json) {
          const req = JSON.parse(json);
          calls.hostSync.push(req);
          return JSON.stringify({ tags: ['a', 'b'] });
        }
      },
      pastyPluginAction: {
        postMessage(val) { calls.action = val; }
      }
    }
  };

  const pasty = require('../../dist/ui/index.cjs').pasty;
  return { pasty, calls };
}

const sampleItem = { id: '1', type: 'text', text: 'hello', tags: [], sourceAppID: 'test' };
const sampleAttachment = { rendererID: 'r1', attachmentType: 'at', attachmentKey: 'k', payloadJson: '{}', item: sampleItem, buttons: [] };

describe('postMessage routing', () => {
  it('window.setHeight posts to pastyPluginSetHeight', () => {
    const { pasty, calls } = freshPastyWithMock({ item: sampleItem, attachment: sampleAttachment, rendererID: 'r1' });
    pasty.window.setHeight(200);
    assert.equal(calls.setHeight.length, 1);
    assert.equal(calls.setHeight[0].height, 200);
    assert.equal(calls.setHeight[0].rendererID, 'r1');
  });

  it('absent handler does not throw', () => {
    Object.keys(require.cache).forEach(k => { if (k.includes('dist/ui')) delete require.cache[k]; });
    const d = new JSDOM('', { url: 'http://localhost' });
    global.window = d.window;
    global.document = d.window.document;
    global.window.__PASTY_PLUGIN_BOOTSTRAP__ = { item: sampleItem, attachment: sampleAttachment };
    // no webkit handlers at all
    const pasty = require('../../dist/ui/index.cjs').pasty;
    assert.doesNotThrow(() => pasty.window.setHeight(100));
  });
});

describe('callHostSync marshaling', () => {
  it('setTags calls hostSync with correct method and payload', async () => {
    const { pasty, calls } = freshPastyWithMock({ item: sampleItem, attachment: sampleAttachment });
    await pasty.item.setTags(['a', 'b']);
    assert.equal(calls.hostSync.length, 1);
    const req = calls.hostSync[0];
    assert.equal(req.method, 'setTags');
    const payload = JSON.parse(req.payloadJson);
    assert.deepEqual(payload.tags, ['a', 'b']);
  });
});
