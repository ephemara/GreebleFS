# Release Compatibility

GreebleFS now ships under the `GreebleFS` product name, bundle identifier, Linux installer paths, and desktop entry metadata.

The following legacy `OverlayTerm` contracts remain intentionally supported for `v0.1.0-rc1`:

- Plugin and runtime import module names such as `overlayterm-plugin`, `overlayterm-animation`, `overlayterm-shader`, `overlayterm-theme-renderer`, and `overlayterm-wallpaper`
- Browser event names and drag payload keys such as `overlayterm:*` and `application/x-overlayterm-*`
- Persisted local storage keys and related compatibility markers that already back existing user state
- Legacy layout manifest probe paths under `.greeble/...` and `.overlayterm/...`
- Legacy dev/runtime environment variables prefixed with `OVERLAYTERM_` or `VITE_OVERLAYTERM_`

New release-facing defaults added in this pass:

- Tauri bundle identifier: `co.greeblefs.app`
- Linux installer root: `~/.local/opt/greeblefs`
- Linux CLI symlink: `~/.local/bin/greeblefs`
- Layout manifest auto-probe: `~/.greeblefs/greeblefs.layouts.{json,toml}`

Migration behavior added in this pass:

- Release-managed content now migrates from the old `co.overlayterm.app` app-local data root into the new `co.greeblefs.app` root on first release boot when the new target path does not already exist.
- Legacy home-root managed content migration remains in place.
- The Linux installer writes the new `greeblefs` CLI link and keeps a legacy `overlayterm` CLI alias for one release cycle.
