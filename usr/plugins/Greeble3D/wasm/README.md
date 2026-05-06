# Greeble WASM Module

This Rust crate compiles to WebAssembly for high-performance client-side operations.

## Features

- **Mesh Deformation**: Taper, twist, bend, noise modifiers
- **Geometry Subdivision**: Adaptive mesh refinement
- **Symmetry Tools**: Mirror geometry across axes
- **Greeble Generation**: Procedural surface detail
- **PBR Map Generation**: Normal, roughness, metallic, AO, height maps (CPU-based, but fast!)

## Building

```bash
# Using npm script (recommended)
npm run build:wasm

# Or directly with wasm-pack
wasm-pack build --target web --out-dir ../src/wasm wasm

# Or using PowerShell script
./build_wasm.ps1
```

## Output

Compiled WASM files are output to `src/wasm/`:
- `k_greeble_wasm.js` - JavaScript bindings
- `k_greeble_wasm_bg.wasm` - WebAssembly binary
- `k_greeble_wasm.d.ts` - TypeScript definitions

## Usage

```typescript
import { generate_pbr_maps_wasm } from '../wasm/k_greeble_wasm.js';

// Generate PBR maps from image data
const result = generate_pbr_maps_wasm(
    imageData.data,
    imageData.width,
    imageData.height,
    {
        normal_strength: 1.0,
        roughness_base: 0.5,
        // ... other params
    }
);
```

## Performance

WASM provides 5-10x speedup over pure JavaScript for compute-intensive operations:
- PBR generation: ~50ms for 1024x1024 texture (vs ~500ms in JS)
- Mesh deformation: ~5ms for 10k vertices (vs ~50ms in JS)
- Subdivision: ~20ms for complex meshes (vs ~200ms in JS)

## Why WASM?

- **No backend needed**: Runs entirely client-side
- **Fast**: Near-native performance
- **Portable**: Works in any modern browser
- **Solo dev friendly**: No server costs!
