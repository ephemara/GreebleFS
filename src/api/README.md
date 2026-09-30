# GreebleFS Extension API

The single contract every extension — plugin, theme, workbench, script — speaks.
One TypeScript module, one factory, no manifest files.

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

Modelled on the pi coding agent's extension surface. Three rules:

1. **Registration is a verb.** Extensions call `fs.registerX()` at load time.
   There is no `extension.toml`, no JSON contribution block. The code *is* the
   manifest.
2. **Context is injected.** Handlers receive a capability bag (`ctx`), not a
   pile of imports. The host decides what each extension may touch.
3. **The core never changes.** New domains, events, capabilities, and context
   slices are added by declaration merging.

## Layout

| File | Role |
| --- | --- |
| `greeble.ts` | **The public contract.** All types, the domain catalog, the harness interface. All declaration-merging targets live here. |
| `registry.ts` | The one registry primitive + the domain book `define()`. |
| `events.ts` | The lifecycle spine + the namespaced inter-extension bus. |
| `host.ts` | `createGreebleHarness()` — binds host capabilities to a live harness. |
| `index.ts` | Barrel. Host code imports here; authors import `'greeblefs'`. |

## The harness

`fs.register*` writes into a typed registry. Every verb returns a
`GreebleHandle`; `dispose()` withdraws it.

```ts
fs.registerShell | registerTheme | registerIconTheme | registerSoundPack
fs.registerShader | registerMotion | registerAnimation | registerHomePack
fs.registerMenuPack | registerLayout | registerFont
fs.registerViewMode | registerPreviewLane | registerExplorerWidget | registerActivityLane
fs.registerCommand | registerAction | registerActionPack | registerContextMenuItem
fs.registerHotkey | registerWorkflow
fs.registerPanel | registerSettingsSlot | registerProvider | registerTool
fs.register(domain, entry)   // escape hatch — works for ANY domain, known or not
```

## The event spine

```ts
fs.on(event, handler, { priority })   // higher priority runs first
```

Handlers may return:

```ts
{ patch: Partial<Payload> }   // merged for the next handler
{ block: true, reason }       // cancels the operation (before-events)
```

Shipped events: `app:start`, `app:shutdown`, `profile:load`, `module:load`,
`module:unload`, `file:before-open`, `file:after-open`, `file:before-write`,
`file:after-write`, `explorer:selection-changed`, `explorer:directory-changed`,
`explorer:before-action`, `explorer:after-action`, `context-menu:build`,
`command:invoke`, `preview:resolve`, `view:resolve`, `theme:resolve`.

## Inter-extension bus

```ts
fs.events.on('workbench-pdf:rendered', payload => { ... });
fs.events.emit('workbench-pdf:rendered', { pages: 12 });
```

Channels must be namespaced (`name:event`).

## Persistence

```ts
fs.appendEntry('last-focus', path);      // survives reload, never sent to the model
const last = fs.getEntry<string>('last-focus');
```

## Extending the API

Add a domain, event, or context slice with declaration merging. **The core is
never edited.** This is the entire extensibility story:

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

Now `fs.register('visualizer', { id, title, paint })` is typed, `fs.on('xmb:beat', …)`
fires, and `ctx.xmb.play(...)` is available — without touching `src/api/*`.

## Host integration

The host owns **one** `GreebleDomainBookImpl` and **one** `GreebleEventSpineImpl`
for the whole app, plus a `GreebleExtensionBusImpl`. Per extension:

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
harness.dispose();
```

`dispose()` releases every handle and sweeps the domain book for that owner, so
hot reload is a clean replace, not an accumulation.

## Status

- [x] Contract, registries, event spine, bus, host binding, tests
- [x] `greeblefs` virtual module in both transpiler import maps
  (`pluginRuntime`, `themeRendererRuntime`)
- [x] Theme domain backed by a real renderer path (`greebleThemeBridge`, runtime-tested)
- [x] Legacy `definePlugin` / `extension.toml` shimmed onto the new verbs
  (`greeblePluginShim`, tested: panel + lane + slot + workflow adopt, idempotent re-adopt, withdraw)
- [x] Legacy `defineThemeRenderer` TSX shimmed onto `registerShell`
  (`greebleLegacyShim`, runtime-tested against the real toon pack)
- [x] `previewLane` + `viewMode` backed by descriptor bridges (`greebleLaneBridge`: registry → legacy lane / view-mode definitions + reactive hooks; App/registry merge still TODO)
- [ ] Remaining domains (explorer-widget, activity-lane, …) backed by real renderers
- [ ] Rust watcher re-runs factories on file change (hot reload end to end)
