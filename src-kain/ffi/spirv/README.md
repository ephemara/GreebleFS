# Kain SPIR-V

This lane is for shader and compute artifact generation.

Target consumers:

- Lookdev shader profiles.
- Preview/render effects.
- GPU compute kernels.
- Runtime-authored visual effects.

Generated artifacts should flow through a GreebleFS runtime/cache boundary, not ad hoc frontend paths.
