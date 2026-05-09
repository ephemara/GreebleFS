# Kain Node FFI

This lane is for Kain calling Node/native npm packages.

Good first uses:

- TypeScript AST tools that are stronger in the npm ecosystem.
- Plugin/action manifest generation.
- Asset processing or codegen tools that already exist as Node packages.

React should not broker this work. Kain should own orchestration, then GreebleFS consumes generated artifacts or bridge responses.
