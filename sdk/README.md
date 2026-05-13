# @pasty/plugin-sdk

Embedded SDK for Pasty plugins. Provides typed helpers for the runtime (Node.js) and UI (WebView) sides of a plugin.

## Installation

The SDK ships pre-built inside `plugins/template-plugin/sdk/`. It is referenced as a `file:` dependency — no separate install step needed when working from within `plugins/template-plugin/`.

```json
{
  "dependencies": {
    "@pasty/plugin-sdk": "file:./sdk"
  }
}
```

## Runtime entry (`@pasty/plugin-sdk/runtime`)

Used in Node.js plugin code to define capabilities and return results.

### `definePlugin(definition)`

Validates and returns a plugin definition object. Throws if `setup` is not a function.

```js
const { definePlugin } = require('@pasty/plugin-sdk/runtime');
module.exports = definePlugin({ setup() { return { detectors: {}, attachmentRenderers: {}, actions: {} }; } });
```

### `actionResult.text(value, options?)`

Returns a locked `{ result: { resultKind: 'text', text }, userMessage }` shape.

| Param | Type | Description |
|---|---|---|
| `value` | `unknown` | Coerced to string. `null`/`undefined` → `""`. |
| `options.userMessage` | `string?` | Optional message shown to the user. |

### `actionResult.none(options?)`

Returns `{ result: { resultKind: 'none', text: null }, userMessage }`.

### `actionResult.image(value, options?)`

Returns a locked `{ result: { resultKind: 'image', imageTempPath, imageFormatHint }, userMessage }` shape. Use this when an action produces an image result written to a temp path allocated via `ctx.host.action.allocateImageTempPath()`.

| Param | Type | Description |
|---|---|---|
| `value.imageTempPath` | `string` | Path returned by `allocateImageTempPath`. |
| `value.imageFormatHint` | `string?` | Optional format hint (e.g. `"png"`, `"jpeg"`). |
| `options.userMessage` | `string?` | Optional message shown to the user. |

### `rendererResult.success(options?)`

Returns `{ success: true, userMessage }`.

### `rendererResult.failure(userMessage)`

Returns `{ success: false, userMessage }`. `undefined`/`null` → `null`.

---

### Host verbs (`ctx.host.*`) — runtime context only

These verbs are available on the `ctx.host` object passed to every runtime handler.

#### `ctx.host.item`

| Method | Returns | Description |
|---|---|---|
| `materializeImagePath()` | `Promise<string>` | Copies the item's image to a stable temp file and returns its path. Idempotent across the invocation. Only valid for `image`-type items; rejects otherwise. |
| `readAttachment(type, key)` | `Promise<string \| null>` | Returns the `payloadJson` string for the named attachment, or `null` if absent. |

#### `ctx.host.action`

| Method | Returns | Description |
|---|---|---|
| `allocateImageTempPath(formatHint?)` | `Promise<string>` | Allocates a unique writable path for an image result. Must be consumed by returning `actionResult.image({ imageTempPath })`. The file is deleted when the invocation scope is disposed. |

---

## UI entry (`@pasty/plugin-sdk/ui`)

Used in WebView plugin code (ES modules, Vite build). Exposes a single `pasty` object.

```js
import { pasty } from '@pasty/plugin-sdk/ui';
await pasty.ready();
```

### `pasty.ready()` → `Promise<void>`

Resolves when the host has provided bootstrap data. If bootstrap globals are already present at module load time, this resolves synchronously. Otherwise it waits for the `pasty-plugin-bootstrap` or `pasty-plugin-action-bootstrap` custom event.

---

### `pasty.item` — Topic\<ClipboardItem\>

| Member | Shape | Description |
|---|---|---|
| `pasty.item.current()` | `() → ClipboardItem` | Read current item |
| `pasty.item.on(fn)` | `(fn) → Unsubscribe` | Subscribe to item changes |
| `pasty.item.setTags(tags)` | `Verb` | Replace item tags |
| `pasty.item.addTags(tags)` | `Verb` | Append tags |
| `pasty.item.removeTags(tags)` | `Verb` | Remove tags |
| `pasty.item.setPinned(bool)` | `Verb` | Pin or unpin item |
| `pasty.item.setAttachments(p)` | `Verb` | Set attachment list |
| `pasty.item.setSearchExtension(p)` | `Verb` | Set search extension terms |

#### `pasty.item.attachment` — OptionalTopic\<AttachmentPayload\>

