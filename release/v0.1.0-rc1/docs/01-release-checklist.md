# GreebleFS Release Checklist

## Discovery

- [ ] Read repo architecture and operator docs
- [ ] Identify canonical release commands
- [ ] Identify supported platforms and packaging targets
- [ ] Identify signing, notarization, or store requirements
- [ ] Record immutable environment blockers

## Validation

- [ ] Run tests relevant to shipping
- [ ] Run lint or static analysis if required
- [ ] Run typecheck or compile validation if required
- [ ] Run production build or package dry run
- [ ] Run targeted smoke verification on the produced artifact

## Artifacts

- [ ] Produce release artifacts
- [ ] Record exact artifact paths
- [ ] Record checksums, signatures, or symbols if required
- [ ] Copy or link artifacts into the release folder

## Release Surface

- [ ] Update release notes or changelog
- [ ] Update docs or screenshots if needed
- [ ] Record installer or updater status
- [ ] Record known caveats and remaining work

## Closeout

- [ ] Fill out summary, build ledger, bug sweep, and task sheets
- [ ] State final decision with rationale
