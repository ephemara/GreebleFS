# Design: Explorer Intelligence Lens

**Spec Type:** standard  
**Slug:** `explorer-intelligence-lens`  
**Created:** 2026-04-14

## Overview

The Lens is implemented as a composition layer on top of the existing explorer runtime, not as a separate explorer shell. It reuses current directory caching, experimental mode routing, theme recipe resolution, and explorer session state, then adds a unified lens controller and a lightweight data-shaping layer for relationship and temporal pivots.

## Requirements Traceability

- REQ-1 -> Lens controller, mode routing, persisted focus state
- REQ-2 -> Relationship grouping pipeline, cluster presentation, fallback directory list
- REQ-3 -> Temporal bucketing pipeline, timestamp normalization, zoom-preserving state
- REQ-4 -> HUD copy, controls, and degraded fallback path
- NFR-1 -> Debounced data shaping, cache reuse, non-blocking transitions
- NFR-2 -> State isolation and fallback behavior
- NFR-3 -> Existing explorer config/runtime boundaries

## Architecture

### System Overview
1. Explorer loads directory data through the existing backend/cache path.
2. Lens mode selects a presentation strategy, not a new data source.
3. A small shaping layer converts visible entries into clusters, bands, or a semantic grid.
4. The UI renders the shaped view while preserving selection, path, and shell controls.

### Component Boundaries
- `src/config/explorerExperimentalModes.ts`, mode metadata and density descriptors.
- `src/components/FileExplorer.tsx`, lens activation, state preservation, and view orchestration.
- `src/config/explorerTheme.ts`, metrics and surface tuning.
- `src/runtime/explorerBackend.ts`, existing file listing and metadata inputs.
- New helper modules, lens shaping and grouping logic.

### Data Flow
- Folder listing arrives from cache/backend.
- Lens controller selects active lens subtype and density.
- Relationship or temporal shaping derives bands or clusters from visible entries.
- UI renders the shaped structure and emits standard explorer actions.

## Components and Interfaces

### Lens Controller
- Purpose: resolve the active lens subtype and keep the current explorer context intact.
- Inputs: explorer settings, theme preference, current path, selection, density.
- Outputs: effective lens mode and render hints.
- Dependencies: explorer store, theme recipe, existing experimental mode resolution.

### Relationship Shaper
- Purpose: group entries into visible neighborhoods using light heuristics.
- Inputs: file name patterns, folder structure, size/time metadata, optionally extension similarity.
- Outputs: cluster groups, anchor items, fallback ungrouped entries.
- Dependencies: cached directory entries.

### Temporal Shaper
- Purpose: bucket entries into time bands for inspection.
- Inputs: filesystem timestamps, fallback unknown-time markers.
- Outputs: era/day/month buckets and a density-aware presentation.
- Dependencies: entry metadata and existing view mode controls.

### Lens HUD
- Purpose: surface labels and quick explanations without cluttering the shell.
- Inputs: active lens subtype, density label, availability hints.
- Outputs: compact overlay controls and text.
- Dependencies: explorer chrome, theme surfaces, keyboard shortcuts.

## Data Models

### LensState
- Fields: active subtype, density, last sub-view, preserved path, preserved selection, available heuristics.
- Validation: subtype must map to an enabled experimental mode.
- Relationships: layered over existing explorer session state.

### LensGroup
- Fields: group id, title, anchor entry, member entries, confidence, presentation kind.
- Validation: group must contain at least one entry.
- Relationships: derived from cached directory entries.

### TemporalBand
- Fields: band id, label, range, entries, unknown-time count.
- Validation: range ordering must be stable.
- Relationships: derived from entry metadata.

## Error Handling

- Validation failures: fall back to the base explorer list and preserve the current folder.
- Dependency failures: if metadata or heuristics are unavailable, skip shaping rather than blocking render.
- Recovery: use cached entries and standard explorer modes as the recovery path.
- User-visible errors: avoid modal errors unless the backend read itself fails.

## Testing Strategy

- Unit: grouping heuristics, banding logic, mode resolution.
- Integration: explorer state preservation across lens switches.
- Scenario or end-to-end: folder switch, density change, and fallback behavior.
- Performance, security, or reliability: large-directory responsiveness and non-blocking transitions.

## Rollout and Operations

- Configuration: gate behind the existing experimental explorer mode system.
- Observability: log lens mode switches, fallback usage, and shaping latency.
- Rollout: ship as an experimental premium explorer pass before promoting to default.
- Rollback: disable the mode through the existing experimental mode selector.
