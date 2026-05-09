# Python Analysis Pipelines

Reusable Python analyzers called from Kain belong here.

Live first analyzer:

- `ts-frontend-ui-inventory`
  Implemented by `ui_inventory.py`.
  Scans `src/**/*.ts`, `src/**/*.tsx`, CSS, mobile, plugin, and package UI surfaces to inventory hardcoded visual tokens, inline styles, panel systems, interaction handlers, drag/drop policy, settings surfaces, and possible Kain/Lattice migration targets.
  Sidecar action: `kain.ffi.ui_inventory`.
  Kain example: `src-kain/ffi/python/examples/ui_inventory_bridge/bridge_example.kn`.

Keep analyzers generic: each one should accept roots, include/exclude globs, output modes, and report detail levels so the same pipeline can serve frontend inventory, plugin audits, settings-schema drift, and future refactors.
