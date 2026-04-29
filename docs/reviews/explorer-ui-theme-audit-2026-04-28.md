# Explorer + UI Theme Audit (2026-04-28)

## Scope

- Scanned `src/components/**` with focus on `SettingsPage.tsx`, `src/components/settings/**`, `FileExplorer.tsx`, and `src/components/explorer/**`.
- Used repo-local heuristics for:
  - duplicated helpers and primitives
  - inline `style={{...}}` density
  - literal visual values (`rgba(...)`, `#hex`, `color-mix(...)`)
  - direct `appearance.theme.palette.*` composition in JSX
  - adoption of shared seams such as `AppIcons`, `OverlayScrollArea`, `SettingsPrimitives`, `SettingsShell`, and named interaction-motion surfaces

## Healthy Shared Seams

- `src/components/AppIcons.tsx` is the only `lucide-react` import site, so icon theming is already centralized.
- `OverlayScrollArea` is broadly adopted across explorer and workbench lanes.
- `FileExplorer.tsx:4660-4710` routes preview workflow tabs through the named `previewWorkflowTab` motion surface.
- `ExplorerSideRail.tsx:284-308` binds rail rows to the named `explorerRailItem` motion surface.
- `SettingsShell`, `SettingsPrimitives`, and the extracted section modules are the right architectural direction.

## Highest-Value Findings

### 1. `SettingsPage.tsx` still duplicates shared settings primitives

- `src/components/SettingsPage.tsx:432-452` defines a local `ThemeBadge`.
- `src/components/settings/SettingsPrimitives.tsx:247-259` already defines the same `ThemeBadge`.
- `src/components/SettingsPage.tsx:454-505` and `618-760` also duplicate settings-context-menu preview helpers that are redefined again in `src/components/settings/sections/ContextMenusSettingsSection.tsx:101-167` and `169-360`.

Why this matters:

- Settings visual grammar already has a primitive layer, but `SettingsPage.tsx` still carries page-local copies.
- Any future badge, menu-preview, or icon rendering change now has two owners and will drift.

Recommended extraction:

- Move the shared context-menu preview helpers into `src/components/settings/SettingsPrimitives.tsx` or a dedicated `src/components/settings/ContextMenuPreviewPrimitives.tsx`.
- Delete the duplicated `ThemeBadge` and `renderSettingsContextMenuIcon` from `SettingsPage.tsx`.

### 2. `SettingsPage.tsx` is still a mixed-owner god component instead of a shell/orchestrator

- The page still renders large inline section bodies for:
  - `overview` at `src/components/SettingsPage.tsx:9191`
  - `models` at `src/components/SettingsPage.tsx:9427`
  - `appearance-packs` at `src/components/SettingsPage.tsx:10374`
  - `theme-recipes` at `src/components/SettingsPage.tsx:10435`
  - `theme-engines` at `src/components/SettingsPage.tsx:10495`
  - `shell-renderers` at `src/components/SettingsPage.tsx:10555`
  - `top-bars` at `src/components/SettingsPage.tsx:10616`
  - `wallpapers` at `src/components/SettingsPage.tsx:10938`
  - `shaders` at `src/components/SettingsPage.tsx:11465`
  - `animations` at `src/components/SettingsPage.tsx:12017`
  - `hotkeys` at `src/components/SettingsPage.tsx:13209`
  - `terminal` at `src/components/SettingsPage.tsx:13592`
  - `layouts` at `src/components/SettingsPage.tsx:14060`
  - `explorer` at `src/components/SettingsPage.tsx:14942`
  - `home` at `src/components/SettingsPage.tsx:15671`
  - `cloud` at `src/components/SettingsPage.tsx:16140`
  - `mobile` at `src/components/SettingsPage.tsx:16618`
  - `audio` at `src/components/SettingsPage.tsx:17637`
  - `screenshots` at `src/components/SettingsPage.tsx:18242`
  - `theme-json` at `src/components/SettingsPage.tsx:18527`
