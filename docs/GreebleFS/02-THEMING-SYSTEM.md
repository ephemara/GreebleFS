# GreebleFS Theming System

GreebleFS features a cutting-edge, bundle-first theming architecture that enables deep customization of the entire desktop experience. This document details the theming system's capabilities, architecture, and extensibility.

## Overview

The GreebleFS theming system is fundamentally different from traditional theme engines. Rather than applying surface-level color changes, GreebleFS themes can transform:

- Colors and typography
- Iconography and visual language
- Motion and animation profiles
- Shell chrome and layout behavior
- Wallpaper and shader atmosphere
- Sound and audio cues
- Interaction patterns and micro-interactions

This "deep theming" approach means a single theme package can completely change the identity of the application without requiring code changes.

---

## Bundle-First Architecture

### Concept

Themes in GreebleFS are **orchestration manifests** that compose modular child folders. This bundle-first approach allows themes to include only the components they wish to customize, inheriting defaults for everything else.

### Theme Structure

```
themes/
  └── my-theme/
      ├── theme.json          # Main manifest
      ├── appearance/         # Colors, typography, effects
      ├── top-bar/            # Launcher controls, navigation
      ├── icons/              # File/folder/UI icons
      ├── wallpaper/          # Static images, video, live modules
      ├── shaders/            # WGSL/HLSL effects
      ├── animations/         # Shell transitions, overlays
      ├── sounds/             # UI audio cues
      ├── motion/             # Micro-interactions, spring profiles
      ├── shell-renderer/     # Custom navigation/launcher systems
      ├── recipes/            # Workbench/explorer chrome
      ├── engine/             # Design tokens, layout primitives
      └── home-packs/         # Startup surfaces
```

### Manifest Format

```json
{
  "version": 1,
  "id": "my-theme",
  "name": "My Custom Theme",
  "description": "A custom theme for GreebleFS",
  "author": "Developer",
  "extends": "pilot-dark"
}
```

Themes can extend other themes, inheriting their configuration while overriding specific components.

---

## Modular Theme Lanes

### 1. Appearance Packs

Appearance packs define the visual foundation of a theme.

#### Color System

```typescript
interface OverlayThemePalette {
  appBackground: string;
  appBackgroundAlt: string;
  shellBackground: string;
  shellBackgroundSolid: string;
  topBarBackground: string;
  topBarMenuBackground: string;
  sidebarBackground: string;
  panelBackground: string;
}
```

#### Typography

```typescript
interface OverlayThemeTypography {
  fontFamily: string;
  monospaceFontFamily: string;
  fontSizeBase: number;
  fontSizeSm: number;
  fontSizeLg: number;
  lineHeight: number;
}
```

#### Visual Effects

```typescript
interface OverlayThemeEffects {
  backgroundImage: string;
  backgroundSize: string;
  backgroundPosition: string;
  shadow: string;
  overlayShadow: string;
}
```

### 2. Top Bars

Top bars provide the shell's header area with launcher controls and navigation.

#### Features

- Launcher controls (app menu, quick actions)
- Navigation tabs or summary mode
- Window chrome controls
- Theme-shader layering integration
- Multiple built-in variants

#### Configuration

```typescript
interface TopBarDefinition {
  id: string;
  label: string;
  controls: TopBarControl[];
  navigationStyle: 'tabs' | 'summary' | 'minimal';
  shaderLayer?: string;
}
```

### 3. Icon Themes

Icon themes define file, folder, and UI iconography.

#### Structure

```typescript
interface IconThemeManifest {
  name: string;
  version: number;
  description?: string;
  file: string;           // Default file icon
  folder: string;         // Closed folder icon
  folderExpanded: string; // Open folder icon
  iconDefinitions: Record<string, string>; // Custom icons
  fileExtensions: Record<string, string>;  // Extension mappings
}
```

#### Features

- SVG-based icon system
- Theme-aware SVG icon resolution
- Canonical file and folder IDs
- Extension-based icon mapping
- Custom icon definitions

### 4. Wallpapers

Wallpapers provide background visuals for the shell.

#### Types

- **Static Images**: PNG, JPG, SVG formats
- **Video Wallpapers**: MP4, WebM with playback controls
- **Live Modules**: Runtime shader-based animated backgrounds

#### Configuration

