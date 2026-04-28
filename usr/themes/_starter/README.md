# Theme Starter

Copy `icon-theme.json` into any theme package and edit only the parts you want to override.

- `iconDefinitions` maps canonical icon ids to files inside your theme folder.
- `fileExtensions` adds or overrides extension-based file icon matching.
- `fileNames` adds or overrides exact file-name icon matching.
- `folderNames` and `folderNamesExpanded` add or override folder-name matching.

Anything you leave out falls back to the built-in canonical icon catalog.

If you want a custom shell renderer, also copy `renderers/custom-shell.tsx` and add this to your `theme.json`:

```json
{
  "themeRenderer": {
    "entryModule": "renderers/custom-shell.tsx",
    "apiVersion": 1,
    "supportsLiveSwap": true,
    "fallbackRuntime": "workbench-tabs",
    "capabilities": {
      "customScreens": true,
      "wallpaperScene": true,
      "surfaceAdapters": true
    }
  }
}
```

The starter renderer shows the host contract shape:

- `host.renderChromeBar()`
- `host.renderDefaultNavigationSurface()`
- `host.renderDefaultContentSurface()`
- `host.renderPanelSurface(panelId)`
- `host.wallpaper.renderBackdropStack()`

If you want dock-specific tuning without a separate renderer, add `theme.dock.workbench` and/or `theme.dock.explorer` to your `theme.json`. The app theme and dock theme can now diverge in Settings, so those dock recipe overrides are the right place for tighter dock-only chrome and metric changes.