- Only a smaller subset has been extracted into section modules:
  - `appearance` at `src/components/SettingsPage.tsx:10339-10371`
  - `icons` near `src/components/SettingsPage.tsx:10896`
  - `layout-dynamics` near `src/components/SettingsPage.tsx:13182`
  - `system` at `src/components/SettingsPage.tsx:14268-14330`
  - `context-menus` near `src/components/SettingsPage.tsx:15499`
  - `plugins` near `src/components/SettingsPage.tsx:18602`
- `src/components/SettingsPage.tsx:1781-1935` also contains a generic `ThemeBundlePackSettingsSection` helper that looks reusable but still lives inside the page and ships its own button/badge/card language.

Why this matters:

- The settings architecture exists, but most of the page still bypasses it.
- `SettingsPage.tsx` remains hard to theme, hard to review, and easy to regress.

Recommended extraction:

- Keep `SettingsPage.tsx` as data/orchestration only.
- Move the remaining inline sections into `src/components/settings/sections/*.tsx`.
- Promote `ThemeBundlePackSettingsSection` into a shared settings-section primitive instead of leaving it page-local.

### 3. Explorer is theme-aware, but its control language is still not shared

- `src/components/FileExplorer.tsx:3112-3305` defines local glyph and chip styling for layout/view/experimental-mode affordances.
- `src/components/explorer/ExplorerSideRail.tsx:2925-3315` defines its own dismiss buttons, feedback shells, pills, retry buttons, row chrome, tree buttons, and toggle chips.
- `src/components/explorer/ExplorerWorkspace.tsx:2683-2835` defines a third family of pane switcher chips, workspace tab chips, pane action buttons, and overflow menu rows.

Why this matters:

- These surfaces mostly use explorer CSS vars, so they are theme-aware.
- They are still ad hoc because the same chip/button/pill/menu patterns have different implementations in three explorer files.
- Themeability is only half-finished here; token usage exists, but shared ownership does not.

Recommended extraction:

- Add `src/components/explorer/ExplorerControlPrimitives.tsx`.
- Route common explorer controls through one shared family:
  - chips
  - segmented groups
  - pill badges
  - icon buttons
  - overflow menu rows
  - inline status/feedback banners
- Back missing visual knobs with `src/config/explorerTheme.ts`.

### 4. Several explorer sub-surfaces are still fully bespoke UI islands

- `src/components/explorer/ExplorerActionRunCenterContent.tsx:42-95` ships its own button and card chrome with raw `rgba(...)` values.
- `src/components/explorer/ExplorerActionsPane.tsx:165-260` paints a complete pane header, state chip, and close-button family locally.
- `src/components/explorer/ExplorerDragOverlay.tsx:253-380` and `src/components/explorer/ExplorerCustomizeDragOverlay.tsx:80-180` each author their own glass-card drag-preview shell.

Why this matters:

- These are explorer-facing surfaces, but they do not compose through shared explorer pane or overlay primitives.
- The drag/preview/action-center language will drift separately from the main explorer chrome.

Recommended extraction:

- Introduce shared explorer primitives for:
  - pane headers
  - action cards
  - drag-preview cards
  - inline CTA buttons

### 5. Some settings sections still bypass the semantic settings-control system

- `src/components/settings/sections/AppearanceSettingsSection.tsx:145-189`
  - raw buttons instead of `SettingsActionButton`
  - hardcoded warning/error colors like `#7f1d1d`, `#854d0e`, and raw `rgba(...)`
- `src/components/settings/sections/IconSettingsSection.tsx:149-190`
  - raw buttons instead of `SettingsActionButton`
  - local loading/error/warning banners instead of a reusable settings notice primitive

Why this matters:

- These sections already live in the correct folder, but their inner control grammar still bypasses the shared settings-control lane.

Recommended extraction:

- Add a reusable `SettingsNotice` primitive for info, warning, and danger states.
- Add shared action-button variants instead of open-coded border/background pairs in each section.

### 6. The context-menu settings section still owns a second copy of the preview runtime

- `src/components/settings/sections/ContextMenusSettingsSection.tsx:169-360` re-implements:
  - `getContextMenuPreviewPathKey`
  - `resolveContextMenuPreviewPanels`
  - `ExplorerContextMenuPreviewPanels`
