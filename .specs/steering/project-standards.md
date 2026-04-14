# Project Standards

## Code Quality

- Prefer explicit, maintainable structure.
- Keep names and boundaries clear enough for future agents and humans to understand quickly.
- Match the established repository conventions before introducing new ones.

## Testing

- Test the highest-risk logic first.
- Add unit, integration, or scenario coverage where it materially lowers risk.
- Keep validation commands discoverable and repeatable.

## Configuration and Secrets

- Keep secrets out of version control.
- Prefer environment-driven or configuration-driven values over hardcoded behavior.
- Document required configuration at the point of use.

## Security and Privacy

- Validate untrusted input.
- Apply least privilege to credentials and integrations.
- Record security-relevant assumptions when they affect the design.

## Performance and Reliability

- Make expensive paths visible and measurable.
- Prefer predictable behavior and clean rollback paths for risky changes.
- Capture observability requirements for critical workflows.

## Documentation

- Update durable docs when architecture or operating expectations change.
- Keep feature-local rationale inside the matching `.specs/<slug>/` package.
