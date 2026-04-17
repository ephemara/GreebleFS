# Native Reference Bundles

This folder is for staged native-side reference material that should live near the Rust workspace without being part of the active GreebleFS build graph.

Current contents:

- `bevydcc-greeblefs/`: curated bevydcc adoption bundle copied from `bevydcc/crates/greeblefs`

Rules:

- treat everything here as reference or import-staging material, not live application code
- do not add these folders to the root Cargo workspace until a deliberate lift-in pass decides the target crate/module ownership
- when code is adopted, port it into the correct GreebleFS layer instead of introducing a broad dependency on the staged bundle
