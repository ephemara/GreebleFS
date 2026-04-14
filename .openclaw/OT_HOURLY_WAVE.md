# OverlayTerm Hourly Wave

This is the active serialized OT strike-wave.

## Order

1. `ot-cleo`
2. `ot-aristotle`
3. `ot-dalmascus`
4. `ot-native`
5. `ot-runtime`
6. `ot-terminal`
7. `ot-explorer`
8. `ot-qa`

## Rules

- One lane runs at a time.
- Every lane must read `.openclaw/OT_WAVE_HANDOFF.md` before changing direction.
- Every lane must leave a concrete handoff for the next lane, not a vague summary.
- Handoffs should name files touched, tests run, blockers, and the next best move.
- OT QA closes the wave with validation notes and explicit follow-ups for the next OT Cleo pass.
- Seat assignment and live activation are managed externally by Kaino before each lane starts.

## Lane intent

- `ot-cleo`: choose the concrete strike objective for this wave and prevent lane collisions.
- `ot-aristotle`: pressure-test the chosen path and tighten the implementation edge.
- `ot-dalmascus`: drive the main implementation move.
- `ot-native`: handle native, Rust, PTY, watcher, or subprocess fallout opened by the implementation.
- `ot-runtime`: handle frontend runtime, settings, stores, and orchestration fallout.
- `ot-terminal`: push terminal-specific follow-through.
- `ot-explorer`: push explorer and UX follow-through.
- `ot-qa`: validate the wave, record regressions, and leave the next-cycle reality check.
