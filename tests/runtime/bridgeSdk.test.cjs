// Pasty - Copyright (c) 2026. MIT License.
// Tests for SDK window/theme verbs (migrated from createAttachmentBridge).

"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { JSDOM } = require("jsdom");

// SDK dist path
const SDK_UI_CJS = require.resolve("@pasty/plugin-sdk/runtime")
  .replace(/dist\/runtime\/index\.cjs$/, "dist/ui/index.cjs");

/**
 * Create a fresh jsdom + mock webkit environment and require a fresh instance
 * of the SDK UI dist.
 */
function makeContext({ bootstrap = null, postMessageFn = null } = {}) {
  // Bust require cache for ui dist
  Object.keys(require.cache).forEach(k => { if (k.includes("dist/ui")) delete require.cache[k]; });

  const setHeightMessages = [];
  const d = new JSDOM("", { url: "http://localhost" });
  global.window = d.window;
  global.document = d.window.document;

  if (bootstrap) {
    global.window.__PASTY_PLUGIN_BOOTSTRAP__ = bootstrap;
  }

  const observedTargets = [];
  let lastObserverCallback = null;

  function ResizeObserverMock(callback) {
    lastObserverCallback = callback;
    this.observe = (target) => observedTargets.push(target);
    this.disconnect = () => observedTargets.splice(0, observedTargets.length);
  }

  global.window.ResizeObserver = ResizeObserverMock;
  global.ResizeObserver = ResizeObserverMock;

  global.window.webkit = {
    messageHandlers: {
      pastyPluginHostSync: {
        async postMessage(json) {
          if (postMessageFn) return postMessageFn(json);
          return null;
        }
      },
      pastyPluginSetHeight: {
        postMessage(json) {
          setHeightMessages.push(JSON.parse(json));
        }
      },
      pastyPluginAction: {
        postMessage() {}
      }
    }
  };

  const { pasty } = require(SDK_UI_CJS);

  return {
    pasty,
    window: global.window,
    observedTargets,
    getLastObserverCallback: () => lastObserverCallback,
    setHeightMessages
  };
}

// ---------------------------------------------------------------------------
// pasty.window.setHeight
// ---------------------------------------------------------------------------

test("pasty.window.setHeight posts JSON with rendererID from bootstrap session", () => {
  const { pasty, setHeightMessages } = makeContext({
    bootstrap: { rendererID: "renderer-1" }
  });

  pasty.window.setHeight(320);

  assert.equal(setHeightMessages.length, 1);
  assert.equal(setHeightMessages[0].rendererID, "renderer-1");
  assert.equal(setHeightMessages[0].height, 320);
});

test("pasty.window.setHeight uses empty rendererID when no bootstrap session", () => {
  const { pasty, setHeightMessages } = makeContext({ bootstrap: null });

  pasty.window.setHeight(200);

  assert.equal(setHeightMessages.length, 1);
  assert.equal(setHeightMessages[0].rendererID, "");
  assert.equal(setHeightMessages[0].height, 200);
});

// ---------------------------------------------------------------------------
// pasty.window.autoFit
// ---------------------------------------------------------------------------

test("pasty.window.autoFit observes target and calls setHeight on resize", () => {
  const { pasty, setHeightMessages, observedTargets, getLastObserverCallback } = makeContext({
    bootstrap: { rendererID: "r1" }
  });
  const fakeTarget = { scrollHeight: 250 };

  pasty.window.autoFit({ min: 100, max: 600, target: fakeTarget });

  assert.equal(observedTargets[0], fakeTarget);

  // Simulate a resize event
  getLastObserverCallback()([]);

  assert.equal(setHeightMessages.length, 1);
  assert.equal(setHeightMessages[0].height, 250);
});

test("pasty.window.autoFit clamps height to [min, max]", () => {
  const ctx1 = makeContext({ bootstrap: { rendererID: "r1" } });
  const tooSmall = { scrollHeight: 40 };

  ctx1.pasty.window.autoFit({ min: 100, max: 600, target: tooSmall });
  ctx1.getLastObserverCallback()([]);
  assert.equal(ctx1.setHeightMessages[0].height, 100); // clamped to min

  const ctx2 = makeContext({ bootstrap: { rendererID: "r1" } });
  const tooLarge = { scrollHeight: 900 };
  ctx2.pasty.window.autoFit({ min: 100, max: 600, target: tooLarge });
  ctx2.getLastObserverCallback()([]);
  assert.equal(ctx2.setHeightMessages[0].height, 600); // clamped to max
});

