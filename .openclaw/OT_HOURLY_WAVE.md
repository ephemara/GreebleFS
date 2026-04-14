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
- This wave is code-first. A pass only counts if it lands code, tests, or a real environment fix. Markdown-only churn does not count.
- Do not reopen already-closed spec paperwork just to stay busy. Use `SHIPPLAN.md`, live repo state, and the handoff to drive implementation.
- Every lane must leave a concrete handoff for the next lane, not a vague summary.
- Handoffs should name files touched, tests run, blockers, and the next best move.
- Keep handoff edits tight. Do not spam timestamps, repeat the same validation note, or rewrite large sections without new information.
- OT QA closes the wave with validation notes and explicit follow-ups for the next OT Cleo pass.
- Seat assignment and live activation are managed externally by Kaino before each lane starts.

## Lane intent

- `ot-cleo`: pick the concrete code objective for this wave, kill lane drift, and open the implementation path.
- `ot-aristotle`: pressure-test the chosen implementation path and tighten the invariant set before more code lands.
- `ot-dalmascus`: drive the main code move.
- `ot-native`: handle native, Rust, watcher, tray, window, or subprocess fallout opened by the implementation.
- `ot-runtime`: handle frontend runtime, settings, stores, and orchestration fallout.
- `ot-terminal`: own terminal and shell-mode follow-through when the objective touches presentation or handoff behavior.
- `ot-explorer`: own explorer and UX follow-through when the objective touches panel layout, dock mode, or user-facing interactions.
- `ot-qa`: validate the wave, record regressions, and leave the next-cycle reality check.
