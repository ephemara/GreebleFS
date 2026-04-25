# GreebleFS Smoke Test Actions

This pack is a read-only sanity bundle for the new `actions/` system.

It gives you four visible probes:

- `Inspect Selection` for entry and multi-select context inspection
- `Report Current Folder` for background-context shell output
- `Preview Terminal Ping` for preview-terminal routing
- `Cargo Context Report` for the Cargo runner path

Recommended flow:

1. Open Settings -> Context Menus.
2. Hit `Refresh Actions`.
3. Add these actions from the Action Browser into the menu contexts you want to test.
4. Right-click files, folders, and empty background lanes to verify the results.

All actions are read-only and only print runtime context.
