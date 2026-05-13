import { itemModule, initFromBootstrap } from './modules/item.js';
import { themeModule } from './modules/theme.js';
import { actionModule, initActionFromBootstrap } from './modules/action.js';
import { windowModule } from './modules/window.js';
import { clipboardModule } from './modules/clipboard.js';
import { navigationModule } from './modules/navigation.js';
import { settingsModule } from './modules/settings.js';
import { patchConsole } from './internal/console.js';
import { patchTextInputState } from './internal/textInputState.js';
import { PluginContextError, setContext, withContextGuard } from './internal/context.js';

// Patch console and text input state once at module load
if (typeof window !== 'undefined') {
  patchConsole();
  patchTextInputState();
}

let _readyResolve: (() => void) | null = null;
let _ready = false;

const _readyPromise = new Promise<void>((resolve) => {
  _readyResolve = resolve;
});

function resolveReady(): void {
  if (!_ready) {
    _ready = true;
    _readyResolve?.();
  }
}

function detectAndInit(): void {
  if (typeof window === 'undefined') return;

  const attachmentBootstrap = (window as any).__PASTY_PLUGIN_BOOTSTRAP__;
  const actionBootstrap = (window as any).__PASTY_PLUGIN_ACTION_BOOTSTRAP__;

  if (attachmentBootstrap) {
    setContext('attachment');
    initFromBootstrap(attachmentBootstrap);
    resolveReady();
  } else if (actionBootstrap) {
    setContext('action');
    initActionFromBootstrap(actionBootstrap);
    resolveReady();
  }
}

// Initialize immediately if bootstrap is already available
detectAndInit();

// Listen for deferred bootstrap events
if (typeof window !== 'undefined') {
  window.addEventListener('pasty-plugin-bootstrap', (event: Event) => {
    const detail = (event as CustomEvent).detail;
    if (!_ready) {
      setContext('attachment');
      if (detail) initFromBootstrap(detail);
      resolveReady();
    }
  });

  window.addEventListener('pasty-plugin-action-bootstrap', (event: Event) => {
    const detail = (event as CustomEvent).detail;
    if (!_ready) {
      setContext('action');
      if (detail) initActionFromBootstrap(detail);
      resolveReady();
    }
  });
}

export const pasty = {
  ready: (): Promise<void> => _readyPromise,

  item: {
    current: itemModule.current,
    on: itemModule.on,
    setTags: itemModule.setTags,
    addTags: itemModule.addTags,
    removeTags: itemModule.removeTags,
    setPinned: itemModule.setPinned,
    setAttachments: itemModule.setAttachments,
    setSearchExtension: itemModule.setSearchExtension,
    attachment: {
      current: itemModule.attachment.current,
      on: itemModule.attachment.on,
      invoke: itemModule.attachment.invoke,
      onHostInvoke: itemModule.attachment.onHostInvoke,
    },
    search: {
      current: itemModule.search.current,
      on: itemModule.search.on,
    },
  },

  theme: {
    current: themeModule.current,
    on: themeModule.on,
    refresh: themeModule.refresh,
  },

  action: {
    current: actionModule.current,
    on: actionModule.on,
    invoke: withContextGuard('action', actionModule.invoke),
    draft: {
      current: actionModule.draft.current,
      on: actionModule.draft.on,
      update: withContextGuard('action', actionModule.draft.update),
    },
  },

  window: {
    setHeight: windowModule.setHeight,
    autoFit: windowModule.autoFit,
  },

  clipboard: {
    copyText: clipboardModule.copyText,
  },

  navigation: {
    openUrl: navigationModule.openUrl,
    revealInFinder: navigationModule.revealInFinder,
    openFilePath: navigationModule.openFilePath,
  },

  settings: {
    get: settingsModule.get,
    getAll: settingsModule.getAll,
  },
};

export type { PluginContextError };