```typescript
interface WallpaperDefinition {
  id: string;
  type: 'image' | 'video' | 'live';
  source: string;
  fitMode: 'fill' | 'contain' | 'cover' | 'stretch';
  opacity: number;
  muted: boolean;
}
```

### 5. Shaders

Shaders provide runtime visual effects that can be applied to surfaces.

#### Supported Languages

- **WGSL**: WebGPU Shading Language
- **HLSL**: High-Level Shading Language (DirectX)
- **SPIR-V**: Vulkan bytecode

#### Features

- Surface-specific shader application
- Layer composition
- Animation integration
- Performance tier adaptation

### 6. Animations

Animations define shell transitions and overlay effects.

#### Types

- **Shell Transitions**: Page changes, panel opens/closes
- **Overlay Animations**: Modal, tooltip, menu animations
- **Micro-interactions**: Button hovers, focus states

#### Configuration

```typescript
interface AnimationDefinition {
  id: string;
  name: string;
  duration: number;
  easing: string;
  type: 'transition' | 'overlay' | 'micro';
  target: string;
}
```

### 7. Sound Packs

Sound packs provide audio feedback for UI interactions.

#### Cue Categories

- **Navigation**: Folder open, navigation sounds
- **Actions**: Copy, delete, save feedback
- **Notifications**: Alert and notification sounds
- **System**: Window open/close, focus sounds

#### Features

- First-class audio system integration
- Native notification sound support
- VST path management for audio workbench
- Per-cue volume and enabled state

### 8. Interaction Motion

Interaction motion defines micro-interactions and spring profiles.

#### Built-in Profiles

- **Subtle**: Minimal motion for professional workflows
- **Spring**: Bouncy, responsive interactions
- **Playful**: Expressive, fun interactions

#### Configuration

```typescript
interface InteractionMotionProfile {
  id: string;
  name: string;
  springMass: number;
  springStiffness: number;
  springDamping: number;
  duration: number;
}
```

#### Features

- Per-surface motion toggles
- Intensity scaling
- Theme-driven defaults
- Performance-aware adaptation

### 9. Shell Renderers

Shell renderers provide custom navigation and launcher systems.

#### Available Renderers

- **Workbench Tabs**: Traditional tab-based navigation
- **Cross-Axis Media**: Media-focused horizontal layout
- **Channel Launcher**: App-channel style navigation
- **Desktop Stack**: Window-stacking desktop metaphor

#### Custom Renderers

Theme packages can include custom shell renderers that completely change the navigation model.

### 10. Theme Recipes

Theme recipes define workbench and explorer chrome behavior.

#### Workbench Recipes

```typescript
interface WorkbenchRecipe {
  chromeLayout: string;
  panelBehavior: 'docked' | 'floating' | 'overlay';
  windowControls: 'left' | 'right' | 'hidden';
  density: 'compact' | 'comfortable' | 'spacious';
}
```

#### Explorer Recipes

```typescript
interface ExplorerRecipe {
  viewMode: 'grid' | 'list' | 'constellation';
  previewEnabled: boolean;
  previewWidth: number;
  sidebarWidth: number;
  chromeStyle: 'minimal' | 'standard' | 'rich';
}
```

### 11. Theme Engines

Theme engines provide design tokens, layout primitives, and navigation patterns.

#### Design Tokens

```typescript
interface ThemeDesignTokens {
  color: ThemeTokenScale;
  typography: ThemeTokenScale;
  spacing: ThemeTokenScale;
  radius: ThemeTokenScale;
  shadow: ThemeTokenScale;
  motion: ThemeTokenScale;
}
```

#### Layout Primitives

```typescript
interface ThemeLayoutPrimitive {
  id: string;
  name: string;
  kind: 'panel' | 'toolbar' | 'rail' | 'drawer';
  props: Record<string, string | number | boolean>;
}
```

#### Navigation Patterns

```typescript
interface ThemeNavigationPattern {
  id: string;
  name: string;
  kind: 'tabs' | 'rail' | 'drawer' | 'hybrid';
  axis: 'horizontal' | 'vertical' | 'both';
  props: Record<string, string | number | boolean>;
}
```

### 12. Home Packs

Home packs define startup surfaces shown when opening the explorer home.

#### Built-in Packs

- **Command Center**: Quick access to common actions
- **Favorites Deck**: Favorite files and folders

#### Custom Packs

Theme packages can include custom home packs that provide branded startup experiences.

### 13. Menu Packs