- `src/components/SettingsPage.tsx:618-760` carries the same logic again.

Why this matters:

- This is direct duplicated behavior, not just similar styling.
- It is the clearest “not shared” issue in the settings area after `ThemeBadge`.

Recommended extraction:

- Pick one owner for the settings-side context-menu preview renderer and delete the other copy.

### 7. Several preview/editor workbenches still carry local accent languages

- `src/components/ExplorerImageEditor.tsx:125-145` hardcodes primary and danger button colors.
- `src/components/ExplorerVideoEditor.tsx:1393-1416` hardcodes the extract-audio CTA colors.
- `src/components/ExplorerAudioWorkbench.tsx:192-193`, `285`, `1521`, `1812`, `2208` mixes hardcoded alert/highlight colors into status-chip and waveform controls.
- `src/components/ExplorerDocxWorkbench.tsx` still contains file-local CSS var fallbacks and several raw `rgba(...)` values.

Why this matters:

- These workbenches live inside the explorer preview system, but their controls still feel like local mini-app styling.

Recommended extraction:

- Add preview-lane control/status tokens for:
  - primary CTA
  - warning/danger CTA
  - status chips
  - inspector cards
  - empty-state banners

## UI-Wide Secondary Hotspots

- `src/components/AppModal.tsx:242-345`
  - still a local modal/button system
  - should graduate into a workbench-wide control and notice primitive layer
- `src/components/MobileShareQrDialog.tsx:100-170`
  - still a palette-fed inline card/action surface
  - explicitly matches the cleanup target already called out in the UI-system reference map
- `src/components/CommandPalette.tsx:129-170`
  - composes directly from raw palette fields rather than a dedicated command-palette surface primitive
- `src/components/GitManager.tsx:110-125`
  - builds a local `palette` object directly from `appearance.theme.palette.*` and then paints the whole surface from it
- `src/components/TerminalOverlay.tsx:144-180`
  - keeps its own `Theme` adapter and chrome language instead of reusing shared workbench control primitives

## Heuristic Hotspot Ranking

The following ranking is heuristic only. Higher scores mean more inline visual logic, more local literals, and less shared ownership.

| File | Heuristic score | Notes |
| --- | ---: | --- |
| `src/components/SettingsPage.tsx` | 1598 | Biggest mixed-owner settings surface |
| `src/components/FileExplorer.tsx` | 1243 | Theme-aware, but still extremely local in control composition |
| `src/components/GitManager.tsx` | 654 | Direct palette-driven UI island |
| `src/components/TerminalOverlay.tsx` | 459 | Own theme adapter and local chrome family |
| `src/components/StoragePanel.tsx` | 437 | Large UI surface with significant inline visual logic |
| `src/components/ExplorerAudioWorkbench.tsx` | 202 | Preview lane with many local control styles |
| `src/components/explorer/ExplorerSideRail.tsx` | 186 | Shared motion, but many local control factories |
| `src/components/ExplorerVideoEditor.tsx` | 178 | Local CTA and inspector styling |

## Recommended Cleanup Order

1. Extract shared settings context-menu preview primitives and delete the duplicate copy from `SettingsPage.tsx`.
2. Add `SettingsNotice` and stronger `SettingsActionButton` variants, then migrate `AppearanceSettingsSection.tsx` and `IconSettingsSection.tsx`.
3. Introduce `ExplorerControlPrimitives.tsx` and migrate the duplicated chip/button/pill families out of `FileExplorer.tsx`, `ExplorerSideRail.tsx`, and `ExplorerWorkspace.tsx`.
4. Add shared explorer action-card and drag-preview primitives, then migrate `ExplorerActionRunCenterContent.tsx`, `ExplorerActionsPane.tsx`, `ExplorerDragOverlay.tsx`, and `ExplorerCustomizeDragOverlay.tsx`.
5. Continue moving the remaining inline settings sections out of `SettingsPage.tsx` in batches, starting with `appearance-packs`, `theme-recipes`, `theme-engines`, `shell-renderers`, and `top-bars` because they already resemble a shared catalog archetype.
