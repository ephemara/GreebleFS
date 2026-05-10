# Kain Plugin Authoring Examples

These root-level examples are teaching files for future Kain plugin authors. They intentionally live beside real plugins under `usr/plugins-kain/` instead of inside `kain-image-converter`, so the production image converter package stays clean.

| File | Purpose | Proof |
| --- | --- | --- |
| `00_minimal_plugin.kn` | Smallest useful GreebleFS Kain plugin catalog object. | `kain run` |
| `01_contracts_and_laws.kn` | Typed domain records, enum lane selection, trait impl, and law validation. | `kain run` |
| `02_orchestrated_ffi_pipeline.kn` | World, patch, law, converge, and cross-runtime `orchestrate` shape. | `kain build -t rust/js/ts` |
| `03_component_world_reference.kn` | Component plus world surface contract for future native/web UI bundles. | `kain build -t rust` |

The production plugin remains `../kain-image-converter/plugin.kn`. These examples exist so agents can learn Kain syntax without risking the live catalog path.
