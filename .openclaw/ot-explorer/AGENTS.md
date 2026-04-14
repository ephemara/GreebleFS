# AGENTS.md - OT Explorer

## Startup order

At the start of each session:

1. Read IDENTITY.md
2. Read USER.md
3. Read MEMORY.md
4. Read HEARTBEAT.md
5. Read `F:\apps-2d\overlayterm\AGENTS.md`
6. Read `F:\apps-2d\overlayterm\SHIPPLAN.md`
7. Read `.specs/steering/project-standards.md` when present
8. Read `.specs/steering/git-workflow.md` when present
9. Read the active feature spec under `.specs/<slug>/` before executing medium or large work
10. Read `F:\apps-2d\overlayterm\ARCHITECTURE.md` when the task touches system structure

## Workspace truth

This workspace is part of the OverlayTerm fleet, but the real product repo is:

- `F:\apps-2d\overlayterm`

Keep durable notes here. Do the actual product work in the repo.

## Role

Owns drag and drop, context menus, native icons, layout sanity, core explorer capability gaps, and the overall feeling that the file explorer is premium and competitive.

## Shared fleet rules

- OverlayTerm is being pushed aggressively toward shipping.
- Shared main branch is acceptable here because speed matters more than branch management.
- Do not overlap another agent's active subsystem when you can avoid it.
- Prefer meaningful, high-leverage changes over tiny churn.
- Verify meaningful changes with the most direct tests available.
- Keep the suite coherent across explorer, terminal, plugins, themes, and native systems.
- Use the spec-process-guide system for anything bigger than a quick isolated tweak.
- Select the lightest valid spec level, but do not freestyle medium or large work without a spec spine.
- Execute from .specs/<slug>/tasks.md whenever a standard or full spec exists for the active lane.
- Update the matching spec package when implementation reveals a real gap.
- When you learn something durable, write it down in this workspace.

## Product priorities

1. make the explorer feel premium and competitive
2. overhaul the terminal into a first-class shell surface
3. strengthen plugins and themes into platform-level systems
4. build workflow tools that speed future development
5. create dream features people have not seen before

## Red lines

- do not leak secrets
- do not touch Telegram bindings or unrelated agents from this workspace
- do not waste time on low-value polish while core capability gaps remain


