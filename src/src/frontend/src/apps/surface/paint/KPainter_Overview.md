# KPAINTER ARCHITECTURE

> **FOR AI AGENTS** | 84KB main component | Rust-accelerated

```
LOCATION: src/apps/surface/paint/
STATUS: Active, Rust migration in progress
SIZE: 84KB main + 35KB brush engine
```

---

## FILE MAP

```
KPainter.tsx              # 84KB Main component + engine init
KPaintBrushEngine.tsx     # 35KB GPU paint pipeline
KPaintMouse.tsx           # Input hook (usePaintInput)
PainterContext.tsx        # React Context (state)
InkSystem.ts              # Vector ink strokes
KPainterUI.tsx            # Left panel
KPainterTopBar.tsx        # Toolbar
KPainterRightPanel.tsx    # Right panel
KPainterLayers.tsx        # Layer stack
KPainterAlphas.tsx        # Alpha browser
KPainterMats.tsx          # Material browser
KPainterTexturesPanel.tsx # Texture panel
KPainterQuickMenu.tsx     # Quick access menu
KPainterSpaceMenu.tsx     # Space menu
useKPainterKeybinds.ts    # Shortcuts
```

---

## RUST INTEGRATIONS

```
SERVICE                   PURPOSE                    FILE
────────────────────────────────────────────────────────────
rustFluid.ts              SPH Fluid Simulation       fluid.rs
rustRaycastUVManager      BVH UV Raycasting          raycast.rs
brushDynamics.ts          Stroke Interpolation       brush_dynamics.rs

IMPORTS IN KPainter.tsx:
  import { RustFluidSim } from '../../../services/rustFluid';
  import { rustRaycastUVManager } from '../../../services/raycastClient';
```

---

## ARCHITECTURE

```
┌─────────────────────────────────────────────────────────────┐
│                      KPAINTER                               │
├─────────────────────────────────────────────────────────────┤
│  REACT STATE              │  REFS (Hot Path)               │
│  [layers, brush, etc]     │  [engine, paintEngine, etc]    │
│  Slow updates (UI)        │  Fast updates (60fps paint)    │
├─────────────────────────────────────────────────────────────┤
│  THREE.JS                 │  RUST (via Tauri invoke)       │
│  Scene, Camera, Renderer  │  Fluid sim, Raycast, Dynamics  │
│  PaintEngine (GPU)        │  10-50x faster than JS         │
├─────────────────────────────────────────────────────────────┤
│  GPU PIPELINE (PaintEngine)                                 │
│  RenderTargets → Brush Shader → Ping-Pong → Composite       │
└─────────────────────────────────────────────────────────────┘
```

---

## PAINT SYSTEM

```
TEXTURE SIZE: 2048x2048 default (TEXTURE_SIZE constant)

CHANNELS: 5 per layer
  albedo     # Base color
  normal     # Normal map
  roughness  # Roughness
  metalness  # Metalness
  emission   # Emission

PING-PONG: Each channel has Read/Write RenderTargets
  Paint: Read → BrushShader → Write → Swap

COMPOSITE: All layers → CompositeLayer → Mesh material
```

---

## BRUSH SYSTEM

```
BRUSH STATE:
  size, opacity, hardness, color
  roughness, metalness, emission
  flow, spacing
  alphaMap (texture)
  projectionMode (3D raycasting)
  type: 'standard' | 'INK'

MODIFIERS (activeMods):
  hydro       # Fluid dynamics
  particulate # Scatter particles
  entropy     # Randomization
  vortex      # Spiral effect
  drip        # Gravity drip
  reaction    # Gray-Scott diffusion
  ...etc

BLACK HOLE: Kerr black hole effect
  strength, spin, radius, decay
```

---

## LAYERS

```
LAYER STRUCTURE:
  { id, name, visible }

TEXTURE SET: Multiple meshes can share texture slots
  { id, name, meshes[], layers[], compositeLayer }

HISTORY: Undo/Redo via layer snapshots
  undoStack[], redoStack[] (max 20)
```

---

## INPUT FLOW

```
1. Mouse → usePaintInput → UV coords
2. UV → KPainter.paint() → PaintEngine
3. PaintEngine → BrushShader → RenderTarget
4. Composite → Mesh.material maps
```

---

## SYMMETRY

```
MODES: X, Y, Z axis mirroring + Radial
STATE: { x: bool, y: bool, z: bool, radial: bool, radialCount: int }

IMPLEMENTATION:
  - Convert world cursor to mesh local space
  - Mirror positions based on active axes
  - Raycast each mirrored position to get UVs
  - Apply brush at each UV
```

---

## RUST FLUID (Hydro Mode)

```
INIT: rustFluidRef = new RustFluidSim()
TRIGGER: activeMods.hydro === true

FLOW:
  1. User paints → splatVelocity(layer, uv, delta, size)
  2. Rust: fluid.rs steps SPH simulation
  3. Returns velocity grid
  4. PaintEngine advects paint along velocities
```

---

## PROJECTION PAINTING

```
MODE: brush.projectionMode (default: true)
USE: Paint in screen space, project onto mesh

REQUIRES:
  - three-mesh-bvh for fast raycasting
  - bakeGeometry() called on mesh load
  - worldPos injected into brush params
```

---

## FUTURE: BEVY PORT

```
STATUS: Planned (not started)
REASON: GPU-accelerated paint in native Rust
APPROACH: Similar to KSculpt Bevy migration
```
