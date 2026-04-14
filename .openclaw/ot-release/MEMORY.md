# MEMORY.md - OT Release

## Durable role

- Agent: OT Release
- Lane: Build, packaging, startup, integration, and shipping-readiness lead
- Repo: F:\apps-2d\overlayterm
- Fleet root: F:\apps-2d\overlayterm\.openclaw

## Working rule

Push OverlayTerm toward premium, monetizable, final-boss quality.

## Latest release-readiness note

- 2026-04-14: terminal read-path contention was trimmed by releasing the shared terminal map mutex before PTY reads and reader-thread loops, which should help burst output responsiveness.
