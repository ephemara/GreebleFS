# Kain UI Authoring

This folder is the first landing zone for Kain-authored GreebleFS UI surfaces.

The active app proof still dispatches through `src-kain/app/main.kn` because the resident bridge currently favors a self-contained entry file. The reusable vocabulary lives in `src-kain/stdlib/greeblefs/ui.kn`, and `kain_ui_scaffold.kn` shows the semantic shape future surfaces should emit.

## Contract

- Kain emits `greeblefs.ui.scaffold`.
- TypeScript normalizes it in `src/runtime/kainUiScaffold.ts`.
- React renders known primitives through `src/components/kain/KainUiRenderer.tsx`.
- Unknown fields stay harmless and additive.

## First Primitives

- `stack`: layout wrapper.
- `section`: maps to `SettingsSectionBlock`.
- `row`: maps to `SettingsRow`.
- `status-pill`: maps to `SettingsStatusPill`.
- `text`: compact semantic text.
- `button`: disabled scaffold for future action dispatch.

This is intentionally semantic UI IR, not generated JSX. Kain owns meaning and structure; the host owns trusted rendering, theme variables, permissions, and action dispatch.