Menu packs define context menu composition and behavior.

#### Features

- Layered authored runtime
- Command graph integration
- Per-context overrides
- Preview-pane adaptation

---

## VS Code Theme Compatibility

GreebleFS can import VS Code themes as first-class compatibility packages.

### Supported Sources

- **VS Code Color Themes**: `.vsix` archives or theme folders
- **VS Code Icon Themes**: `.vsix` archives or icon theme folders

### Compatibility Layer

```typescript
// src/config/vscodeThemeCompatibility.ts
interface VSCodeCompatibility {
  resolveExtensionRoot(path: string): string;
  parseThemeManifest(source: string): VSCodeThemeManifest;
  adaptToGreebleFormat(theme: VSCodeThemeManifest): OverlayThemeDefinition;
}
```

### Features

- Parses `package.json` and `extension/package.json`
- Follows VS Code color-theme `include` chains
- Converts font-backed icons to inline SVG data URLs
- Preserves raw normalized theme payload
- Tags themes with source kind (`vscode-theme-directory`, `vscode-theme-vsix`)

### Monaco Integration

```typescript
// src/config/explorerMonaco.ts
interface MonacoThemeBridge {
  deriveThemeId(appearance: ResolvedOverlayAppearance): string;
  applyTokenColors(theme: VSCodeThemeManifest): void;
}
```

Monaco surfaces derive their theme from the active resolved appearance and layer in VS Code token colors when the active theme came from a VS Code import.

---

## Theme Catalog Curation

### Tier System

Themes are organized into catalog tiers:

| Tier | Description | Badge |
|------|-------------|-------|
| **Official** | Built-in pilot themes | None |
| **Stable** | Curated third-party themes | ✓ |
| **Lab** | Experimental themes | 🔬 |
| **Legacy** | Older themes for compatibility | 📦 |

### Metadata

```typescript
interface ThemeCatalogMetadata {
  tierId: string;
  tierLabel: string;
  tierDescription: string;
  tierOrder: number;
  badgeLabel: string;
  sortRank: number;
  suiteId: string | null;
  suiteLabel: string | null;
}
```

### Sorting

Themes are sorted by:
1. Tier order (Official > Stable > Lab > Legacy)
2. Sort rank within tier
3. Name alphabetically

---

## Pilot Theme Defaults

GreebleFS includes canonical built-in baseline themes.

### Pilot Dark

```json
{
  "id": "pilot-dark",
  "name": "Pilot Dark",
  "appearance": {
    "palette": { /* dark colors */ },
    "typography": { /* dark typography */ },
    "effects": { /* dark effects */ }
  },
  "workbench": { /* workbench defaults */ },
  "explorer": { /* explorer defaults */ }
}
```

### Pilot Light

```json
{
  "id": "pilot-light",
  "name": "Pilot Light",
  "appearance": {
    "palette": { /* light colors */ },
    "typography": { /* light typography */ },
    "effects": { /* light effects */ }
  },
  "workbench": { /* workbench defaults */ },
  "explorer": { /* explorer defaults */ }
}
```

### Pilot Dock Theme

A separate dock-specific theme with optional recipe overlays:

```typescript
interface PilotDockThemeRecipe {
  explorerTheme: OverlayExplorerThemeRecipe;
  workbenchTheme: OverlayWorkbenchThemeRecipe;
  overrides: DockRecipeOverrides;
}
```

---

## Theme Resolution Pipeline

### 1. Discovery

Themes are discovered from:
- Built-in themes (compiled into app)
- `themes/` directory in managed content
- Plugin-contributed themes
- VS Code compatibility imports

### 2. Loading

```typescript
async function loadTheme(themeId: string): Promise<LoadedThemePackage> {
  const manifest = await resolveThemeManifest(themeId);
  const components = await loadThemeComponents(manifest);
  return {
    manifest,
    components,
    sourceKind: manifest.source,
    sourceInfo: manifest.sourceInfo
  };
}
```

### 3. Compilation

```typescript
function compileTheme(manifest: ThemeManifest): CompiledThemeEngineManifest {
  return {
    manifest,
    designTokenLookup: compileDesignTokens(manifest),
    layoutPrimitiveLookup: compileLayoutPrimitives(manifest),
    navigationPatternLookup: compileNavigationPatterns(manifest),
    animationProfileLookup: compileAnimationProfiles(manifest),
    iconPackLookup: compileIconPacks(manifest),
    renderStyleLookup: compileRenderStyles(manifest),
    defaultDesignToken: manifest.tokens?.default ?? null
  };
}
```

