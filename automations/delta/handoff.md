# Delta Handoff

## Current Status

- Lane initialized.
- No active run has claimed the first feature-completion slice yet.

## First Recommended Slice

- Identify the highest-value incomplete workflow that still blocks a credible ship candidate.
- Implement that workflow end-to-end with verification notes.

## Ranked Builder Queue

1. Complete repo onboarding and Source panel workflow.
   - Files likely involved:
     - `M:\OverlayTerm\src\components\GitManager.tsx`
     - `M:\OverlayTerm\src\components\FileExplorer.tsx`
     - `M:\OverlayTerm\src\App.tsx`
     - `M:\OverlayTerm\src-tauri\src\fs_commands.rs`
   - Exit criteria:
     - selecting repos and acting on them feels complete and validated.
2. Replace template-level release framing.
   - Focus:
     - top-level docs
     - app-level explanation
     - release/operator guidance
   - Exit criteria:
     - the project reads like a real product, not a starter template.
3. Complete plugin/theme/shader/animation management loops.
   - Exit criteria:
     - operator can understand, refresh, diagnose, and open relevant asset folders cleanly.
4. Complete screenshot capture-to-output workflow.
   - Exit criteria:
     - capture, preview, save, clipboard, and gallery paths are verified.
5. Tighten settings and layout behavior.
   - Exit criteria:
     - defaults and persistence feel release-ready and understandable.
6. Improve cross-panel handoffs.
   - Exit criteria:
     - common user tasks move cleanly between panels without hidden steps.

## Validator Queue

1. Verify the most recent builder slice end-to-end.
2. Fix safe polish defects directly where appropriate.
3. Update `report.md` with exact release impact and remaining defects.
4. If a workflow is still not shippable, convert that into a precise next action.

## Expected Output Per Run

- Summary of features or integrations completed.
- Exact files changed or reviewed.
- Verification performed.
- Remaining blockers.
- The single highest-value next step for the next delta run.
