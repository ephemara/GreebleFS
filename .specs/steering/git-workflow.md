# Git Workflow

## Default Delivery Model

- Shared `master` or mainline work is the default for OverlayTerm.
- Do not create branch-management overhead by default when the work is internal, fast-moving, and coordinated across the OT fleet.
- If a change is unusually risky, destructive, or experimental, isolate it deliberately, but treat that as the exception rather than the normal flow.

## Commits

- Keep commits scoped to one coherent objective.
- Use commit messages that describe the shipped intent, not just the file area.
- When work is spec-driven, make the relationship to the spec obvious in commit context or surrounding notes.
- Commit after meaningful setup or implementation milestones so the repo can be restored quickly if an aggressive pass goes sideways.

## Validation Before Commit

- Run the most direct validation that proves the changed path still works.
- Prefer targeted validation first, broader suites second.
- If validation is blocked by environment gaps, record the blocker explicitly in the spec or durable notes instead of silently pretending the work is verified.

## Review and Handoff

- Call out risky assumptions, migrations, perf tradeoffs, and rollback paths when they exist.
- Link the relevant `.specs/<slug>/` package when handing off or coordinating multi-agent work.
- Keep requirement and task traceability visible when the work spans multiple subsystems.

## Rollback Expectations

- Before major sweeps, make sure the repo can be restored via commit history or existing backups.
- Prefer direct rollback through Git over manual file surgery when a pass fails.
- For high-risk native or runtime changes, include explicit rollback notes in the matching spec package.

## Multi-Agent Coordination

- Do not let multiple agents land large changes in the same files at once.
- Let OT Cleo coordinate task routing from specs.
- Let implementation agents claim concrete task groups or subtasks from `.specs/<slug>/tasks.md`.
- When a task changes the execution plan, update the spec before the next agent continues.
