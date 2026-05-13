'use strict';
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');

// Set up jsdom window before requiring built dist
const dom = new JSDOM('', { url: 'http://localhost' });
global.window = dom.window;
global.document = dom.window.document;

// Bust require cache to get fresh module
Object.keys(require.cache).forEach(k => { if (k.includes('dist/ui')) delete require.cache[k]; });
// We test the topic internals by importing the CJS build
const uiDist = require('../../dist/ui/index.cjs');

// Topic and stream factories are internal — test via the exposed pasty object
// However, since they're internal, we test them indirectly through pasty topic behavior.
// For direct access to createTopic/createStream we need to test through dist internals.
// Actually, they're not exported — test via pasty.item which is a Topic.
// Use fresh JSDOM for each isolated test below.

function freshPasty(bootstrapAttachment = null) {
  Object.keys(require.cache).forEach(k => { if (k.includes('dist/ui')) delete require.cache[k]; });
  const d = new JSDOM('', { url: 'http://localhost' });
  global.window = d.window;
  global.document = d.window.document;
  if (bootstrapAttachment) {
    global.window.__PASTY_PLUGIN_BOOTSTRAP__ = bootstrapAttachment;
  }
  return require('../../dist/ui/index.cjs').pasty;
}

const sampleItem = { id: '1', type: 'text', text: 'hello', tags: [], sourceAppID: 'test' };
const sampleAttachment = {
  rendererID: 'r1', attachmentType: 'at', attachmentKey: 'k', payloadJson: '{}',
  item: sampleItem, buttons: [],
};

describe('Topic contract via pasty.item', () => {
  it('currentReturnsInitialValue — item is set from bootstrap', () => {
    const pasty = freshPasty({ item: sampleItem, attachment: sampleAttachment });
    const item = pasty.item.current();
    assert.deepEqual(item, sampleItem);
  });

  it('setAndFanOutToListeners — pasty-plugin-attachment-updated updates item and fires listener', () => {
    const pasty = freshPasty({ item: sampleItem, attachment: sampleAttachment });
    const received = [];
    pasty.item.on((v) => received.push(v));
    const newItem = { ...sampleItem, text: 'updated' };
    global.window.dispatchEvent(new global.window.CustomEvent('pasty-plugin-attachment-updated', {
      detail: { item: newItem, attachment: sampleAttachment }
    }));
    assert.equal(received.length, 1);
    assert.deepEqual(received[0], newItem);
    assert.deepEqual(pasty.item.current(), newItem);
  });

  it('unsubscribeRemovesListener — after unsub, listener not called', () => {
    const pasty = freshPasty({ item: sampleItem, attachment: sampleAttachment });
    const received = [];
    const unsub = pasty.item.on((v) => received.push(v));
    unsub();
    global.window.dispatchEvent(new global.window.CustomEvent('pasty-plugin-attachment-updated', {
      detail: { item: { ...sampleItem, text: 'after unsub' }, attachment: sampleAttachment }
    }));
    assert.equal(received.length, 0);
  });

  it('listenerExceptionIsolation — one throwing listener does not prevent others', () => {
    const pasty = freshPasty({ item: sampleItem, attachment: sampleAttachment });
    const received = [];
    pasty.item.on(() => { throw new Error('bad listener'); });
    pasty.item.on((v) => received.push(v));
    const newItem = { ...sampleItem, text: 'isolation test' };
    global.window.dispatchEvent(new global.window.CustomEvent('pasty-plugin-attachment-updated', {
      detail: { item: newItem, attachment: sampleAttachment }
    }));
    assert.equal(received.length, 1);
  });
});

describe('OptionalTopic contract via pasty.item.attachment', () => {
  it('currentUndefinedBeforeBootstrap — no bootstrap means undefined', () => {
    const pasty = freshPasty(null);
    assert.equal(pasty.item.attachment.current(), undefined);
  });

  it('currentAfterBootstrap — bootstrap sets attachment', () => {
    const pasty = freshPasty({ item: sampleItem, attachment: sampleAttachment });
    assert.deepEqual(pasty.item.attachment.current(), sampleAttachment);
  });

  it('listenersFireAfterSet — pasty-plugin-attachment-updated fires attachment listener', () => {
    const pasty = freshPasty({ item: sampleItem, attachment: sampleAttachment });
    const received = [];
    pasty.item.attachment.on((v) => received.push(v));
    const newAttachment = { ...sampleAttachment, rendererID: 'r2' };
    global.window.dispatchEvent(new global.window.CustomEvent('pasty-plugin-attachment-updated', {
      detail: { item: sampleItem, attachment: newAttachment }
    }));
    assert.equal(received.length, 1);
    assert.deepEqual(received[0], newAttachment);
  });
});
