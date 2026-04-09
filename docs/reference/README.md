# Content Browser UI Reference

This folder is a local reference copy of the UE5 Content Browser UI and style files.

Use these files first:

- `SContentBrowser.cpp` and `SContentBrowser.h`
  - Main Slate composition and layout.
- `ContentBrowserStyle.cpp` and `ContentBrowserStyle.h`
  - Style set registration, brushes, colors, fonts, row styles, icons.
- `SPathView.cpp` and `SPathView.h`
  - Folder tree UI.
- `SAssetView.cpp`
  - Main asset pane behavior and item presentation flow.
- `AssetViewWidgets.cpp`
  - Tile/list row widgets and item visuals.
- `SNavigationBar.cpp` and `SNavigationBar.h`
  - Breadcrumb and navigation bar UI.
- `Widgets/SContentBrowserSourceTree.cpp` and `Widgets/SContentBrowserSourceTree.h`
  - Source tree section container styling and layout.
- `ContentBrowserSingleton.cpp` and `ContentBrowserSingleton.h`
  - Browser creation and higher-level UI wiring entrypoints.
- `Menus/ContentBrowserMenus.cpp`
  - Toolbar/menu style usage.

Suggested read order:

1. `SContentBrowser.cpp`
2. `ContentBrowserStyle.cpp`
3. `Widgets/SContentBrowserSourceTree.cpp`
4. `SPathView.cpp`
5. `AssetViewWidgets.cpp`
6. `SAssetView.cpp`
