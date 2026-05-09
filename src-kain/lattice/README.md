# Kain Lattice

Kain Lattice is the QML-like authoring lane for GreebleFS.

The name is intentional: Plasma is hot, free-flowing ionized matter; a lattice is the ordered structure on the other side. Lattice is where Kain turns GreebleFS UI, settings, panels, widgets, actions, and host models into declarative authorable packages.

## Goal

Make GreebleFS authorable without touching JavaScript for every UI or workflow change.

```text
Kain Lattice package
  -> components, properties, bindings, signals, actions
  -> host models from Rust/Tauron reflection
  -> semantic GreebleFS surfaces
  -> KainSemanticSurfaceHost
  -> trusted renderer/runtime output
```

## Plasma-Inspired Shape

- Plasma QML components become Kain Lattice components.
- Plasmoid package metadata becomes Kain Lattice package metadata.
- `Plasmoid.configuration` becomes Kain-owned config schemas and profile defaults.
- `Q_PROPERTY` / `Q_INVOKABLE` native services become Rust/Tauron reflected host models and actions.
- KCMs become Kain-authored Settings modules.
- KRunner providers become Kain-authored command/search/action providers.

## First Pass

The live app entrypoint still lives at `src-kain/app/main.kn`, which dispatches `greeblefs.lattice.catalog`.

This directory is the future authoring root for real packages:

- `greeblefs-shell-control/`
  First reference package for a KCM-style Settings module and shell-control applet.
- `greeblefs-panel-registry/`
  First real conversion package for built-in shell panel metadata. Panel identity, dock defaults, navigation groups, catalog ordering, icon slots, and host-model tags now resolve through `src/config/panelLatticeRegistry.ts`; React still owns trusted renderer functions in `src/panels/panelRegistry.tsx`.

This is not JSX generation. Kain owns the declarative object graph; GreebleFS owns trusted rendering, permissions, host execution, and fallbacks.

## First Live Mounts

`settings:kain-lattice-proof` and `applet:kain-runtime-status` are the first hand-authored Lattice surfaces mounted by the frontend. They prove the intended path:

```text
src-kain/lattice/greeblefs-shell-control/main.kn
  -> greeblefs.ui.scaffold surface metadata
  -> src/runtime/kainSemanticUiRuntime.ts registry
  -> src/components/kain/KainSemanticSurfaceHost.tsx
  -> src/components/kain/KainSemanticAppletStrip.tsx
  -> src/components/kain/KainUiRenderer.tsx
```

The settings module mounts to `settings.kain-ui`; the compact runtime applet mounts to `workbench.topbar.trailing`. Each surface declares package id, component id, mount slot, order, host models, and action ids as data. React does not know about either surface beyond the reusable semantic hosts.

## First Panel Migration

`greeblefs.lattice.panel-registry` is the first shell-system migration. It intentionally does not generate panel JSX yet. The current contract is:

```text
src-kain/lattice/greeblefs-panel-registry/main.kn
  -> src/config/panelLatticeRegistry.ts
  -> src/panels/panelRegistry.tsx
  -> IDE dock graph / classic panel catalog
```

Future passes should move panel interaction policy, native-window permissions, drag/drop rules, and renderer component contracts into the same descriptor package before replacing trusted React panel renderers.
