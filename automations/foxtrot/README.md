# Foxtrot Lane

## Mission

Drive OverlayTerm from "builds locally" toward a believable release candidate with packaging, release docs, and ship evidence.

## Teams

- Team 9: build and maintain release-engineering outputs, packaging readiness, and ship documentation.
- Team 10: validate release artifacts, build posture, checklist accuracy, and remaining ship blockers.

## Focus Areas

- Production build health, bundle warnings, and release-candidate posture.
- Tauri packaging configuration and artifact readiness.
- Release checklist, changelog, operator docs, and product framing.
- Cross-lane release blocker tracking using Tango, Delta, Charlie, and Echo reports.

## Ranked Backlog

1. Ship checklist and blocker ledger.
   - Create and maintain a concrete release checklist tied to actual product and validation state.
   - Keep it grounded in current lane reports, not aspiration.
2. Packaging and artifact readiness.
   - Validate `package.json`, `src-tauri/tauri.conf.json`, build commands, and any platform packaging assumptions.
   - Reduce "works in dev" drift from "can produce a release candidate."
3. Build-output pressure and release posture.
   - Track oversized JS chunks, repeated build warnings, and release-facing caveats.
   - Keep evidence current enough that the team knows whether the ship candidate is improving or regressing.
4. Release docs and operator framing.
   - Tighten `README.md`, release notes, onboarding clarity, and operator-facing guidance.
5. Artifact validation and readiness reporting.
   - Make sure produced outputs and release notes match what the app can actually do.
6. Final release-candidate convergence.
   - Keep the release lane synced with Echo proof and the latest builder lanes so the final ship call is grounded.

## Execution Order For The Next 2-3 Days

- Day 1 bias:
  - backlog items 1 and 2
- Day 2 bias:
  - backlog items 3 and 4
- Day 3 bias:
  - backlog items 5 and 6, plus cleanup on unfinished earlier work

## Team Selection Rules

- Team 9 should usually take the highest unfinished release-engineering item from the ranked backlog.
- Team 10 should validate the latest Team 9 slice first, then tighten the same release path or clear the highest-risk remaining blocker.
- Foxtrot should read the latest Tango, Delta, Charlie, and Echo reports before deciding what counts as a real release blocker.
- Do not skip to lower-ranked work unless the higher-ranked item is blocked and the blocker is recorded in `handoff.md`.

## Workflow

1. Read `M:\OverlayTerm\automations\global.md`.
2. Read `M:\OverlayTerm\automations\foxtrot\memory.md`.
3. Read `M:\OverlayTerm\automations\foxtrot\handoff.md`.
4. Read `M:\OverlayTerm\automations\foxtrot\report.md`.
5. Read the latest relevant reports from Tango, Delta, Charlie, and Echo.
6. Make the smallest release-engineering improvement that sharpens ship readiness.
7. Append concise durable notes to `memory.md`.
8. Refresh `handoff.md` with current status, exact verification, exact blockers, and the next best step.
9. Refresh `report.md` with current release-candidate posture.

## Team 9 Rules

- Prefer concrete release outputs over speculative cleanup.
- Keep docs and checklists synchronized with the product's actual state.
- Make packaging assumptions explicit.

## Team 10 Rules

- Validate what exists before widening scope.
- Tighten blocker quality so release calls are based on exact evidence.
- Keep the release lane honest even when other lanes are moving quickly.
