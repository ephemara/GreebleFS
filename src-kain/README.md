# GreebleFS Kain Runtime Lane

`src-kain` is the repo-owned home for Kain-authored GreebleFS runtimes. The host treats these packages exactly like other runtime pipeline packages: each runtime owns a `runtime.toml`, declares its compiler as `kain-script`, and runs through the native sidecar protocol.

The first runtime is `greeblefs-kain-host-smoke`, a tiny host-bridge proof that asks GreebleFS for `files.stat` and returns the result with Kain metadata. It is intentionally small so future settings, plugin, and pipeline work can copy the shape without inheriting a big example.
