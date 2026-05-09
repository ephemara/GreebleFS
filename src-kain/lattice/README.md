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

This is not JSX generation. Kain owns the declarative object graph; GreebleFS owns trusted rendering, permissions, host execution, and fallbacks.

## First Live Mount

`settings:kain-lattice-proof` is the first hand-authored Lattice surface mounted by the frontend. It proves the intended path:

```text
src-kain/lattice/greeblefs-shell-control/main.kn
  -> greeblefs.ui.scaffold surface metadata
  -> src/runtime/kainSemanticUiRuntime.ts registry
  -> src/components/kain/KainSemanticSurfaceHost.tsx
  -> src/components/kain/KainUiRenderer.tsx
```

The surface declares package id, component id, host models, and action ids as data. React does not know about the module beyond the reusable semantic host.
