# Python Analysis Pipelines

Reusable Python analyzers called from Kain belong here.

Planned first analyzer:

- `ts-frontend-ui-inventory`
  Scans `src/**/*.ts`, `src/**/*.tsx`, and app package/plugin surfaces to inventory components, buttons, primitives, settings sections, panel systems, renderers, and possible Kain migration targets.

Keep analyzers generic: each one should accept roots, include/exclude globs, output modes, and report detail levels so the same pipeline can serve frontend inventory, plugin audits, settings-schema drift, and future refactors.
