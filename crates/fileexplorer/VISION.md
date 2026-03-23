# Vision

## Product Thesis

This product is a desktop workspace for files, not a themed clone of an existing file manager.

Yazi is the engine foundation because it is fast, asynchronous, modular, and already opinionated about previews, plugins, tasks, and file workflows. The product built on top of it should feel like a premium creative operating environment: a shell where browsing files, opening tools, previewing assets, running commands, and switching visual identities all feel intentional.

The existing `overlayterm` prototype proved the emotional direction:

- The app should feel like a workbench, not a settings page wrapped around a directory list.
- The file explorer can be a hero surface, but it must live inside a broader desktop shell.
- Themes are not only colors; they alter mood, chrome, motion, iconography, and composition.
- Layouts must be allowed to change dramatically without rewriting the product.

## What The Product Is

- A desktop application shell with a powerful file-centric workspace at its center.
- A Yazi-backed engine with a custom premium UI.
- A panel-based workspace that can host explorer, preview, terminal, tasks, plugins, search, and future tool surfaces.
- A fully themeable and layout-transformable application.
- A system that can support very different visual modes without forking the app.

## What The Product Is Not

- Not a literal Yazi skin.
- Not a terminal app wrapped in a WebView.
- Not a one-off UE5 content browser clone.
- Not a theme system limited to accent colors and wallpaper swaps.
- Not a frontend that owns filesystem truth.

## Experience Goals

- Fast enough to feel native and trustworthy.
- Rich enough to feel like a premium desktop tool.
- Flexible enough to support radically different shell identities.
- Structured enough that AI agents can build features without collapsing the design.

## Core Product Pillars

### 1. Shell First

Build a real app shell before over-optimizing the content browser. The shell owns navigation, layout, commands, settings, notifications, jobs, plugin management, and workspace composition.

### 2. Content Workspace As The Hero Mode

The file browser should become a flagship workspace with strong previewing, selection, metadata, actions, and navigation. It can be heavily inspired by UE-style content workflows, but it should sit inside a stable application frame.

### 3. Engine / Presentation Separation

Yazi and surrounding Rust services own domain behavior. The frontend renders state and sends intents. Filesystem truth, job truth, and preview truth should not live in view components.

### 4. Transformative Theming

Themes must be able to change:

- color language
- typography
- icon packs
- shell chrome
- panel surfaces
- motion defaults
- shader layers
- wallpaper and atmosphere
- layout presets

This is how the product can credibly support directions like:

- PS3 XMB-inspired flow
- classic 1980s / hackintosh / retro desktop moods
- Nintendo DS-like split or touch-forward layouts
- Windows 8 / Metro-inspired board and tile compositions
- futuristic glass, neon, and cinematic shells

### 5. Premium By Default

The base product should already feel curated. Themes and layouts are not excuses for visual chaos. Even highly stylized modes should feel intentional and usable.

## Design Principles

- Make the app feel like a desktop environment, not a website.
- Favor clear hierarchy, strong surfaces, and deliberate motion.
- Avoid generic dashboard aesthetics.
- Preserve speed and legibility even in highly stylized themes.
- Keep visual experimentation inside a system, not as one-off hacks.

## Strategic Interpretation Of OverlayTerm

`overlayterm` should be treated as a taste prototype and reference library:

- keep its mood, ambition, and useful workflows
- keep its ideas around themes, animations, shaders, and layouts
- keep its notion of a content-rich shell
- do not port its monolithic frontend architecture directly

The next system should preserve the vision while replacing the fragile parts with cleaner boundaries.

## Initial Success Criteria

The project is on the right track when:

- the shell exists independently of any one workspace
- the explorer is powered by Yazi-backed domain services
- frontend/backend communication is typed and generated
- no component hardcodes theme-specific values
- at least two radically different visual identities can be implemented without architectural hacks
- future AI agents can understand the system from docs alone
