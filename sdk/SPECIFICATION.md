# Pasty Plugin SDK — Specification

## Chapter 1: API Shapes

The SDK exposes four first-class API shapes. Every public symbol belongs to exactly one shape.

### 1.1 Topic\<T\>

A Topic holds a current value and notifies listeners when it changes.

```
topic.current()            → T          read current value synchronously
topic.on(listener)         → Unsubscribe  register a change listener; returns unsub fn
```

Use a Topic when the plugin needs to both read the current value and react to future changes (e.g. `pasty.item`, `pasty.theme`).

### 1.2 OptionalTopic\<T\>

Like Topic but the value may be absent until the host provides it.

```
topic.current()            → T | undefined
topic.on(listener)         → Unsubscribe
```

Use an OptionalTopic when a value is context-dependent and may never be set in the current run (e.g. `pasty.item.attachment` in an action context, `pasty.action` in an attachment renderer context).

### 1.3 Stream\<T\>

A Stream has no current value; it only fans out discrete events to listeners.

```
stream.on(listener)        → Unsubscribe
```

Use a Stream for one-shot or repeated events with no persistent state (e.g. `pasty.item.attachment.onHostInvoke`).

### 1.4 Verb

A Verb is an async function that triggers a side-effect or host operation.

```
verb()                     → Promise<Result>
verb(args)                 → Promise<Result>
```

Verbs that are illegal in the current context (e.g. calling `pasty.action.invoke` from an attachment renderer) reject immediately with `PluginContextError`.

### 1.5 Applicability Decision Flow

```
Does the value have persistent state the plugin can read synchronously?
  No  → Stream (events only)
  Yes → Does it exist in every context this module loads in?
          Yes → Topic
          No  → OptionalTopic

Is this a side-effect/operation rather than state?
  Yes → Verb
```

---

## Chapter 2: Capability Mirror Table

Every host capability available via the runtime `ctx.host.*` API has a matching entry in the UI `pasty.*` namespace. The table below lists the current set.

| Capability | Runtime (ctx.host) | UI (pasty) | Notes |
|---|---|---|---|
| Read clipboard item | `ctx.host` input param | `pasty.item.current()` | Topic |
| Subscribe item changes | — | `pasty.item.on(fn)` | Topic |
| Set tags | `ctx.host.item.setTags(tags)` | `pasty.item.setTags(tags)` | Verb |
| Add tags | `ctx.host.item.addTags(tags)` | `pasty.item.addTags(tags)` | Verb |
| Remove tags | `ctx.host.item.removeTags(tags)` | `pasty.item.removeTags(tags)` | Verb |
| Pin/unpin | `ctx.host.item.setPinned(bool)` | `pasty.item.setPinned(bool)` | Verb |
| Set attachments | `ctx.host.item.setAttachments(p)` | `pasty.item.setAttachments(p)` | Verb |
| Set search extension | `ctx.host.item.setSearchExtension(p)` | `pasty.item.setSearchExtension(p)` | Verb |
| Attachment payload | `input.attachment.payloadJson` | `pasty.item.attachment.current()` | OptionalTopic |
| Invoke attachment action | — | `pasty.item.attachment.invoke(id, params)` | Verb |
| Host-side action click | — | `pasty.item.attachment.onHostInvoke(fn)` | Stream |
| Search terms | — | `pasty.item.search.current()` | OptionalTopic |
| Theme snapshot | via `getThemeSnapshot` host sync | `pasty.theme.current()` | Topic |
| Theme refresh | — | `pasty.theme.refresh()` | Verb |
| Theme change | — | `pasty.theme.on(fn)` | Topic |
| Window height | — | `pasty.window.setHeight(px)` | Verb |
| Auto-fit height | — | `pasty.window.autoFit({min,max,target})` | Verb (returns disposer) |
| Action session | `ctx.host` input param | `pasty.action.current()` | OptionalTopic (action ctx only) |
| Draft | `input.draft` | `pasty.action.draft.current()` | OptionalTopic |
| Update draft | — | `pasty.action.draft.update(payload)` | Verb |
| Run action | — | `pasty.action.invoke(buttonID)` | Verb |
| Materialize image path | `ctx.host.item.materializeImagePath()` | — | Verb; runtime only. Copies image bytes to a stable temp file and returns the path. Idempotent — repeated calls return the same path. |
| Read attachment | `ctx.host.item.readAttachment(type, key)` | — | Verb; runtime only. Returns the `payloadJson` string for the named attachment, or `null` if absent. |
| Allocate image temp path | `ctx.host.action.allocateImageTempPath(formatHint?)` | — | Verb; runtime only (action handlers). Allocates a unique temp path for writing an image result. The path is consumed by `scope.consumeAllocatedImage` and cleaned up with the invocation scope. |
| Copy text | `ctx.host.clipboard.copyText(t)` | `pasty.clipboard.copyText(t)` | Verb (stub) |
| Open URL | `ctx.host.navigation.openUrl(url)` | `pasty.navigation.openUrl(url)` | Verb (stub) |
| Reveal in Finder | — | `pasty.navigation.revealInFinder(path)` | Verb (stub) |
| Open file | — | `pasty.navigation.openFilePath(path)` | Verb (stub) |
| Settings get | `ctx.host.settings.get(key)` | `pasty.settings.get(key)` | Verb (stub) |
| Settings get all | — | `pasty.settings.getAll()` | Verb (stub) |