| Member | Shape | Description |
|---|---|---|
| `pasty.item.attachment.current()` | `() → AttachmentPayload \| undefined` | Current attachment payload |
| `pasty.item.attachment.on(fn)` | `(fn) → Unsubscribe` | Subscribe to payload changes |
| `pasty.item.attachment.invoke(buttonID, params?)` | `Verb` | Invoke an attachment action button |
| `pasty.item.attachment.onHostInvoke(fn)` | `(fn) → Unsubscribe` | Subscribe to host-dispatched action clicks |

#### `pasty.item.search` — OptionalTopic\<string[]\>

| Member | Shape | Description |
|---|---|---|
| `pasty.item.search.current()` | `() → string[] \| undefined` | Current search terms |
| `pasty.item.search.on(fn)` | `(fn) → Unsubscribe` | Subscribe to search term changes |

---

### `pasty.theme` — Topic\<PluginThemeTokenSnapshot\>

| Member | Shape | Description |
|---|---|---|
| `pasty.theme.current()` | `() → PluginThemeTokenSnapshot` | Read current theme tokens |
| `pasty.theme.on(fn)` | `(fn) → Unsubscribe` | Subscribe to theme changes |
| `pasty.theme.refresh()` | `Verb → PluginThemeTokenSnapshot` | Fetch latest snapshot from host |

---

### `pasty.action` — OptionalTopic\<ActionSession\> (action context only)

| Member | Shape | Description |
|---|---|---|
| `pasty.action.current()` | `() → ActionSession \| undefined` | Current action session |
| `pasty.action.on(fn)` | `(fn) → Unsubscribe` | Subscribe to session changes |
| `pasty.action.invoke(buttonID, opts?)` | `Verb` | Submit action with button ID |

#### `pasty.action.draft` — OptionalTopic\<Draft\>

| Member | Shape | Description |
|---|---|---|
| `pasty.action.draft.current()` | `() → Draft \| undefined` | Current draft state |
| `pasty.action.draft.on(fn)` | `(fn) → Unsubscribe` | Subscribe to draft changes |
| `pasty.action.draft.update(payload)` | `Verb` | Push draft update to host |

Calling `pasty.action.invoke` or `pasty.action.draft.update` from an attachment renderer context rejects with `PluginContextError`.

#### `PluginContextError`

```js
import { pasty } from '@pasty/plugin-sdk/ui';

try {
  await pasty.action.invoke('submit');
} catch (e) {
  if (e.name === 'PluginContextError') {
    // called from wrong context (e.g. attachment renderer)
  }
}
```

`PluginContextError` is re-exported from `@pasty/plugin-sdk/ui`:
```ts
import type { PluginContextError } from '@pasty/plugin-sdk/ui';
```

---

### `pasty.window`

| Member | Shape | Description |
|---|---|---|
| `pasty.window.setHeight(px)` | `Verb` | Set WebView height in pixels |
| `pasty.window.autoFit(opts?)` | `Verb → disposer` | Observe target for size changes and auto-report height. Returns a cleanup function. Options: `min`, `max`, `target` (defaults to `document.body`). |

---

### `pasty.clipboard`

| Member | Shape | Description |
|---|---|---|
| `pasty.clipboard.copyText(text)` | `Verb` | Copy text to system clipboard |

---

### `pasty.navigation`

| Member | Shape | Description |
|---|---|---|
| `pasty.navigation.openUrl(url)` | `Verb` | Open a URL |
| `pasty.navigation.revealInFinder(path)` | `Verb` | Reveal file path in Finder |
| `pasty.navigation.openFilePath(path)` | `Verb` | Open a file by path |

---

### `pasty.settings`

| Member | Shape | Description |
|---|---|---|
| `pasty.settings.get(key)` | `Verb → string \| null` | Read a plugin setting by key |
| `pasty.settings.getAll()` | `Verb → Record<string, string>` | Read all plugin settings |

---

## Types

All types are re-exported from both entries.

```ts
// From @pasty/plugin-sdk/runtime
import type { ClipboardItem, AttachmentPayload, Draft, ActionSession, PluginThemeTokenSnapshot } from '@pasty/plugin-sdk/runtime';
import type { ActionResultText, ActionResultNone, RendererResultSuccess, RendererResultFailure } from '@pasty/plugin-sdk/runtime';
import type { Ctx, Host, HostCapabilities, HostClipboard, HostItem, HostSettings, PluginDefinition } from '@pasty/plugin-sdk/runtime';

// From @pasty/plugin-sdk/ui
import type { ClipboardItem, AttachmentPayload } from '@pasty/plugin-sdk/ui';
```

## See also

- [SPECIFICATION.md](./SPECIFICATION.md) — API shape rules, mirror table, naming conventions, PR checklist
