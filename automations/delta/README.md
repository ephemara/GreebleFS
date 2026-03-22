# Delta Lane

## Mission

Close feature gaps and missing implementations required to ship OverlayTerm with confidence.

## Teams

- Team 3: implement missing features, integration paths, and incomplete product behavior.
- Team 4: validate Team 3 output, polish UX and docs, and reduce release risk.

## Focus Areas

- Missing product features required for a shippable release.
- Incomplete workflows across explorer, source control, plugins, screenshots, and settings.
- Integration gaps between Rust commands, React panels, and persisted settings.
- Regression prevention, polish, and operator-facing clarity.

## Ranked Backlog

1. Source-control onboarding and repo workflow completion.
   - Finish the path from explorer selection to usable repo operations in the Source panel.
   - Reduce friction around selecting, importing, viewing, staging, committing, and shipping repository changes.
2. Release envelope and product framing.
   - Replace template-level project framing with real app-level release docs, onboarding clarity, and operator-facing guidance.
   - Tighten what a new user sees and understands on first contact.
3. Plugin, theme, shader, and animation workflow completion.
   - Make drop-in content management feel coherent and shippable.
   - Improve diagnostics, refresh loops, folder-open flows, and operator clarity.
4. Screenshots workflow completion.
   - Ensure capture, preview, save, clipboard, and gallery flows are complete and validated.
5. Settings and layout completion.
   - Tighten defaults, config path behavior, persistence clarity, and cross-panel settings coherence.
6. Cross-panel workflow polish.
   - Smooth handoffs between terminal, explorer, source control, plugins, notes, and screenshots.

## Execution Order For The Next 2-3 Days

- Day 1 bias:
  - backlog items 1 and 2
- Day 2 bias:
  - backlog items 3 and 4
- Day 3 bias:
  - backlog items 5 and 6, plus cleanup on unfinished earlier work

## Team Selection Rules

- Team 3 should usually take the highest unfinished builder item from the ranked backlog.
- Team 4 should validate the latest Team 3 slice first, then tighten the same workflow or clear the highest-risk remaining blocker.
- Do not skip to lower-ranked work unless the higher-ranked item is blocked and the blocker is recorded in `handoff.md`.

## Workflow

1. Read `M:\OverlayTerm\automations\global.md`.
2. Read `M:\OverlayTerm\automations\delta\memory.md`.
3. Read `M:\OverlayTerm\automations\delta\handoff.md`.
4. Read `M:\OverlayTerm\automations\delta\report.md`.
5. Pick the highest-value missing or incomplete ship-blocking feature.
6. Implement the smallest solid slice that moves release scope forward.
7. Append durable notes to `memory.md`.
8. Refresh `handoff.md` with status, verification, and the next step.
9. Refresh `report.md` with release impact and open defects.

## Team 3 Rules

- Build missing behavior that users need to actually ship this app.
- Prefer finishable slices with clear validation targets.

## Team 4 Rules

- Validate behavior, remove rough edges, and record exact defects if the work is not ready.
- Keep polish tied to shipping value, not aesthetic wandering.