### 4. Resolution

```typescript
function resolveAppearance(
  theme: LoadedThemePackage,
  overrides?: Partial<ResolvedOverlayAppearance>
): ResolvedOverlayAppearance {
  // Merge theme with overrides
  // Apply VS Code compatibility if needed
  // Resolve CSS variables
  // Return final appearance
}
```

### 5. Application

```typescript
function applyAppearance(appearance: ResolvedOverlayAppearance): void {
  // Apply CSS variables to document root
  // Update theme engine state
  // Trigger re-render of themed components
  // Update Monaco/Misc theme consumers
}
```

---

## CSS Variable Contract

GreebleFS themes produce a comprehensive CSS variable contract.

### Core Variables

```css
:root {
  /* Colors */
  --overlay-app-background: #1a1a2e;
  --overlay-app-background-alt: #16213e;
  --overlay-shell-background: #0f3460;
  --overlay-shell-background-solid: #1a1a2e;
  --overlay-topbar-background: #0f3460;
  --overlay-sidebar-background: #16213e;
  --overlay-panel-background: #1a1a2e;

  /* Typography */
  --overlay-font-family: 'Inter', system-ui, sans-serif;
  --overlay-font-family-mono: 'JetBrains Mono', monospace;
  --overlay-font-size-base: 14px;
  --overlay-font-size-sm: 12px;
  --overlay-font-size-lg: 16px;

  /* Spacing */
  --overlay-spacing-xs: 4px;
  --overlay-spacing-sm: 8px;
  --overlay-spacing-md: 16px;
  --overlay-spacing-lg: 24px;
  --overlay-spacing-xl: 32px;

  /* Radius */
  --overlay-radius-sm: 4px;
  --overlay-radius-md: 8px;
  --overlay-radius-lg: 12px;
  --overlay-radius-full: 9999px;

  /* Effects */
  --overlay-shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.3);
  --overlay-shadow-md: 0 4px 6px rgba(0, 0, 0, 0.3);
  --overlay-shadow-lg: 0 10px 15px rgba(0, 0, 0, 0.3);
}
```

### Component Variables

```css
/* Explorer */
--explorer-rail-width: 256px;
--explorer-preview-width: 320px;
--explorer-row-height: 32px;
--explorer-grid-gap: 12px;

/* Terminal */
--terminal-background: #0f3460;
--terminal-foreground: #e94560;
--terminal-font-family: 'JetBrains Mono', monospace;
--terminal-font-size: 14px;

/* Panels */
--panel-header-height: 40px;
--panel-padding: 16px;
--panel-radius: 8px;
```

---

## Theme Development

### Creating a Theme

1. Create theme directory: `themes/my-theme/`
2. Add `theme.json` manifest
3. Add component folders as needed
4. Test with `bun run dev`

### Theme Validation

```bash
# Validate theme structure
bun run validate:theme my-theme

# Check for missing components
bun run validate:theme --strict my-theme
```

### Hot Reload

In developer mode, themes support hot reloading:
1. Edit theme files in `themes/`
2. Changes apply immediately
3. No app restart required

---

## Performance Considerations

### Effects Tiers

Themes can specify effects tiers for adaptive performance:

```typescript
interface ThemeEffectsTier {
  id: 'full' | 'reduced' | 'minimal';
  animations: boolean;
  shaders: boolean;
  shadows: boolean;
  blur: boolean;
  transitions: boolean;
}
```

### GPU Tier Policy

```typescript
interface GPUTierPolicy {
  mode: 'auto' | 'safe' | 'integrated' | 'discrete';
  effects: {
    full: string[];
    reduced: string[];
    minimal: string[];
  };
}
```

---

## Summary

GreebleFS theming system provides:

- **Bundle-First Architecture**: Modular theme composition with inheritance
- **Deep Customization**: Transform every aspect of the shell
- **VS Code Compatibility**: Import existing VS Code themes
- **Runtime Composition**: Themes are discovered and loaded at runtime
- **Performance Adaptation**: Effects tiers and GPU-aware rendering
- **Extensibility**: Plugin-contributed themes and components

The theming system is a core architectural feature that enables GreebleFS to feel like multiple different applications while sharing a common codebase.