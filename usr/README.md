# GreebleFS `usr`

`usr/` is the shipped authoring root for runtime-discovered content plus the canonical first-run settings baseline.

## Layout

- `usr/manifest.json`
  Source of truth for every managed-content lane and whether it is `shared-root` or `profile-overlay`.
- Top-level `usr/<lane>`
  Shared-root authored content. These lanes stay global across profiles.
- `usr/profiles/shared/settings.json`
  Canonical shared settings slices. These are machine-global or app-global defaults.
- `usr/profiles/default/settings.json`
  Canonical profile-local settings baseline. These are the first-run workbench defaults.
- `usr/profiles/default/<lane>`
  Canonical shipped profile-overlay content such as top bars, menu packs, explorer layouts, hotkeys, and performance manifests.
- `usr/profiles/variants.json`
  Named seed variations for creating new profiles from a stable baseline instead of from the current live state.

## Ownership Rules

- If a lane is `shared-root`, ship and author it directly under top-level `usr/<lane>`.
- If a lane is `profile-overlay`, ship the default authored content under `usr/profiles/default/<lane>`.
- Shared settings slices belong in `usr/profiles/shared/settings.json`.
- Profile-local settings slices belong in `usr/profiles/default/settings.json`.
- Do not fork first-run defaults inside a second ad hoc JSON file. The shipped profile settings files are the canonical defaults.

## Current Settings Pipeline

1. `usr/profiles/shared/settings.json` and `usr/profiles/default/settings.json` define the shipped first-run baseline.
2. `src/config/usrDefaultSettings.ts` imports those files and builds the effective canonical default snapshot for the frontend.
3. `src/store/settingsStore.ts` uses that shipped snapshot as the canonical `defaultSettings`, with the old hardcoded object retained only as a normalization-safe fallback layer.
4. `src-tauri/src/usr_profiles.rs` remains the authority for splitting and persisting shared-vs-profile settings at runtime.

## Variations

- `canonical-default`
  Mirrors the shipped baseline exactly.
- `focused-authoring`
  Dense, quieter authoring defaults.
- `review-presentation`
  Preview-first demo and browsing defaults.
- `minimal-low-motion`
  Reduced motion and shell noise.

These are seed templates for new profiles. They should stay partial and override only the slices they intentionally change.
