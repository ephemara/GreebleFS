# Git Workflow

## Branching

- Use short, descriptive branch names tied to the work item.
- Keep changes scoped to one coherent objective where possible.

## Commits

- Prefer clear, reviewable commits with accurate intent.
- Keep commit messages precise enough that another agent can understand the change history.

## Review

- Validate before requesting review.
- Call out risks, assumptions, migrations, and rollback steps when they exist.
- Link the relevant `.specs/<slug>/` package in review context when the change is spec-driven.

## Merge and Release

- Merge only after validation and review requirements are met.
- Use feature flags, staged rollout, or rollback steps when the change warrants it.
- Preserve the spec package until rollout confidence is high and follow-up work is closed.
