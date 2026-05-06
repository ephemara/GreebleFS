---
name: greeblefs-usr-default-settings
description: Use when changing GreebleFS canonical first-run settings, usr profile seed variants, or the Settings > Profiles defaults flow. Covers usr/profiles/shared/settings.json, usr/profiles/default/settings.json, usr/profiles/variants.json, src/config/usrDefaultSettings.ts, src/config/usrProfileSettingsVariants.ts, src/store/settingsStore.ts, and the profile-creation UI/runtime path.
---

# GreebleFS Usr Default Settings

Use this skill when the task is about canonical shipped defaults, profile-seeded defaults, or cleaning up the `usr/` settings contract.

## Core Model

- `usr/profiles/shared/settings.json`
  Owns shared-machine or shared-app default slices.
- `usr/profiles/default/settings.json`
  Owns profile-local first-run defaults for the shipped baseline profile.
- `usr/profiles/variants.json`
  Owns named seed variations for creating new profiles from stable baselines.
- `src/config/usrDefaultSettings.ts`
  Frontend bridge that imports the shipped shared + default profile JSON and builds the effective canonical default snapshot.
- `src/config/usrProfileSettingsVariants.ts`
  Loader/normalizer for named profile seed variants.
- `src/store/settingsStore.ts`
  Hydrates `defaultSettings` from the shipped `/usr` snapshot on top of a fallback normalization object. Treat the fallback object as compatibility scaffolding, not the preferred authoring surface for product defaults.

## Editing Rules

1. Author intentional product defaults in `/usr` JSON first.
2. Put shared slices in `usr/profiles/shared/settings.json`; put profile-owned slices in `usr/profiles/default/settings.json`.
3. Keep `usr/profiles/variants.json` partial. Each variant should override only the slices it intentionally changes.
4. Keep variant ids stable once shipped; the Settings UI and tests key off those ids.
5. If you add or change a default that affects import/reset/profile creation, verify omitted sections still preserve the shipped base state. Do not let partial imports silently snap back to generic anchors.

## UI / Runtime Touchpoints

- `src/App.tsx`
  Owns profile creation from variant ids and seeds the new profile with merged canonical defaults plus variant overrides.
- `src/components/SettingsPage.tsx`
  Passes the variant catalog and creation callbacks into the profiles section.
- `src/components/settings/sections/ProfilesSettingsSection.tsx`
  Renders the `Canonical Variations` cards and profile actions.

## Validation

Run the focused defaults/profile suite:

```powershell
bunx vitest run src/test/usrProfileDefaults.test.ts src/test/settingsStore.test.ts src/test/profilesSettingsSection.test.tsx --reporter=dot
```

Run the focused Settings page profiles smoke:

```powershell
bunx vitest run src/test/settingsPage.behavior.test.tsx -t "renders the dedicated profiles section" --reporter=dot
```

## Documentation To Keep In Sync

- `usr/README.md`
- `ARCHITECTURE.md`
- `memory.md`
