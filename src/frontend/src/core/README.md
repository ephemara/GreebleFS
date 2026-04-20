# K_OS CORE LIBRARY

> **FOR AI AGENTS** | Shared systems across K-apps

```
LOCATION: src/core/
STATUS: PARTIAL USE (apps migrating to app-specific systems)
```

---

## DIRECTORY

```
core/
├── ui/                     # UI Components
│   ├── KButton.tsx         # Button variants
│   ├── KSlider.tsx         # Range input
│   ├── KCheckbox.tsx       # Checkbox
│   ├── KInput.tsx          # Text input
│   ├── KPanel.tsx          # Sidebar panel (legacy)
│   ├── KTabBar.tsx         # Tab navigation
│   ├── KSection.tsx        # Section wrapper
│   ├── KPanelV2/           # MODERN PANEL SYSTEM ←
│   │   ├── KTopBar.tsx     # Toolbar container
│   │   ├── KLeftPanel.tsx  # Left sidebar
│   │   ├── KRightPanel.tsx # Right sidebar
│   │   ├── PanelSection.tsx # Panel section
│   │   └── PanelTabs.tsx   # Panel tabs
│   ├── KContentBrowser/    # Asset browser
│   └── widgets/            # Misc widgets
├── shaders/                # GLSL includes [still used]
├── animation/              # useAnimation hook
├── materials/              # PBR material utils
├── physics/                # Rapier wrappers
├── three/                  # Three.js helpers
├── surface/                # PaintSystem [KPainter core]
├── hooks/                  # React hooks
└── types/                  # Shared types
```

---

## KPANELV2 SYSTEM

```
ACTIVE USERS: KSculpt KTecton KPainter KGreeble

PATTERN:
  <KTopBar>       # Header with tools/actions
    <KLeftPanel>  # Brush/tool controls
      <content>
    </KLeftPanel>
    <KRightPanel> # Properties/layers
      <content>
    </KRightPanel>
  </KTopBar>

IMPORT: import { KTopBar, KLeftPanel, KRightPanel } from '@/core/ui/KPanelV2'
```

---

## LEGACY UI (KPanel v1)

```
STATUS: Still works, being replaced by KPanelV2
PATTERN: <KPanel position="left" width="w-80">
```

---

## SHADERS

```
LOCATION: core/shaders/
STILL USED: Yes (Three.js apps)

EXPORTS:
  SIMPLEX_NOISE      # Simplex noise GLSL
  RANDOM_FUNCTION    # Random generator
  HASH_FUNCTION      # Hash function
  SIMPLE_VERTEX      # Basic vertex shader
  FULLSCREEN_VERTEX  # Fullscreen quad
  ROTATE_UV          # UV rotation
  CIRCULAR_FALLOFF   # Brush falloff

USAGE:
  import { SIMPLEX_NOISE } from '@/core/shaders';
  const frag = `${SIMPLEX_NOISE} ...`;
```

---

## PAINTSYSTEM

```
LOCATION: core/surface/PaintSystem.ts
USED BY: KPainter only

EXPORTS:
  PaintEngine        # GPU paint pipeline
  PaintLayer         # Layer class
  TEXTURE_SIZE       # Default texture size (2048)

NOTE: Core paint logic, but KPainter.tsx has additional
      Rust integrations not in this file
```

---

## HOOKS

```
core/hooks/useInput.ts    # Keyboard action system
core/hooks/useMouse.ts    # Mouse tracking
core/hooks/usePython.ts   # Python sidecar hook
```

---

## ADOPTION STATUS

```
APP          KPANELV2  SHADERS  PAINTSYSTEM  ANIMATION
─────────────────────────────────────────────────────
KSculpt      ✓         -        -            -
KPainter     ✓         ✓        ✓            -
KTecton      ✓         ✓        -            -
KGreeble     ✓         -        -            ✓
KScatter     partial   -        -            -
KAtlas       -         -        -            -
KGraphos     -         ✓        -            ✓
```

---

## NOTES

```
- Apps increasingly have app-specific systems
- KPainter: Rust fluid/raycast bypasses core
- KSculpt: Bevy replaces Three.js entirely
- Core remains useful for shared UI patterns
- Shaders library still valuable for Three.js apps
```
