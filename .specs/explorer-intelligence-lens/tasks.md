# Implementation Plan: Explorer Intelligence Lens

**Spec Type:** standard  
**Slug:** `explorer-intelligence-lens`  
**Created:** 2026-04-14

## Overview

Build a premium exploratory mode that reuses the current explorer engine and experimental mode plumbing, then adds relationship and temporal lens shaping as lightweight presentation layers.

## Sequencing Strategy

- Primary strategy: hybrid
- Major dependencies: current explorer listing cache, experimental mode HUD, explorer session state, theme recipe resolution
- Parallel work opportunities: lens heuristics, HUD copy, test coverage

## Task Checklist

- [ ] 1. Lens state and mode plumbing
- [ ] 1.1 Add a unified lens state model and mode resolver
  - Objective: keep the active lens subtype, preserved context, and density in one place.
  - Files: `src/components/FileExplorer.tsx`, `src/config/explorerExperimentalModes.ts`, new lens helper module.
  - Validation: unit tests for mode resolution and state preservation.
  - _Requirements: REQ-1, REQ-4, NFR-2_

- [ ] 1.2 Wire lens activation into existing explorer controls
  - Objective: make the new lens feel like a first-class explorer mode rather than a hidden flag.
  - Files: `src/components/FileExplorer.tsx`, explorer HUD pieces.
  - Validation: manual smoke check for switching modes without losing folder context.
  - _Requirements: REQ-1, REQ-4_

- [ ] 2. Relationship shaping prototype
- [ ] 2.1 Implement light-weight grouping heuristics
  - Objective: cluster visible entries by cheap, deterministic signals.
  - Files: new helper module, maybe `src/components/FileExplorer.tsx` render adapter.
  - Validation: unit tests for grouping and fallback behavior.
  - _Requirements: REQ-2, NFR-1_

- [ ] 2.2 Render clustered relationships in the explorer surface
  - Objective: display neighborhoods without removing the base entry list fallback.
  - Files: `src/components/FileExplorer.tsx`, theme metrics if needed.
  - Validation: scenario check for expand/collapse and fallback rendering.
  - _Requirements: REQ-2, NFR-3_

- [ ] 3. Temporal shaping prototype
- [ ] 3.1 Add timestamp bucketing and zoom-preserving temporal bands
  - Objective: turn time metadata into legible eras, months, or days.
  - Files: new helper module, explorer render adapter.
  - Validation: unit tests for bucketing and unknown-time fallback.
  - _Requirements: REQ-3, NFR-1_

- [ ] 3.2 Surface temporal labels and context hints in the HUD
  - Objective: make the mode readable and polished.
  - Files: explorer HUD and related chrome.
  - Validation: visual/manual review of labels and transitions.
  - _Requirements: REQ-3, REQ-4_

- [ ] 4. Validation and rollout guardrails
- [ ] 4.1 Add tests for fallback, large folder behavior, and preserved selection
  - Objective: prevent the lens from destabilizing the existing explorer.
  - Files: `src/test/*` as needed.
  - Validation: targeted unit/integration tests.
  - _Requirements: NFR-1, NFR-2, NFR-3_

- [ ] 4.2 Document the mode in durable fleet notes if it ships or proves strong
  - Objective: keep the product direction visible for future passes.
  - Files: `.openclaw/ot-labs/MEMORY.md`, `SHIPPLAN.md`.
  - Validation: note review.
  - _Requirements: REQ-4_

## Validation Gates

- [ ] All requirement IDs are covered
- [ ] Dependencies are respected
- [ ] Tests are included in the relevant tasks
- [ ] Rollout or migration work is captured when needed

## Notes and Risks

- Risk: relationship heuristics become noisy and feel fake.
  Mitigation: keep the first prototype deterministic and shallow, with a strong fallback to raw entries.
- Risk: lens shaping adds render cost in very large folders.
  Mitigation: reuse caches, debounce shaping, and keep the base explorer path available.
