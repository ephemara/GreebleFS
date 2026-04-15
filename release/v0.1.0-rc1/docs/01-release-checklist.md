# GreebleFS Release Checklist

## Discovery

- [x] Read repo architecture and operator docs
- [x] Identify canonical release commands
- [x] Identify supported platforms and packaging targets
- [x] Identify signing, notarization, or store requirements
- [x] Record immutable environment blockers

## Validation

- [ ] Run tests relevant to shipping
- [ ] Run lint or static analysis if required
- [x] Run typecheck or compile validation if required
- [x] Run production build or package dry run
- [ ] Run targeted smoke verification on the produced artifact

## Artifacts

- [ ] Produce Linux release artifacts
- [x] Record exact artifact paths
- [ ] Record checksums, signatures, or symbols if required
- [ ] Copy or link artifacts into the release folder

## Release Surface

- [x] Update release notes or compatibility docs
- [x] Update docs or screenshots if needed
- [x] Record installer or updater status
- [x] Record known caveats and remaining work

## Closeout

- [x] Fill out summary, build ledger, bug sweep, and task sheets
- [x] State current decision with rationale
