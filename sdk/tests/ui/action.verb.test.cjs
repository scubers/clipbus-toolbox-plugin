'use strict';
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');

function freshPastyAction(actionBootstrap) {
  Object.keys(require.cache).forEach(k => { if (k.includes('dist/ui')) delete require.cache[k]; });
  const d = new JSDOM('', { url: 'http://localhost' });
  global.window = d.window;
  global.document = d.window.document;
  global.window.__PASTY_PLUGIN_ACTION_BOOTSTRAP__ = actionBootstrap;
  const draftCalls = [];
  const runCalls = [];
  global.window.webkit = {
    messageHandlers: {
      pastyPluginActionDraft: {
        postMessage(val) { draftCalls.push(val); }
      },
      pastyPluginActionRun: {
        postMessage(val) { runCalls.push(val); }
      }
    }
  };
  return { pasty: require('../../dist/ui/index.cjs').pasty, draftCalls, runCalls };
}

const sampleItem = { id: '1', type: 'text', text: 'hello', tags: [], sourceAppID: 'test' };

describe('action verbs', () => {
  it('action.draft.update posts to pastyPluginActionDraft', async () => {
    const { pasty, draftCalls } = freshPastyAction({
      pluginID: 'test', actionID: 'act1', item: sampleItem, draft: {},
      buttons: [], defaultButtonID: null, displayName: null
    });
    await pasty.action.draft.update({ draft: { foo: 'bar' }, disabledButtonIDs: [], defaultButtonID: null });
    assert.equal(draftCalls.length, 1);
    // postMessage receives a parsed object (not JSON string for action handlers)
    const msg = typeof draftCalls[0] === 'string' ? JSON.parse(draftCalls[0]) : draftCalls[0];
    assert.deepEqual(msg.draft, { foo: 'bar' });
  });

  it('action.invoke posts to pastyPluginActionRun', async () => {
    const { pasty, runCalls } = freshPastyAction({
      pluginID: 'test', actionID: 'act1', item: sampleItem, draft: { x: 1 },
      buttons: [{ id: 'submit', title: 'Submit' }], defaultButtonID: 'submit', displayName: null
    });
    await pasty.action.invoke('submit');
    assert.equal(runCalls.length, 1);
    const msg = typeof runCalls[0] === 'string' ? JSON.parse(runCalls[0]) : runCalls[0];
    assert.equal(msg.buttonID, 'submit');
  });
});
