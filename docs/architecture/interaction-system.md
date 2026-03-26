# Interaction System

## Purpose

Define one theme-agnostic interaction system for OverlayTerm so every shell skin remains intuitive and fast.

Themes, shell blueprints, and layout profiles may change visual framing, chrome position, and motion language. They must not fork the explorer's core behavior model.

## Core Rule

Layout profiles are presentation skins, not interaction forks.

XMB, iOS-style, Wii-style, VS Code-style, and future shells should all preserve the same user verbs:

- activate
- back
- forward
- up
- search
- refresh
- toggle hidden
- cycle layout
- inspect
- peek
- select
- scope

Visual controls may move, but these verbs should not be renamed or repurposed.

## Transferable Navigation

Navigation should be anchored semantically instead of by widget structure.

The system should preserve three anchors whenever possible:

- `focus anchor`: the current intended item or action
- `selection anchor`: the base point for additive or range selection
- `location anchor`: the current path, history position, and visible slice

Layout switching is a presentation transform, not a navigation event. Switching between shell families should preserve these anchors before preserving shell-specific composition.

## Ownership And Mode Recovery

Every interactive flow should preserve visible ownership:

- `navigation owner`: the surface that directional movement is acting on
- `command owner`: the surface that search, inspect, select, and confirm actions target
- `progress owner`: the surface or layer where long-running work remains visible

Browse, search, inspect, picker, and background-task flows should hand off ownership predictably when mode changes.

Leaving search, inspect, or picker flows should restore the last meaningful browse target instead of dropping users at collection origin or a shell-default surface.

## Explorer Semantics

Explorer behavior should stay stable across shells:

- Compact dock layouts force `list` mode for scanability in narrow rails.
- Active search resolves grid-oriented modes to `details` so results stay dense and comparable.
- Legacy mode names map into richer presets instead of preserving ambiguous labels.
- Hidden files default to off and remain an explicit opt-in.
- Repository-picker confirmation must succeed without a dummy preselection by allowing the current folder as a first-class fallback.
- Single-select repository-picker flows must remain single-select even if the user uses multi-select gestures.

## Input Model

Different devices may express the same intent differently, but the semantic movement model should transfer:

- `primary axis`: move within the dominant content flow for the current shell
- `secondary axis`: move across adjacent groups, columns, rails, or panes
- `activate`: open the focused item or trigger the focused action
- `back`: return to the previous location or shell level
- `peek`: show lightweight preview without committing navigation
- `inspect`: open deeper metadata or detail context
- `scope`: change the active search, panel, or selection context

The shell should adapt D-pad, keyboard, pointer, wheel, and touch gestures into these primitives instead of creating layout-specific interaction rules.

## Selection Grammar

Selection should feel identical whether the user is in a repository picker or a normal explorer surface.

- `single-select`: one focused target is the active result
- `additive multi-select`: explicit additive gestures extend the selected set without replacing the anchor
- `range-select`: range expansion grows from the current selection anchor
- `current-folder fallback`: when no entry is selected in repository-picker mode, the current folder remains a valid confirmation target

## Progress Grammar

Progress feedback should be shared, lightweight, and predictable.

One layout-agnostic status vocabulary applies everywhere:

- `idle`
- `loading`
- `working`
- `success`
- `warning`
- `error`

Progress should also be described by layer:

- `inline`: current-pane work such as search or refresh
- `session`: shared background jobs surfaced through the task badge
- `history`: completed or failed work that needs later inspection

Visible progress should keep the task name plus either percent complete or final status. Completed or cleaned-up work should auto-clear after a short delay instead of leaving dead chrome behind.

## Multi-Surface Safety

Manual refresh is an authority boundary. Explicit refresh actions must request uncached data rather than replaying warm snapshots.

Stable search scopes are part of the UX contract. The current `primary_file_explorer` scope is only safe while one visible explorer instance owns it. Before multiple live explorer surfaces ship, search cancellation, progress ownership, and focus handoff should move to per-instance scope derivation.

## Typed Layout Metadata

Layout metadata now needs explicit interaction answers, not only visual composition:

- which surface owns the primary axis
- which surface owns the secondary axis
- which surface owns navigation and scope-sensitive commands
- whether progress is primarily inline, session-level, or historical
- whether `back` resolves overlay-first or history-first
- whether mode exit returns to the last browse target or a shell default
- which anchors must survive layout changes

`src/config/layoutProfiles.ts` is the current typed home for this contract inside OverlayTerm.

## Benchmarks

Responsiveness targets currently used as the baseline contract:

- Explorer navigation: 120 ms
- Explorer search: 180 ms
- Entry-size batch: 160 ms
- Native icon batch: 140 ms
- Explorer first interactive: 350 ms

Cross-shell comprehension targets:

- First open within 5 seconds
- Back predictability at 90 percent in navigation tests
- Layout transfer without extra onboarding
- Focus recovery within 2 directional steps after layout switch or refresh
- Preview and progress state legibility at a glance
- Selection clarity between focused item and selected set at a glance
- Scope ownership without trial-and-error
- Progress handoff remains understandable after shell or scope change
- Mode recovery within 2 directional steps after leaving search, inspect, or picker flows

Performance samples persist under `overlayterm-explorer-performance-v1` until newer measured evidence replaces them.

## Current Friction Removed

- Search-active grid modes already fall back to `details`.
- Compact dock explorers already fall back to `list`.
- Repository-picker flows already allow current-folder confirmation without dummy preselection.
- Single-choice repository picking already rejects accidental multi-select.
- Manual refresh already bypasses warm snapshots when the user explicitly asks for fresh state.
- Shared task progress already uses a common badge with task name plus percent or final status.

## Next Targets

- Turn focus, selection, location, ownership, and progress semantics into typed shell and explorer contracts.
- Replace the fixed `primary_file_explorer` scope with per-instance derivation before enabling multiple live explorer surfaces.
- Add layout-switch tests that prove focus anchor, selection anchor, and visible location survive shell changes.
- Add UX tests that validate back behavior, preview clarity, selection clarity, scope ownership, and progress handoff across contrasting layout families.
- Capture runtime evidence for cold, warm, over-budget, and canceled searches under explicit cache policy.

## Implementation Rule

Future shell work should route through this interaction contract before adding layout-specific navigation, preview, selection, or progress behavior.
