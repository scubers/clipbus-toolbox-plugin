'use strict';
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');

function freshPasty(bootstrap = null) {
  Object.keys(require.cache).forEach(k => { if (k.includes('dist/ui')) delete require.cache[k]; });
  const d = new JSDOM('', { url: 'http://localhost' });
  global.window = d.window;
  global.document = d.window.document;
  if (bootstrap) {
    global.window.__PASTY_PLUGIN_BOOTSTRAP__ = bootstrap;
  }
  return require('../../dist/ui/index.cjs').pasty;
}

const sampleItem = { id: '1', type: 'text', text: 'hello', tags: [], sourceAppID: 'test' };
const sampleAttachment = {
  rendererID: 'r1', attachmentType: 'at', attachmentKey: 'k', payloadJson: '{}',
  item: sampleItem, buttons: [{ id: 'btn1', title: 'Do it' }],
};

describe('Stream contract via pasty.item.attachment.onHostInvoke', () => {
  it('emitFansOutToListeners — pasty-plugin-renderer-action fires all listeners', () => {
    const pasty = freshPasty({ item: sampleItem, attachment: sampleAttachment });
    const received1 = [];
    const received2 = [];
    pasty.item.attachment.onHostInvoke((v) => received1.push(v));
    pasty.item.attachment.onHostInvoke((v) => received2.push(v));
    global.window.dispatchEvent(new global.window.CustomEvent('pasty-plugin-renderer-action', {
      detail: { actionID: 'btn1', revision: 1 }
    }));
    assert.equal(received1.length, 1);
    assert.equal(received2.length, 1);
    assert.equal(received1[0].actionID, 'btn1');
  });

  it('unsubscribeRemovesListener — after unsub, listener not called', () => {
    const pasty = freshPasty({ item: sampleItem, attachment: sampleAttachment });
    const received = [];
    const unsub = pasty.item.attachment.onHostInvoke((v) => received.push(v));
    unsub();
    global.window.dispatchEvent(new global.window.CustomEvent('pasty-plugin-renderer-action', {
      detail: { actionID: 'btn1', revision: 2 }
    }));
    assert.equal(received.length, 0);
  });

  it('listenerExceptionIsolation — one throwing listener does not prevent others', () => {
    const pasty = freshPasty({ item: sampleItem, attachment: sampleAttachment });
    const received = [];
    pasty.item.attachment.onHostInvoke(() => { throw new Error('fail'); });
    pasty.item.attachment.onHostInvoke((v) => received.push(v));
    global.window.dispatchEvent(new global.window.CustomEvent('pasty-plugin-renderer-action', {
      detail: { actionID: 'btn1', revision: 3 }
    }));
    assert.equal(received.length, 1);
  });
});