Entries marked **stub** are wired to `callHostSync` but the corresponding host-side router method has not been implemented yet. They silently return `null` in the current host version.

---

## Chapter 3: Process for Adding New Capabilities

Adding a new host capability requires changes in both the SDK and the host. Follow these steps:

1. **Spec the shape.** Decide whether the capability is a Topic, OptionalTopic, Stream, or Verb (Chapter 1). Document it in Chapter 2's mirror table.

2. **Add the TypeScript interface.** Add a method signature to `src/runtime/types/ctx.ts` (for runtime) and/or create/update a module in `src/ui/modules/` (for UI).

3. **Write a failing test first.** Add a test in `sdk/tests/ui/` or `sdk/tests/runtime/` that exercises the new capability with a mock host.

4. **Implement the SDK side.** Wire the method to `callHostSync` or `postMessage` with the appropriate handler name.

5. **Run `npm run build:sdk` from `plugins/template-plugin/`** and confirm the tests pass.

6. **Update the surface snapshot.** Run `SNAPSHOT_UPDATE=1 node --test sdk/tests/surface/snapshot.test.cjs` and commit the new golden file.

7. **Reference this specification.** In the PR description, cite the chapter and section number that justifies the naming and shape choice.

---

## Chapter 4: Naming Rules

### 4.1 Module namespaces

Top-level namespaces on `pasty.*` mirror the host capability domain:
- `pasty.item` — clipboard item data and mutations
- `pasty.theme` — appearance tokens
- `pasty.action` — draft action session and controls
- `pasty.window` — WebView layout (height, auto-fit)
- `pasty.clipboard` — system clipboard write
- `pasty.navigation` — navigation and file operations
- `pasty.settings` — plugin settings read access

### 4.2 Method names

- Topics: `current()` to read, `on(fn)` to subscribe (matches Vue's reactive conventions)
- Verbs: imperative verb in camelCase: `setTags`, `addTags`, `removeTags`, `setPinned`, `invoke`, `refresh`, `update`
- Streams: `onHostInvoke` — `on` prefix + noun phrase

### 4.3 Forbidden patterns

- No `get` prefix on Topics (use `current()` instead)
- No `subscribe` — use `on()`
- No `dispatch` — use `emit()` internally, `invoke()` or named verbs externally
- No `bridge` in public names — that's an implementation detail

### 4.4 Error naming

Context errors throw `PluginContextError` (exported from `@pasty/plugin-sdk/ui`). All other SDK errors use `Error` with descriptive messages prefixed `[pasty-sdk]`.

---

## Chapter 5: PR Checklist

Before merging any PR that touches `sdk/`:

- [ ] New capability is documented in Chapter 2 mirror table
- [ ] TypeScript types added to `ctx.ts` and/or module interface
- [ ] Failing test written first (TDD), then implementation
- [ ] `npm run build` passes in `sdk/`
- [ ] `npm test` passes in `sdk/` (runtime + ui + surface)
- [ ] Surface snapshot updated with `SNAPSHOT_UPDATE=1` and golden files committed
- [ ] No references to host-internal paths, WebKit handler names, or host implementation class names in any `*.md` file under `sdk/` (run the doc-grep CI step to verify)
- [ ] PR description cites the SPECIFICATION.md chapter number justifying shape choice
- [ ] `npm test` passes in `plugins/template-plugin/` (template plugin integration tests)
