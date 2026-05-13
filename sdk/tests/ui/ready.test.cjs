'use strict';
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');

function freshPasty(attachmentBootstrap, actionBootstrap) {
  Object.keys(require.cache).forEach(k => { if (k.includes('dist/ui')) delete require.cache[k]; });
  const d = new JSDOM('', { url: 'http://localhost' });
  global.window = d.window;
  global.document = d.window.document;
  if (attachmentBootstrap !== null && attachmentBootstrap !== undefined) {
    global.window.__PASTY_PLUGIN_BOOTSTRAP__ = attachmentBootstrap;
  }
  if (actionBootstrap !== null && actionBootstrap !== undefined) {
    global.window.__PASTY_PLUGIN_ACTION_BOOTSTRAP__ = actionBootstrap;
  }
  return { pasty: require('../../dist/ui/index.cjs').pasty, window: global.window };
}

const sampleItem = { id: '1', type: 'text', text: 'hello', tags: [], sourceAppID: 'test' };
const sampleAttachment = {
  rendererID: 'r1', attachmentType: 'at', attachmentKey: 'k', payloadJson: '{}',
  item: sampleItem, buttons: [],
};

describe('pasty.ready()', () => {
  it('resolves immediately with attachment bootstrap', async () => {
    const { pasty } = freshPasty({ item: sampleItem, attachment: sampleAttachment });
    await assert.doesNotReject(() => pasty.ready());
  });

  it('attachment context: item.current() returns item after ready', async () => {
    const { pasty } = freshPasty({ item: sampleItem, attachment: sampleAttachment });
    await pasty.ready();
    assert.deepEqual(pasty.item.current(), sampleItem);
  });

  it('attachment context: item.attachment.current() returns attachment after ready', async () => {
    const { pasty } = freshPasty({ item: sampleItem, attachment: sampleAttachment });
    await pasty.ready();
    assert.deepEqual(pasty.item.attachment.current(), sampleAttachment);
  });

  it('resolves immediately with action bootstrap', async () => {
    const actionBootstrap = {
      pluginID: 'test', actionID: 'act1', item: sampleItem, draft: { foo: 'bar' },
      buttons: [], defaultButtonID: null, displayName: 'Test Action'
    };
    const { pasty } = freshPasty(null, actionBootstrap);
    await assert.doesNotReject(() => pasty.ready());
    await pasty.ready();
    assert.ok(pasty.action.current() !== undefined);
    assert.equal(pasty.action.current()?.actionID, 'act1');
  });

  it('deferred bootstrap: ready resolves after pasty-plugin-bootstrap CustomEvent', async () => {
    const { pasty, window: w } = freshPasty(null, null);
    let resolved = false;
    const p = pasty.ready().then(() => { resolved = true; });
    assert.equal(resolved, false);
    w.dispatchEvent(new w.CustomEvent('pasty-plugin-bootstrap', {
      detail: { item: sampleItem, attachment: sampleAttachment }
    }));
    await p;
    assert.equal(resolved, true);
  });

  it('action context → pasty.action.draft.update() resolves (not rejected)', async () => {
    const actionBootstrap = {
      pluginID: 'test', actionID: 'act1', item: sampleItem, draft: { foo: 'bar' },
      buttons: [{ id: 'submit', title: 'Submit' }], defaultButtonID: 'submit', displayName: null
    };
    const { pasty } = freshPasty(null, actionBootstrap);
    await pasty.ready();
    await assert.doesNotReject(() => pasty.action.draft.update({ draft: { foo: 'updated' } }));
  });

  it('action context → pasty.action.invoke() resolves (not rejected)', async () => {
    const actionBootstrap = {
      pluginID: 'test', actionID: 'act1', item: sampleItem, draft: {},
      buttons: [{ id: 'go', title: 'Go' }], defaultButtonID: 'go', displayName: null
    };
    const { pasty } = freshPasty(null, actionBootstrap);
    await pasty.ready();
    await assert.doesNotReject(() => pasty.action.invoke('go'));
  });

  it('wrong context: attachment context → pasty.action.current() is undefined', async () => {
    const { pasty } = freshPasty({ item: sampleItem, attachment: sampleAttachment });
    await pasty.ready();
    assert.equal(pasty.action.current(), undefined);
  });

  it('wrong context: attachment context → pasty.action.draft.update() rejects with PluginContextError', async () => {
    const { pasty } = freshPasty({ item: sampleItem, attachment: sampleAttachment });
    await pasty.ready();
    await assert.rejects(
      () => pasty.action.draft.update({ draft: {} }),
      (err) => {
        assert.equal(err.name, 'PluginContextError');
        return true;
      }
    );
  });
});
