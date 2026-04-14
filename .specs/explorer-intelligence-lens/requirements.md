# Requirements: Explorer Intelligence Lens

**Spec Type:** standard  
**Slug:** `explorer-intelligence-lens`  
**Created:** 2026-04-14

## Overview

OverlayTerm needs a flagship explorer mode that feels meaningfully beyond a normal file grid. The Explorer Intelligence Lens turns the existing experimental modes into a single premium discovery surface that can pivot between relationship mapping, temporal browsing, and semantic density without forcing the user to change mental models.

The goal is to raise the product ceiling by making the explorer feel like a living workspace, not just a directory view.

## User Roles

- Power user, wants to understand large codebases and content collections quickly.
- Knowledge worker, wants to trace file relationships and project history without leaving the explorer.
- Explorer power user, wants a premium mode that makes the app feel differentiated.

## Requirements

### REQ-1: Unified Lens Mode
**User Story:** As a power user, I want one discoverability mode that can shift between structural, temporal, and density-based views, so that I can inspect the same folder from different mental models without switching tools.

**Acceptance Criteria**
1. WHEN Lens mode is enabled, THEN the explorer SHALL expose a single control plane for structural, temporal, and density-oriented exploration.
2. WHEN the user changes the lens focus, THEN the system SHALL preserve the current folder context and selection where possible.
3. IF the current dataset cannot support a sub-view, THEN the system SHALL fall back to a safe default presentation.

**Edge Cases**
- Empty folders still render a meaningful empty-state lens shell.
- Very large directories must not block the mode switch.

### REQ-2: Relationship-First Discovery
**User Story:** As a knowledge worker, I want the explorer to surface file clusters and likely related items, so that I can find adjacent work without relying on names alone.

**Acceptance Criteria**
1. WHEN the relationship sub-view is active, THEN the system SHALL group entries into visible clusters or neighborhoods.
2. WHEN a cluster is expanded, THEN the system SHALL reveal nearby related entries without losing the broader map.
3. IF relationship data is incomplete, THEN the system SHALL still show the underlying directory entries.

### REQ-3: Temporal Browsing
**User Story:** As a user working across project history, I want to browse files by age and activity windows, so that I can inspect work in the order it evolved.

**Acceptance Criteria**
1. WHEN the temporal sub-view is active, THEN the system SHALL surface time bands or time slices for visible entries.
2. WHEN the user zooms the temporal scale, THEN the system SHALL preserve position and context as much as possible.
3. IF timestamps are missing, THEN the system SHALL label entries with an explicit unknown-time state.

### REQ-4: Premium Control Surface
**User Story:** As an explorer power user, I want the lens controls to feel polished and discoverable, so that the mode feels like a flagship feature rather than a hidden experiment.

**Acceptance Criteria**
1. WHEN Lens mode is active, THEN the explorer SHALL present concise mode labels, density labels, and contextual hints.
2. WHEN the user changes lens parameters, THEN feedback SHALL be immediate and visually obvious.
3. IF the feature is disabled, THEN the explorer SHALL degrade cleanly to existing modes.

## Non-Functional Requirements

### NFR-1: Responsiveness
- Lens transitions should remain interactive on large folders and should not add obvious input lag to the explorer shell.

### NFR-2: Stability
- The mode must not corrupt existing explorer session state, cached listings, or selection state.

### NFR-3: Maintainability
- New lens behavior should reuse the existing explorer runtime and theme/config boundaries instead of adding one-off UI logic in components.

## Out of Scope

- Full graph database indexing.
- Backend content similarity scoring beyond lightweight heuristics.
- File content editing inside the lens view.
- Replacing all existing explorer modes.

## Open Questions

- Which heuristics are sufficient for relationship grouping in the first prototype?
- Should temporal browsing prefer filesystem timestamps, git history, or a merged signal?
- Do we ship this as a new mode or as a premium upgrade to the existing experimental HUD?