test("pasty.window.autoFit uses 800 as effective max when max is Infinity", () => {
  const { pasty, setHeightMessages, getLastObserverCallback } = makeContext({
    bootstrap: { rendererID: "r1" }
  });
  const bigTarget = { scrollHeight: 1000 };

  pasty.window.autoFit({ min: 0, max: Infinity, target: bigTarget });
  getLastObserverCallback()([]);

  assert.equal(setHeightMessages[0].height, 800);
});

test("pasty.window.autoFit returns a disconnect function that stops observation", () => {
  const { pasty, observedTargets } = makeContext({ bootstrap: null });
  const target = { scrollHeight: 100 };

  const disconnect = pasty.window.autoFit({ min: 0, max: 400, target });
  assert.equal(observedTargets.length, 1);

  disconnect();
  assert.equal(observedTargets.length, 0);
});

// ---------------------------------------------------------------------------
// pasty.theme.refresh (was bridge.theme.getSnapshot)
// ---------------------------------------------------------------------------

test("pasty.theme.refresh returns parsed snapshot from host sync", async () => {
  const snapshot = {
    scheme: "dark",
    tokens: { "--pasty-surface": "#1C1C1EFF", "--pasty-accent": "#5AC8FAFF" }
  };
  const { pasty } = makeContext({
    postMessageFn: (json) => {
      const req = JSON.parse(json);
      assert.equal(req.method, "getThemeSnapshot");
      return JSON.stringify(snapshot);
    }
  });

  const result = await pasty.theme.refresh();

  assert.equal(result.scheme, "dark");
  assert.equal(result.tokens["--pasty-surface"], "#1C1C1EFF");
});

test("pasty.theme.refresh returns default theme when no webkit bridge", async () => {
  Object.keys(require.cache).forEach(k => { if (k.includes("dist/ui")) delete require.cache[k]; });
  const d = new JSDOM("", { url: "http://localhost" });
  global.window = d.window;
  global.document = d.window.document;
  // no webkit handlers
  const { pasty } = require(SDK_UI_CJS);

  const result = await pasty.theme.refresh();
  // Returns current topic value (default theme) when no handler
  assert.ok(result !== null);
  assert.ok(typeof result === "object");
});

// ---------------------------------------------------------------------------
// pasty.theme.on (was bridge.theme.onChange)
// ---------------------------------------------------------------------------

test("pasty.theme.on invokes callback with scheme+tokens on theme event", () => {
  const { pasty, window: w } = makeContext();
  const received = [];

  pasty.theme.on((update) => received.push(update));

  w.dispatchEvent(new w.CustomEvent("pasty-plugin-theme-updated", {
    detail: {
      scheme: "light",
      tokenSnapshot: {
        surface: "#FFFFFFFF",
        accent: "#007AFFFF"
      }
    }
  }));

  assert.equal(received.length, 1);
  assert.equal(received[0].scheme, "light");
  assert.equal(received[0].tokens.surface, "#FFFFFFFF");
});

test("pasty.theme.on does not invoke callback when tokenSnapshot absent", () => {
  const { pasty, window: w } = makeContext();
  const received = [];

  pasty.theme.on((update) => received.push(update));

  // Emit legacy payload without tokenSnapshot
  w.dispatchEvent(new w.CustomEvent("pasty-plugin-theme-updated", { detail: { accentHex: "#007AFF" } }));

  assert.equal(received.length, 0);
});

test("pasty.theme.on returns an unsubscribe function", () => {
  const { pasty, window: w } = makeContext();
  const received = [];

  const unsubscribe = pasty.theme.on((u) => received.push(u));
  unsubscribe();

  w.dispatchEvent(new w.CustomEvent("pasty-plugin-theme-updated", {
    detail: { scheme: "dark", tokenSnapshot: { surface: "#000" } }
  }));

  assert.equal(received.length, 0);
});
