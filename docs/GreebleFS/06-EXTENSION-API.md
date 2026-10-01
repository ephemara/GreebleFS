# GreebleFS Extension API (`greeblefs`)

> Contract version: **1.0.0** (`GREEBLE_API_VERSION = 1`, `src/api/greeble.ts`).
> Status: **contract-complete, runtime integration in progress** — see
> [Integration status](#integration-status) before you ship anything.

One TypeScript module, one factory, no manifest files. Every extension —
plugin, theme, workbench, script — speaks the same contract:

```tsx
// usr/plugins/xmb/index.tsx
import type { GreebleHarness } from 'greeblefs';

export default function (fs: GreebleHarness) {
  fs.registerCommand({
    id: 'xmb-next',
    title: 'Next',
    run: (_args, ctx) => ctx.explorer.open(ctx.explorer.selection().paths[0]),
  });

  fs.registerViewMode({
    id: 'xmb-row',
    title: 'XMB Row',
    appliesTo: { isDirectory: true },
    component: ({ data, ctx }) => <XmbRow entries={data} ctx={ctx} />,
  });

  fs.on('file:before-open', event =>
    event.size > 2_000_000 ? { block: true, reason: 'too large for XMB' } : undefined,
  );
}
```

## Philosophy

Modelled on a coding-agent extension surface. Four rules, do not break them:

1. **Registration is a verb.** Extensions call `fs.registerX()` at load time.
   There is no `extension.toml`, no JSON contribution block. The code *is*
   the manifest.
2. **Context is injected.** Handlers receive a capability bag (`ctx`), not a
   pile of imports. The host decides what each extension may touch.
3. **The core never changes.** New domains, events, capabilities, and context
   slices are added by *declaration merging* (see below).
4. **One registry primitive.** Every domain is a `GreebleRegistry<T>`; adding
   a domain never touches the registry implementation.

## Layout (`src/api/`)

| File | Role |
| --- | --- |
| `greeble.ts` | **The public contract.** All types, the domain catalog, the harness interface. All declaration-merging targets live here. |
| `registry.ts` | The one registry primitive + the domain book `define()`. |
| `events.ts` | The lifecycle spine + the namespaced inter-extension bus. |
| `host.ts` | `createGreebleHarness()` — binds host capabilities to a live harness. |
| `index.ts` | Barrel. Host code imports here; authors import `'greeblefs'`. |

## Registration verbs

Every verb writes into a typed registry and returns a `GreebleHandle`;
`dispose()` withdraws it (hot reload = clean replace, not accumulation).

```ts
// Look & feel
fs.registerShell | registerTheme | registerIconTheme | registerSoundPack
fs.registerShader | registerMotion | registerAnimation | registerHomePack
fs.registerMenuPack | registerLayout | registerFont
// Explorer surface
fs.registerViewMode | registerPreviewLane | registerExplorerWidget | registerActivityLane
// Behaviour
fs.registerCommand | registerAction | registerActionPack | registerContextMenuItem
fs.registerHotkey | registerWorkflow
// Shell & services
fs.registerPanel | registerSettingsSlot | registerProvider | registerTool
// Escape hatch — works for ANY domain, known or not
fs.register(domain, entry)
```

Registries are observable: `registry.list()` snapshots, `registry.subscribe()`
fires on mutation, `registry.version()` is a monotonic counter for re-render.

## Events

```ts
fs.on(event, handler, { priority })   // higher priority runs first
```

Handlers may return:

```ts
{ patch: Partial<Payload> }   // merged for the next handler
{ block: true, reason }       // cancels the operation (before-events only)
```

Shipped events:

```
app:start  app:shutdown  profile:load  module:load  module:unload
file:before-open  file:after-open  file:before-write  file:after-write
explorer:selection-changed  explorer:directory-changed
explorer:before-action  explorer:after-action
context-menu:build  command:invoke
preview:resolve  view:resolve  theme:resolve
```

## Inter-extension bus

```ts
fs.events.on('workbench-pdf:rendered', payload => { ... });
fs.events.emit('workbench-pdf:rendered', { pages: 12 });
```

Channels **must** be namespaced (`name:event`).

## Capabilities & identity

The host grants each extension a capability set; the harness refuses
capability-bearing calls that were not granted:

```
fs:read  fs:write  fs:watch  index:query  process:spawn  net:fetch
shell:panel  shell:chrome  ui:overlay  ui:notify
storage:read  storage:write  settings:write  theme:override
```

Authors may introduce namespaced capabilities; the host decides whether to
honour them. `GreebleHarness.apiVersion` is checked at load — unknown future
domains degrade gracefully instead of throwing.

## Persistence (crash-safe scratch)

```ts
fs.appendEntry('last-focus', path);      // survives reload, never sent anywhere
const last = fs.getEntry<string>('last-focus');
```

## Extending the API (no core edits)

Add a domain, event, or context slice with declaration merging:

```ts
import type { GreebleContribution, GreebleContext } from 'greeblefs';

interface GreebleVisualizerContribution extends GreebleContribution {
  title: string;
  paint(frame: number): ReactNode;
}

declare module 'greeblefs' {
  interface GreebleDomainCatalog {
    visualizer: GreebleVisualizerContribution;
  }
  interface GreebleEventMap {
    'xmb:beat': { track: string; bpm: number };
  }
  interface GreebleContext {
    xmb: { play(track: string): void };
  }
}
```

Now `fs.register('visualizer', { id, title, paint })` is typed,
`fs.on('xmb:beat', …)` fires, and `ctx.xmb.play(...)` is available —
without touching `src/api/*`.

## Host integration

The host owns **one** `GreebleDomainBookImpl`, **one**
`GreebleEventSpineImpl`, and **one** `GreebleExtensionBusImpl` for the whole
app. Per extension:

```ts
const harness = await runGreebleExtension(module.default, {
  identity,
  book,
  spine,
  bus,
  entries,
  buildContext: () => contextFor(identity),
});
// on unload / hot reload:
harness.dispose();   // releases handles + sweeps the owner's contributions
```

## Authoring an API theme

Drop a `theme.greeble.tsx` factory in `usr/themes/<id>/` — discovered
automatically, independent of `theme.json`. Tokens become CSS vars;
`extends` names a built-in baseline; edits hot-reload:

```tsx
import { defineGreebleExtension } from 'greeblefs';

export default defineGreebleExtension((fs) => {
  fs.registerTheme({
    id: 'xmb',
    title: 'XMB',
    extends: 'github-dark',
    tokens: { accent: '#2e9bff', appBackground: '#0b0b14' },
  });
});
```

Live examples: `usr/themes/xmb`, `usr/themes/wii`, `usr/themes/finder`.
The theme appears in Settings → Theme Suite next to JSON packs and
applies to the main window, dock/secondary windows, and the mobile app.

## Integration status

| Piece | State |
| --- | --- |
| Contract, registries, event spine, bus, host binding | ✅ Done (`src/api/*`) |
| Unit tests (`src/test/greebleApi.test.ts`, 14 tests) | ✅ Passing |
| `greeblefs` virtual module in both transpiler import maps (`pluginRuntime`, `themeRendererRuntime`) | ✅ Done — TSX can import the contract at runtime |
| Legacy `definePlugin` / `extension.toml` shimmed onto the new verbs | ✅ Done (`greeblePluginShim`: loaded packs adopt as panel + preview-lane + settings-slot + workflow, live host providers from App, withdraw on unload, `greeblePluginShim.test.ts`) |
| Theme domain backed by a real renderer path (`greebleThemeBridge`: registry → definitions → ThemeCatalog/apply/CSS) | ✅ Done + runtime-tested (`greebleThemeBridge.test.ts`) |
| Legacy `defineThemeRenderer` TSX shimmed onto `registerShell` | ✅ Done (`greebleLegacyShim`: loaded packs adopt as API shells, live host from App, withdraw on unload) |
| `previewLane` backed by descriptor bridge + merged into preview resolution (`greebleLaneBridge` + App merge; adapted components render degraded-real) | ✅ Done + tested (`greebleLaneBridge.test.ts`) |
| `viewMode` backed by descriptor bridge (registry-listed, `api-*` ids outside the closed union; switch-UI merge needs a custom-mode-aware consumer) | ✅ Bridge done, consumer TODO |
| Factory modules (`*.greeble.tsx` via `defineGreebleExtension`): load, run, owner-tracked reload (`greebleFactory` + `greebleContext` w/ real paths/storage/log/events, honest stubs) | ✅ Done + tested (`greebleFactory.test.ts`) |
| Theme discovery runs factory packs (`theme.greeble.tsx` per dir, independent of `theme.json`) | ✅ Done |
| Flagship API-native token themes: XMB, Wii Menu, Finder (`usr/themes/*/theme.greeble.tsx`) | ✅ Done — visible in catalog via bridge |
| Content watcher loop (backend single-slot watch + debounced factory reload + catalog refresh, main window owns it) | ✅ Done, no Rust changes (`greebleWatch.ts`) |
| Remaining domains (explorer-widget, activity-lane, …) backed by real renderers | ⬜ TODO |
| Multi-root watch + API shell host (render book shells structurally) | ⬜ TODO |
