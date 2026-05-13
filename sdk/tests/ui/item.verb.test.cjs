'use strict';
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');

function freshPastyWithHostSync(attachmentBootstrap, mockResponse) {
  Object.keys(require.cache).forEach(k => { if (k.includes('dist/ui')) delete require.cache[k]; });
  const d = new JSDOM('', { url: 'http://localhost' });
  global.window = d.window;
  global.document = d.window.document;
  const calls = [];
  global.window.__PASTY_PLUGIN_BOOTSTRAP__ = attachmentBootstrap;
  global.window.webkit = {
    messageHandlers: {
      pastyPluginHostSync: {
        async postMessage(json) {
          const req = JSON.parse(json);
          calls.push(req);
          return typeof mockResponse === 'function' ? mockResponse(req) : JSON.stringify(mockResponse);
        }
      }
    }
  };
  return { pasty: require('../../dist/ui/index.cjs').pasty, calls };
}

const sampleItem = { id: '1', type: 'text', text: 'hello', tags: ['existing'], sourceAppID: 'test' };
const sampleAttachment = { rendererID: 'r1', attachmentType: 'at', attachmentKey: 'k', payloadJson: '{}', item: sampleItem, buttons: [] };

describe('item verb tests', () => {
  it('setTags calls hostSync with correct payload', async () => {
    const { pasty, calls } = freshPastyWithHostSync(
      { item: sampleItem, attachment: sampleAttachment },
      { tags: ['a', 'b'] }
    );
    const result = await pasty.item.setTags(['a', 'b']);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].method, 'setTags');
    assert.deepEqual(JSON.parse(calls[0].payloadJson), { tags: ['a', 'b'] });
    assert.deepEqual(result, ['a', 'b']);
  });

  it('addTags calls hostSync with addTags method', async () => {
    const { pasty, calls } = freshPastyWithHostSync(
      { item: sampleItem, attachment: sampleAttachment },
      { tags: ['existing', 'new-tag'] }
    );
    const result = await pasty.item.addTags(['new-tag']);
    assert.equal(calls[0].method, 'addTags');
    assert.deepEqual(JSON.parse(calls[0].payloadJson), { tags: ['new-tag'] });
    assert.deepEqual(result, ['existing', 'new-tag']);
  });

  it('removeTags calls hostSync with removeTags method', async () => {
    const { pasty, calls } = freshPastyWithHostSync(
      { item: sampleItem, attachment: sampleAttachment },
      { tags: [] }
    );
    const result = await pasty.item.removeTags(['existing']);
    assert.equal(calls[0].method, 'removeTags');
    assert.deepEqual(result, []);
  });
});
