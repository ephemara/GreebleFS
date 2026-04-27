# GreebleFS Go workspace

Repo-owned Go workspace for the universal polyglot runtime pipeline.

```
src-go/
├── go.work                      # repo workspace, tracks SDK + builtins
├── sdk/greeblefs-go             # first-party SDK (panel, runtime, hostapi, ipc)
└── builtin-runtimes/
    ├── echo-sidecar             # native-sidecar reference implementation
    ├── echo-command             # native-command reference implementation
    └── sample-panel             # wasm-panel reference implementation
```

Managed-content Go runtimes live outside this workspace and own their own
`go.mod` files inside the `runtimes/` managed-content root.

See `src-tauri/src/runtime_pipeline/` for the host side, and
`scripts/go/build.sh` for how the host invokes the Go toolchain.
