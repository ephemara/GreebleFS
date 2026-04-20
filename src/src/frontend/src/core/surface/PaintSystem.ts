
import * as THREE from 'three';
import {
    BRUSH_VERT, BRUSH_FRAG, COPY_VERT, COPY_FRAG, FILL_FRAG,
    SIM_VERT, REACTION_FRAG, VORTEX_FRAG, FERRO_FRAG, QUANTUM_FRAG, CHRONOS_FRAG,
    BAKE_VERT, NORMAL_BAKE_FRAG, POS_BAKE_FRAG, CURVATURE_COMPUTE_FRAG,
    GRAVITY_FRAG, RIVULET_FRAG, GROWTH_FRAG, BLACK_HOLE_FRAG
} from './PaintShaders';
import { FLUID_ADVECT, FLUID_DIV, FLUID_PRESS, FLUID_GRAD, FLUID_SPLAT } from '../shaders/physicsShaders';
import { MaskSystem } from './MaskSystem';

export const TEXTURE_SIZE = 2048;
const FLUID_SIZE = 512;

export class PaintLayer {
    id: string;
    name: string;
    channels: { [key: string]: THREE.WebGLRenderTarget[] };
    fluid: {
        velocity: THREE.WebGLRenderTarget[];
        pressure: THREE.WebGLRenderTarget[];
        divergence: THREE.WebGLRenderTarget;
    };
    visible: boolean = true;
    opacity: number = 1.0;

    constructor(id: string, name: string, width: number, height: number) {
        this.id = id;
        this.name = name;

        const options = {
            minFilter: THREE.LinearFilter,
            magFilter: THREE.LinearFilter,
            type: THREE.HalfFloatType,
            format: THREE.RGBAFormat,
            depthBuffer: false,
            stencilBuffer: false
        };

        this.channels = {
            albedo: [new THREE.WebGLRenderTarget(width, height, options), new THREE.WebGLRenderTarget(width, height, options)],
            normal: [new THREE.WebGLRenderTarget(width, height, options), new THREE.WebGLRenderTarget(width, height, options)],
            roughness: [new THREE.WebGLRenderTarget(width, height, options), new THREE.WebGLRenderTarget(width, height, options)],
            metalness: [new THREE.WebGLRenderTarget(width, height, options), new THREE.WebGLRenderTarget(width, height, options)],
            emission: [new THREE.WebGLRenderTarget(width, height, options), new THREE.WebGLRenderTarget(width, height, options)]
        };

        const fOpt = { type: THREE.HalfFloatType, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, format: THREE.RGBAFormat };
        this.fluid = {
            velocity: [new THREE.WebGLRenderTarget(FLUID_SIZE, FLUID_SIZE, fOpt), new THREE.WebGLRenderTarget(FLUID_SIZE, FLUID_SIZE, fOpt)],
            pressure: [new THREE.WebGLRenderTarget(FLUID_SIZE, FLUID_SIZE, fOpt), new THREE.WebGLRenderTarget(FLUID_SIZE, FLUID_SIZE, fOpt)],
            divergence: new THREE.WebGLRenderTarget(FLUID_SIZE, FLUID_SIZE, fOpt)
        };
    }

    getRead(channel: string) { return this.channels[channel][0]; }
    getWrite(channel: string) { return this.channels[channel][1]; }
    swap(channel: string) { const temp = this.channels[channel][0]; this.channels[channel][0] = this.channels[channel][1]; this.channels[channel][1] = temp; }

    dispose() {
        Object.values(this.channels).forEach(pair => pair.forEach(rt => rt.dispose()));
        this.fluid.velocity.forEach(rt => rt.dispose());
        this.fluid.pressure.forEach(rt => rt.dispose());
        this.fluid.divergence.dispose();
    }
}

export class PaintEngine {
    renderer: THREE.WebGLRenderer;
    paintScene = new THREE.Scene();
    paintCamera = new THREE.OrthographicCamera(0, 1, 1, 0, 0, 10);
    brushMesh: THREE.Mesh;
    brushMaterial: THREE.ShaderMaterial;

    copyScene = new THREE.Scene();
    copyCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    copyMesh: THREE.Mesh;
    copyMaterial: THREE.ShaderMaterial;
    fillMaterial: THREE.ShaderMaterial;

    // Sub-Systems
    maskSystem: MaskSystem;

    // Baking
    bakeScene = new THREE.Scene();
    bakeMaterials: {
        normal: THREE.ShaderMaterial;
        position: THREE.ShaderMaterial;
        curvature: THREE.ShaderMaterial;
    };
    meshMaps: {
        normal: THREE.WebGLRenderTarget;
        position: THREE.WebGLRenderTarget;
        curvature: THREE.WebGLRenderTarget;
    };

    simMaterials: any;
    clock = new THREE.Clock();

    // Picker
    pixelBuffer = new Float32Array(4);

    _tempColor = new THREE.Color();
    _tempVec3 = new THREE.Vector3();

    constructor(renderer: THREE.WebGLRenderer) {
        this.renderer = renderer;
        this.paintCamera.position.z = 1;

        // Initialize Mask System
        this.maskSystem = new MaskSystem(renderer, TEXTURE_SIZE);

        this.brushMaterial = new THREE.ShaderMaterial({
            uniforms: {
                uColor: { value: new THREE.Color(1, 1, 1) },
                uOpacity: { value: 1.0 },
                uHardness: { value: 0.5 },
                uAngle: { value: 0.0 },
                uBrushAlpha: { value: null },
                uUseBrushAlpha: { value: false },
                uSrcTex: { value: null },
                uUseSrcTex: { value: false },
                uTexScale: { value: 3.0 },
                // Masking
                uMaskMap: { value: this.maskSystem.target.texture },
                uUseMask: { value: true },
                // Smart Masks
                uUseSmartMask: { value: false },
                uCurvatureMap: { value: null },
                uNormalMap: { value: null },
                uPositionMap: { value: null },
                uEdgeMask: { value: 0.0 },
                uSlopeMask: { value: 0.0 },
                uHeightMask: { value: 0.0 },
                // Projection Mode
                uProjectionMode: { value: false },
                uBrushPos: { value: new THREE.Vector3() },
                uBrushRadius: { value: 0.1 }
            },
            vertexShader: BRUSH_VERT,
            fragmentShader: BRUSH_FRAG,
            transparent: true,
            blending: THREE.NormalBlending
        });
        this.brushMesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), this.brushMaterial);
        this.brushMesh.visible = false;
        this.paintScene.add(this.brushMesh);

        // Reuse objects to reduce GC
        // @ts-ignore
        this._tempColor = new THREE.Color();
        // @ts-ignore
        this._tempVec3 = new THREE.Vector3();

        this.copyMaterial = new THREE.ShaderMaterial({
            uniforms: { tDiffuse: { value: null }, uOpacity: { value: 1.0 } },
            vertexShader: COPY_VERT, fragmentShader: COPY_FRAG, transparent: true
        });
        this.copyMesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.copyMaterial);
        this.copyScene.add(this.copyMesh);

        this.fillMaterial = new THREE.ShaderMaterial({
            uniforms: { tSource: { value: null }, uUseTexture: { value: false }, uColor: { value: new THREE.Color(0, 0, 0) }, uAlpha: { value: 1.0 } },
            vertexShader: COPY_VERT, fragmentShader: FILL_FRAG
        });

        // Updated Baking Materials with Spread
        this.bakeMaterials = {
            normal: new THREE.ShaderMaterial({ vertexShader: BAKE_VERT, fragmentShader: NORMAL_BAKE_FRAG, side: THREE.DoubleSide }),
            position: new THREE.ShaderMaterial({ vertexShader: BAKE_VERT, fragmentShader: POS_BAKE_FRAG, side: THREE.DoubleSide }),
            curvature: new THREE.ShaderMaterial({
                uniforms: {
                    tNormal: { value: null },
                    resolution: { value: new THREE.Vector2(TEXTURE_SIZE, TEXTURE_SIZE) },
                    uSpread: { value: 3.0 } // Start with 3px spread for softer edges
                },
                vertexShader: COPY_VERT, fragmentShader: CURVATURE_COMPUTE_FRAG
            })
        };
        const mapOpts = { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, type: THREE.HalfFloatType };
        this.meshMaps = {
            normal: new THREE.WebGLRenderTarget(TEXTURE_SIZE, TEXTURE_SIZE, mapOpts),
            position: new THREE.WebGLRenderTarget(TEXTURE_SIZE, TEXTURE_SIZE, mapOpts),
            curvature: new THREE.WebGLRenderTarget(TEXTURE_SIZE, TEXTURE_SIZE, mapOpts)
        };

        this.simMaterials = {
            advect: new THREE.ShaderMaterial({ uniforms: { velocityTex: { value: null }, sourceTex: { value: null }, dt: { value: 0.016 }, dissipation: { value: 0.998 } }, vertexShader: SIM_VERT, fragmentShader: FLUID_ADVECT }),
            div: new THREE.ShaderMaterial({ uniforms: { velocityTex: { value: null }, texelSize: { value: new THREE.Vector2(1 / FLUID_SIZE, 1 / FLUID_SIZE) } }, vertexShader: SIM_VERT, fragmentShader: FLUID_DIV }),
            press: new THREE.ShaderMaterial({ uniforms: { pressureTex: { value: null }, divergenceTex: { value: null }, texelSize: { value: new THREE.Vector2(1 / FLUID_SIZE, 1 / FLUID_SIZE) } }, vertexShader: SIM_VERT, fragmentShader: FLUID_PRESS }),
            grad: new THREE.ShaderMaterial({ uniforms: { pressureTex: { value: null }, velocityTex: { value: null }, texelSize: { value: new THREE.Vector2(1 / FLUID_SIZE, 1 / FLUID_SIZE) } }, vertexShader: SIM_VERT, fragmentShader: FLUID_GRAD }),
            splat: new THREE.ShaderMaterial({ uniforms: { targetTex: { value: null }, point: { value: new THREE.Vector2() }, color: { value: new THREE.Vector3() }, radius: { value: 0.001 } }, vertexShader: SIM_VERT, fragmentShader: FLUID_SPLAT }),
            reaction: new THREE.ShaderMaterial({ uniforms: { tSource: { value: null }, resolution: { value: new THREE.Vector2(TEXTURE_SIZE, TEXTURE_SIZE) } }, vertexShader: SIM_VERT, fragmentShader: REACTION_FRAG }),
            vortex: new THREE.ShaderMaterial({ uniforms: { tSource: { value: null }, time: { value: 0 }, resolution: { value: new THREE.Vector2(TEXTURE_SIZE, TEXTURE_SIZE) } }, vertexShader: SIM_VERT, fragmentShader: VORTEX_FRAG }),
            gravity: new THREE.ShaderMaterial({ uniforms: { tSource: { value: null }, time: { value: 0 }, resolution: { value: new THREE.Vector2(TEXTURE_SIZE, TEXTURE_SIZE) }, uSpeed: { value: 1.0 } }, vertexShader: SIM_VERT, fragmentShader: GRAVITY_FRAG }),
            rivulet: new THREE.ShaderMaterial({ uniforms: { tSource: { value: null }, time: { value: 0 }, resolution: { value: new THREE.Vector2(TEXTURE_SIZE, TEXTURE_SIZE) }, uSpeed: { value: 1.0 }, uChaos: { value: 1.0 } }, vertexShader: SIM_VERT, fragmentShader: RIVULET_FRAG }),
            growth: new THREE.ShaderMaterial({ uniforms: { tSource: { value: null }, time: { value: 0 }, resolution: { value: new THREE.Vector2(TEXTURE_SIZE, TEXTURE_SIZE) }, uSpeed: { value: 1.0 }, uChaos: { value: 1.0 } }, vertexShader: SIM_VERT, fragmentShader: GROWTH_FRAG }),
            ferro: new THREE.ShaderMaterial({ uniforms: { tSource: { value: null }, resolution: { value: new THREE.Vector2(TEXTURE_SIZE, TEXTURE_SIZE) } }, vertexShader: SIM_VERT, fragmentShader: FERRO_FRAG }),
            quantum: new THREE.ShaderMaterial({ uniforms: { tSource: { value: null }, time: { value: 0 }, resolution: { value: new THREE.Vector2(TEXTURE_SIZE, TEXTURE_SIZE) } }, vertexShader: SIM_VERT, fragmentShader: QUANTUM_FRAG }),
            chronos: new THREE.ShaderMaterial({ uniforms: { tSource: { value: null }, time: { value: 0 } }, vertexShader: SIM_VERT, fragmentShader: CHRONOS_FRAG }),
            blackHole: new THREE.ShaderMaterial({
                uniforms: {
                    tVelocity: { value: null },
                    uCenter: { value: new THREE.Vector2(0.5, 0.5) },
                    uStrength: { value: 10.0 },
                    uSpin: { value: 5.0 },
                    uRadius: { value: 0.1 },
                    uDecay: { value: 0.95 },
                    uDt: { value: 0.016 }
                },
                vertexShader: SIM_VERT,
                fragmentShader: BLACK_HOLE_FRAG
            }),
        };
    }

    bakeGeometry(meshes: THREE.Mesh | THREE.Mesh[]) {
        this.bakeScene.clear();

        const targetMeshes = Array.isArray(meshes) ? meshes : [meshes];

        targetMeshes.forEach(mesh => {
            const clone = mesh.clone();
            // CRITICAL: We must match the World Transform of the original mesh
            // because uBrushPos is in World Space.
            mesh.updateMatrixWorld();
            clone.matrix.copy(mesh.matrixWorld);
            clone.matrix.decompose(clone.position, clone.quaternion, clone.scale);
            clone.matrixAutoUpdate = false; // Trust our matrix
            this.bakeScene.add(clone);
        });

        const oldAutoClear = this.renderer.autoClear;
        this.renderer.autoClear = false;

        // 1. Bake Normals
        this.bakeScene.overrideMaterial = this.bakeMaterials.normal;
        this.renderer.setRenderTarget(this.meshMaps.normal);
        this.renderer.setClearColor(0x8080ff, 1);
        this.renderer.clear();
        this.renderer.render(this.bakeScene, this.paintCamera);

        // 2. Bake Positions
        this.bakeScene.overrideMaterial = this.bakeMaterials.position;
        this.renderer.setRenderTarget(this.meshMaps.position);
        this.renderer.setClearColor(0x000000, 0);
        this.renderer.clear();
        this.renderer.render(this.bakeScene, this.paintCamera);

        this.bakeScene.overrideMaterial = null;

        // 3. Compute Curvature (Screen Space using Baked Normals)
        this.bakeMaterials.curvature.uniforms.tNormal.value = this.meshMaps.normal.texture;
        this.copyMesh.material = this.bakeMaterials.curvature;
        this.renderer.setRenderTarget(this.meshMaps.curvature);
        this.renderer.clear();
        this.renderer.render(this.copyScene, this.copyCamera);

        // 4. Assign to Brush
        this.brushMaterial.uniforms.uCurvatureMap.value = this.meshMaps.curvature.texture;
        this.brushMaterial.uniforms.uNormalMap.value = this.meshMaps.normal.texture;
        this.brushMaterial.uniforms.uPositionMap.value = this.meshMaps.position.texture;

        this.renderer.setRenderTarget(null);
        this.renderer.autoClear = oldAutoClear;
        this.bakeScene.clear();
    }

    clearLayer(layer: PaintLayer) {
        this.fillLayer(layer, { albedo: [0, 0, 0, 0], normal: [0.5, 0.5, 1, 0], roughness: [0.5, 0, 0, 0], metalness: [0, 0, 0, 0], emission: [0, 0, 0, 0] });
        const clearFluid = (rt: THREE.WebGLRenderTarget) => {
            this.renderer.setRenderTarget(rt);
            this.renderer.clear();
        };
        layer.fluid.velocity.forEach(clearFluid);
        layer.fluid.pressure.forEach(clearFluid);
        clearFluid(layer.fluid.divergence);
    }

    fillLayer(layer: PaintLayer, defaults = { albedo: [0.5, 0.5, 0.5, 0], normal: [0.5, 0.5, 1, 0], roughness: [0.5, 0, 0, 0], metalness: [0, 0, 0, 0], emission: [0, 0, 0, 0] }) {
        const fill = (r: number, g: number, b: number, a: number, channel: string) => {
            this.fillMaterial.uniforms.uUseTexture.value = false;
            this.fillMaterial.uniforms.uColor.value.setRGB(r, g, b);
            this.fillMaterial.uniforms.uAlpha.value = a;
            this.copyMesh.material = this.fillMaterial;
            this.renderer.setRenderTarget(layer.getRead(channel));
            this.renderer.render(this.copyScene, this.copyCamera);
            this.renderer.setRenderTarget(layer.getWrite(channel));
            this.renderer.render(this.copyScene, this.copyCamera);
        };
        fill(defaults.albedo[0], defaults.albedo[1], defaults.albedo[2], defaults.albedo[3], 'albedo');
        fill(defaults.normal[0], defaults.normal[1], defaults.normal[2], defaults.normal[3], 'normal');
        fill(defaults.roughness[0], defaults.roughness[1], defaults.roughness[2], defaults.roughness[3], 'roughness');
        fill(defaults.metalness[0], defaults.metalness[1], defaults.metalness[2], defaults.metalness[3], 'metalness');
        fill(defaults.emission[0], defaults.emission[1], defaults.emission[2], defaults.emission[3], 'emission');
        this.renderer.setRenderTarget(null);
    }

    fillLayerWithTextures(layer: PaintLayer, materialTextures: any, color: string) {
        const fillChannel = (channel: string, tex: THREE.Texture | null, solidColor: THREE.Color) => {
            const target = layer.getRead(channel);
            this.renderer.setRenderTarget(target);
            if (tex) {
                this.fillMaterial.uniforms.uUseTexture.value = true;
                this.fillMaterial.uniforms.tSource.value = tex;
            } else {
                this.fillMaterial.uniforms.uUseTexture.value = false;
                this.fillMaterial.uniforms.uColor.value = solidColor;
                this.fillMaterial.uniforms.uAlpha.value = 1.0;
            }
            this.copyMesh.material = this.fillMaterial;
            this.renderer.render(this.copyScene, this.copyCamera);
            this.copyTo(target, layer.getWrite(channel));
        };
        const c = new THREE.Color(color);
        fillChannel('albedo', materialTextures?.albedo, c);
        fillChannel('normal', materialTextures?.normal, new THREE.Color(0.5, 0.5, 1.0));
        fillChannel('roughness', materialTextures?.roughness, new THREE.Color(0.5, 0.5, 0.5));
        fillChannel('metalness', materialTextures?.metalness, new THREE.Color(0, 0, 0));
        fillChannel('emission', materialTextures?.emission, new THREE.Color(0, 0, 0));
        this.renderer.setRenderTarget(null);
    }

    // NEW: PICK COLOR (EYEDROPPER)
    pickColor(layer: PaintLayer, uv: THREE.Vector2): THREE.Color {
        const x = Math.floor(uv.x * TEXTURE_SIZE);
        const y = Math.floor(uv.y * TEXTURE_SIZE);

        // Read from Albedo Read Buffer
        this.renderer.readRenderTargetPixels(layer.getRead('albedo'), x, y, 1, 1, this.pixelBuffer);

        // Convert Float32Array [r, g, b, a] to Color
        return new THREE.Color(this.pixelBuffer[0], this.pixelBuffer[1], this.pixelBuffer[2]);
    }

    paint(
        uv: THREE.Vector2,
        brushParams: any,
        layer: PaintLayer,
        activeChannels: any,
        targetMesh: THREE.Mesh,
        materialTextures: any = null,
        isMasking: boolean = false,
        isEraseMask: boolean = false
    ) {
        this.paintBatch([{ uv, params: brushParams }], layer, activeChannels, targetMesh, materialTextures, isMasking, isEraseMask);
    }

    paintBatch(
        ops: { uv: THREE.Vector2, params: any }[],
        layer: PaintLayer,
        activeChannels: any,
        targetMesh: THREE.Mesh,
        materialTextures: any = null,
        isMasking: boolean = false,
        isEraseMask: boolean = false
    ) {
        if (ops.length === 0) return;

        // Use the first op's params for global settings (like masking)
        const firstParams = ops[0].params;

        if (isMasking) {
            // Masking doesn't support batching yet (or needs specific implementation)
            ops.forEach(op => this.maskSystem.paint(op.uv, op.params, isEraseMask));
            return;
        }

        if (!layer) return;
        this.brushMesh.visible = true;

        // Setup Common Uniforms that don't change per stroke (if any)
        // Actually most change per stroke (size, opacity, angle)

        if (firstParams.smartMask) {
            this.brushMaterial.uniforms.uUseSmartMask.value = true;
            this.brushMaterial.uniforms.uEdgeMask.value = firstParams.smartMask.edge;
            this.brushMaterial.uniforms.uSlopeMask.value = firstParams.smartMask.slope;
            this.brushMaterial.uniforms.uHeightMask.value = firstParams.smartMask.height;
        } else {
            this.brushMaterial.uniforms.uUseSmartMask.value = false;
        }

        this.brushMaterial.uniforms.uMaskMap.value = this.maskSystem.target.texture;
        this.brushMaterial.uniforms.uUseMask.value = true;

        const oldAutoClear = this.renderer.autoClear;
        this.renderer.autoClear = false;

        const renderChannel = (channel: string, solidColor: THREE.Color, srcTex: THREE.Texture | null) => {
            if (!activeChannels[channel]) return;
            const writeTarget = layer.getWrite(channel);
            const readTarget = layer.getRead(channel);
            this.renderer.setRenderTarget(writeTarget);

            // 1. Copy previous state (ONCE PER BATCH)
            this.copyMaterial.uniforms.tDiffuse.value = readTarget.texture;
            this.copyMaterial.uniforms.uOpacity.value = 1.0;
            this.copyMaterial.blending = THREE.NoBlending;
            this.copyMesh.material = this.copyMaterial;
            this.renderer.render(this.copyScene, this.copyCamera);

            // 2. Render all strokes
            this.brushMaterial.blending = THREE.NormalBlending;

            // Configure Texture (Common for channel)
            if (srcTex) {
                this.brushMaterial.uniforms.uColor.value.setHex(0xffffff);
                this.brushMaterial.uniforms.uSrcTex.value = srcTex;
                this.brushMaterial.uniforms.uUseSrcTex.value = true;
                if (srcTex.wrapS !== THREE.RepeatWrapping) {
                    srcTex.wrapS = THREE.RepeatWrapping; srcTex.wrapT = THREE.RepeatWrapping; srcTex.needsUpdate = true;
                }
            } else {
                this.brushMaterial.uniforms.uUseSrcTex.value = false;
                this.brushMaterial.uniforms.uSrcTex.value = null;
            }

            ops.forEach(op => {
                const p = op.params;
                const uv = op.uv;
                const brushSizeUV = p.size / TEXTURE_SIZE;

                // Update Per-Stroke Uniforms
                if (p.alphaMap) {
                    this.brushMaterial.uniforms.uUseBrushAlpha.value = true;
                    this.brushMaterial.uniforms.uBrushAlpha.value = p.alphaMap;
                } else {
                    this.brushMaterial.uniforms.uUseBrushAlpha.value = false;
                    this.brushMaterial.uniforms.uBrushAlpha.value = null;
                }

                this.brushMaterial.uniforms.uOpacity.value = p.flow * (p.opacity !== undefined ? p.opacity : 1.0);
                this.brushMaterial.uniforms.uHardness.value = p.hardness;
                this.brushMaterial.uniforms.uAngle.value = p.angle !== undefined ? p.angle : (Math.random() * 0.1);
                this.brushMaterial.uniforms.uTexScale.value = 5.0;

                // Set Color (if solid)
                if (!srcTex) {
                    // For non-texture channels, we might need to update color per stroke if we supported per-stroke color jitter
                    // But here we assume color is constant for the batch or handled by p.color if we want
                    // However, renderChannel takes 'solidColor' as arg.
                    // If we want per-stroke color, we need to parse p.color here.
                    // But 'solidColor' is passed from the caller (e.g. roughness value as color).
                    // For Albedo, p.color is used.
                    if (channel === 'albedo') {
                        this.brushMaterial.uniforms.uColor.value.set(p.color);
                    } else if (channel === 'roughness') {
                        const r = p.roughness;
                        this.brushMaterial.uniforms.uColor.value.setRGB(r, r, r);
                    } else if (channel === 'metalness') {
                        const m = p.metalness;
                        this.brushMaterial.uniforms.uColor.value.setRGB(m, m, m);
                    } else if (channel === 'emission') {
                        const e = p.emission;
                        // Use reusable color
                        this._tempColor.set(p.color);
                        this.brushMaterial.uniforms.uColor.value.copy(this._tempColor.multiplyScalar(e));
                    } else {
                        // Use reusable color object
                        this.brushMaterial.uniforms.uColor.value.copy(solidColor);
                    }
                }

                // Projection Mode Logic
                const isProjection = p.projectionMode;
                this.brushMaterial.uniforms.uProjectionMode.value = isProjection;

                if (isProjection && p.worldPos) {
                    this.brushMaterial.uniforms.uBrushPos.value.copy(p.worldPos);
                    // Calculate radius in world units roughly?
                    // Brush size 50 -> 0.1 world units?
                    // Let's assume size is "screenspace pixels" but we need world radius
                    // Heuristic: size 500 = radius 1.0
                    const worldRadius = (p.size / 500.0) * 0.5;
                    this.brushMaterial.uniforms.uBrushRadius.value = worldRadius;

                    // For projection painting, we must render the whole texture to check 3D distance for every pixel
                    this.brushMesh.scale.set(TEXTURE_SIZE / TEXTURE_SIZE, TEXTURE_SIZE / TEXTURE_SIZE, 1);
                    this.brushMesh.position.set(0.5, 0.5, 0); // Center of 0..1 UV space
                    this.brushMesh.scale.set(1, 1, 1);
                } else {
                    // Standard 2D UV Painting
                    this.brushMesh.scale.set(brushSizeUV, brushSizeUV, 1);

                    // Seamless Tiling Offsets
                    const offsets = [{ x: 0, y: 0 }];
                    if (p.isSeamless) {
                        const limit = brushSizeUV * 0.6;
                        if (uv.x < limit) offsets.push({ x: 1, y: 0 });
                        if (uv.x > 1 - limit) offsets.push({ x: -1, y: 0 });
                        if (uv.y < limit) offsets.push({ x: 0, y: 1 });
                        if (uv.y > 1 - limit) offsets.push({ x: 0, y: -1 });
                        if (uv.x < limit && uv.y < limit) offsets.push({ x: 1, y: 1 });
                        if (uv.x > 1 - limit && uv.y < limit) offsets.push({ x: -1, y: 1 });
                        if (uv.x < limit && uv.y > 1 - limit) offsets.push({ x: 1, y: -1 });
                        if (uv.x > 1 - limit && uv.y > 1 - limit) offsets.push({ x: -1, y: -1 });
                    }

                    offsets.forEach(off => {
                        this.brushMesh.position.set(uv.x + off.x, uv.y + off.y, 0);
                        this.renderer.render(this.paintScene, this.paintCamera);
                    });

                    // Return early for 2D mode as we handled render inside loop
                    return;
                }

                this.renderer.render(this.paintScene, this.paintCamera);
            });

            // 3. Swap (ONCE PER BATCH)
            layer.swap(channel);
        };

        // We need to handle the color/values for each channel.
        // In the original paint(), it calculated c, r, m, eVal once.
        // Here they might vary per stroke.
        // So renderChannel needs to be smarter or we pass null and let it extract from ops.

        // Albedo
        // All renderChannel calls now use reusable objects internally or implicit colors
        // Albedo
        this._tempColor.setHex(0x000000);
        renderChannel('albedo', this._tempColor, materialTextures?.albedo); // Color handled inside loop
        // Roughness
        this._tempColor.setHex(0x000000);
        renderChannel('roughness', this._tempColor, materialTextures?.roughness);
        // Metalness
        this._tempColor.setHex(0x000000);
        renderChannel('metalness', this._tempColor, materialTextures?.metalness);
        // Normal
        this._tempColor.setRGB(0.5, 0.5, 1.0);
        renderChannel('normal', this._tempColor, materialTextures?.normal);
        // Emission
        this._tempColor.setHex(0x000000);
        renderChannel('emission', this._tempColor, materialTextures?.emission);

        this.brushMesh.visible = false;
        this.renderer.setRenderTarget(null);
        this.renderer.autoClear = oldAutoClear;
    }

    splatVelocity(layer: PaintLayer, uv: THREE.Vector2, motion: THREE.Vector2, size: number) {
        const mats = this.simMaterials;
        const velRead = layer.fluid.velocity[0];
        const velWrite = layer.fluid.velocity[1];
        this.renderer.setRenderTarget(velWrite);
        this.copyMesh.material = mats.splat;
        mats.splat.uniforms.targetTex.value = velRead.texture;
        mats.splat.uniforms.point.value.copy(uv);
        mats.splat.uniforms.color.value.set(motion.x, motion.y, 0);
        mats.splat.uniforms.radius.value = size * 0.0005;
        this.renderer.render(this.copyScene, this.copyCamera);
        const temp = layer.fluid.velocity[0];
        layer.fluid.velocity[0] = layer.fluid.velocity[1];
        layer.fluid.velocity[1] = temp;
    }

    // --- VECTOR / MESH PAINTING ---
    // Renders a generic mesh (e.g. Ink Stroke) into the layer
    drawGeometry(geometry: THREE.BufferGeometry, layer: PaintLayer, brush: any) {
        if (!this.paintScene || !this.paintCamera) return;

        // 1. Setup Mesh
        const material = new THREE.MeshBasicMaterial({
            color: new THREE.Color(brush.color),
            transparent: true,
            opacity: brush.opacity
        });

        const mesh = new THREE.Mesh(geometry, material);
        // Ensure it's in front of camera? Ortho cam is at z=10, looking at z=0.
        // 2D UV space is x:0-1, y:0-1.
        // Camera matches this? 
        // paintCamera is OrthographicCamera(0, 1, 1, 0, 0, 10); (Left, Right, Top, Bottom)
        mesh.position.set(0, 0, 0);

        this.paintScene.clear();
        this.paintScene.add(mesh);

        const oldAutoClear = this.renderer.autoClear;
        this.renderer.autoClear = false;

        // 2. Render to Albedo (MVP)
        // Ideally we render to all channels based on brush settings
        // For 'Ink', we usually just want Color + rough/metal values.
        // Doing just Albedo for now.

        const readRT = layer.getRead('albedo');
        const writeRT = layer.getWrite('albedo');

        // A. Copy Back -> Front (Preserve previous paint)
        this.copyTo(readRT, writeRT);

        // B. Render Mesh on Front
        this.renderer.setRenderTarget(writeRT);
        // Do NOT clear color, just depth/stencil if needed (but 2D so none).
        this.renderer.render(this.paintScene, this.paintCamera);

        // C. Swap
        layer.swap('albedo');

        this.renderer.autoClear = oldAutoClear;
        this.paintScene.clear(); // cleanup
        material.dispose();
    }

    stepFluid(layer: PaintLayer, channelsToAdvect: string[] = ['albedo'], dissipation: number = 0.998) {
        const mats = this.simMaterials;

        // 1. Advect Velocity
        this.copyMesh.material = mats.advect;
        mats.advect.uniforms.velocityTex.value = layer.fluid.velocity[0].texture;
        mats.advect.uniforms.sourceTex.value = layer.fluid.velocity[0].texture;
        mats.advect.uniforms.dissipation.value = dissipation;
        this.renderer.setRenderTarget(layer.fluid.velocity[1]);
        this.renderer.render(this.copyScene, this.copyCamera);
        let temp = layer.fluid.velocity[0]; layer.fluid.velocity[0] = layer.fluid.velocity[1]; layer.fluid.velocity[1] = temp;

        // 2. Divergence
        this.copyMesh.material = mats.div;
        mats.div.uniforms.velocityTex.value = layer.fluid.velocity[0].texture;
        this.renderer.setRenderTarget(layer.fluid.divergence);
        this.renderer.render(this.copyScene, this.copyCamera);

        // 3. Pressure
        this.copyMesh.material = mats.press;
        mats.press.uniforms.divergenceTex.value = layer.fluid.divergence.texture;
        for (let i = 0; i < 5; i++) {
            mats.press.uniforms.pressureTex.value = layer.fluid.pressure[0].texture;
            this.renderer.setRenderTarget(layer.fluid.pressure[1]);
            this.renderer.render(this.copyScene, this.copyCamera);
            temp = layer.fluid.pressure[0]; layer.fluid.pressure[0] = layer.fluid.pressure[1]; layer.fluid.pressure[1] = temp;
        }

        // 4. Gradient Subtraction
        this.copyMesh.material = mats.grad;
        mats.grad.uniforms.pressureTex.value = layer.fluid.pressure[0].texture;
        mats.grad.uniforms.velocityTex.value = layer.fluid.velocity[0].texture;
        this.renderer.setRenderTarget(layer.fluid.velocity[1]);
        this.renderer.render(this.copyScene, this.copyCamera);
        temp = layer.fluid.velocity[0]; layer.fluid.velocity[0] = layer.fluid.velocity[1]; layer.fluid.velocity[1] = temp;

        // 5. Advect Material Channels
        this.copyMesh.material = mats.advect;
        mats.advect.uniforms.velocityTex.value = layer.fluid.velocity[0].texture;
        mats.advect.uniforms.dissipation.value = dissipation;

        for (const ch of channelsToAdvect) {
            mats.advect.uniforms.sourceTex.value = layer.getRead(ch).texture;
            this.renderer.setRenderTarget(layer.getWrite(ch));
            this.renderer.render(this.copyScene, this.copyCamera);
            layer.swap(ch);
        }

        this.renderer.setRenderTarget(null);
    }

    /**
     * Upload velocity field from Rust SPH simulation to GPU texture
     * velocityData is [vx, vy, vx, vy, ...] row-major from Rust
     * @deprecated Use uploadVelocityFromRustRgba for better performance
     */
    uploadVelocityFromRust(layer: PaintLayer, velocityData: Float32Array, resolution: number) {
        // Create a DataTexture from the velocity data
        // velocityData is [vx, vy, vx, vy, ...] so we need to convert to RGBA
        const rgbaData = new Float32Array(resolution * resolution * 4);
        for (let i = 0; i < resolution * resolution; i++) {
            rgbaData[i * 4 + 0] = velocityData[i * 2 + 0]; // R = vx
            rgbaData[i * 4 + 1] = velocityData[i * 2 + 1]; // G = vy
            rgbaData[i * 4 + 2] = 0; // B = 0
            rgbaData[i * 4 + 3] = 1; // A = 1
        }

        const dataTexture = new THREE.DataTexture(
            rgbaData,
            resolution,
            resolution,
            THREE.RGBAFormat,
            THREE.FloatType
        );
        dataTexture.needsUpdate = true;

        // Copy to velocity texture
        this.copyMaterial.uniforms.tDiffuse.value = dataTexture;
        this.copyMaterial.uniforms.uOpacity.value = 1.0;
        this.copyMaterial.blending = THREE.NoBlending;
        this.copyMesh.material = this.copyMaterial;

        this.renderer.setRenderTarget(layer.fluid.velocity[0]);
        this.renderer.render(this.copyScene, this.copyCamera);

        this.renderer.setRenderTarget(null);
        dataTexture.dispose();
    }

    /**
     * Upload velocity field from Rust - RGBA format (NO JS conversion!)
     * rgbaData is [R=vx, G=vy, B=0, A=1, ...] directly from Rust
     * This is 10x faster than uploadVelocityFromRust!
     */
    uploadVelocityFromRustRgba(layer: PaintLayer, rgbaData: Float32Array, resolution: number) {
        const textureUploadData: Float32Array<ArrayBuffer> =
            rgbaData.buffer instanceof ArrayBuffer ? rgbaData as Float32Array<ArrayBuffer> : new Float32Array(rgbaData);
        const dataTexture = new THREE.DataTexture(
            textureUploadData,
            resolution,
            resolution,
            THREE.RGBAFormat,
            THREE.FloatType
        );
        dataTexture.needsUpdate = true;

        // Copy to velocity texture
        this.copyMaterial.uniforms.tDiffuse.value = dataTexture;
        this.copyMaterial.uniforms.uOpacity.value = 1.0;
        this.copyMaterial.blending = THREE.NoBlending;
        this.copyMesh.material = this.copyMaterial;

        this.renderer.setRenderTarget(layer.fluid.velocity[0]);
        this.renderer.render(this.copyScene, this.copyCamera);

        this.renderer.setRenderTarget(null);
        dataTexture.dispose();
    }

    /**
     * Step fluid simulation with ALL channels (Rust SPH mode)
     */
    stepFluidAllChannels(layer: PaintLayer, dissipation: number = 0.998) {
        this.stepFluid(layer, ['albedo', 'normal', 'roughness', 'metalness', 'emission'], dissipation);
    }

    stepBlackHole(layer: PaintLayer, center: THREE.Vector2, params: any) {
        const mat = this.simMaterials.blackHole;
        const target = layer.fluid.velocity[1];

        this.renderer.setRenderTarget(target);
        this.copyMesh.material = mat;
        mat.uniforms.tVelocity.value = layer.fluid.velocity[0].texture;
        mat.uniforms.uCenter.value.copy(center);
        mat.uniforms.uStrength.value = params.strength * 10.0;
        mat.uniforms.uSpin.value = params.spin * 10.0;
        mat.uniforms.uRadius.value = params.radius;
        // Force decay to 1.0 if infinite mode is active (stability)
        mat.uniforms.uDecay.value = params.infinite ? 1.0 : params.decay;
        mat.uniforms.uDt.value = 0.016;

        this.renderer.render(this.copyScene, this.copyCamera);

        // Swap Velocity
        const temp = layer.fluid.velocity[0];
        layer.fluid.velocity[0] = layer.fluid.velocity[1];
        layer.fluid.velocity[1] = temp;

        this.renderer.setRenderTarget(null);
    }

    stepReaction(layer: PaintLayer) {
        const mat = this.simMaterials.reaction;
        const target = layer.getWrite('albedo');
        this.renderer.setRenderTarget(target);
        this.copyMesh.material = mat;
        mat.uniforms.tSource.value = layer.getRead('albedo').texture;
        this.renderer.render(this.copyScene, this.copyCamera);
        layer.swap('albedo');
        this.renderer.setRenderTarget(null);
    }

    stepVortex(layer: PaintLayer) {
        const mat = this.simMaterials.vortex;
        const target = layer.getWrite('albedo');
        this.renderer.setRenderTarget(target);
        this.copyMesh.material = mat;
        mat.uniforms.tSource.value = layer.getRead('albedo').texture;
        mat.uniforms.time.value = this.clock.getElapsedTime();
        this.renderer.render(this.copyScene, this.copyCamera);
        layer.swap('albedo');
        this.renderer.setRenderTarget(null);
    }

    stepGravity(layer: PaintLayer, params: any = {}) {
        const mat = this.simMaterials.gravity;
        const target = layer.getWrite('albedo');
        this.renderer.setRenderTarget(target);
        this.copyMesh.material = mat;
        mat.uniforms.tSource.value = layer.getRead('albedo').texture;
        mat.uniforms.time.value = this.clock.getElapsedTime();
        mat.uniforms.uSpeed.value = params.speed || 1.0;
        this.renderer.render(this.copyScene, this.copyCamera);
        layer.swap('albedo');
        this.renderer.setRenderTarget(null);
    }

    stepRivulet(layer: PaintLayer, params: any = {}) {
        const mat = this.simMaterials.rivulet;
        const target = layer.getWrite('albedo');
        this.renderer.setRenderTarget(target);
        this.copyMesh.material = mat;
        mat.uniforms.tSource.value = layer.getRead('albedo').texture;
        mat.uniforms.time.value = this.clock.getElapsedTime();
        mat.uniforms.uSpeed.value = params.speed || 1.0;
        mat.uniforms.uChaos.value = params.chaos || 1.0;
        this.renderer.render(this.copyScene, this.copyCamera);
        layer.swap('albedo');
        this.renderer.setRenderTarget(null);
    }

    stepGrowth(layer: PaintLayer, params: any = {}) {
        const mat = this.simMaterials.growth;
        const target = layer.getWrite('albedo');
        this.renderer.setRenderTarget(target);
        this.copyMesh.material = mat;
        mat.uniforms.tSource.value = layer.getRead('albedo').texture;
        mat.uniforms.time.value = this.clock.getElapsedTime();
        mat.uniforms.uSpeed.value = params.speed || 1.0;
        mat.uniforms.uChaos.value = params.chaos || 1.0;
        this.renderer.render(this.copyScene, this.copyCamera);
        layer.swap('albedo');
        this.renderer.setRenderTarget(null);
    }

    stepFerro(layer: PaintLayer) {
        const mat = this.simMaterials.ferro;
        const target = layer.getWrite('albedo');
        this.renderer.setRenderTarget(target);
        this.copyMesh.material = mat;
        mat.uniforms.tSource.value = layer.getRead('albedo').texture;
        this.renderer.render(this.copyScene, this.copyCamera);
        layer.swap('albedo');
        this.renderer.setRenderTarget(null);
    }

    stepQuantum(layer: PaintLayer) {
        const mat = this.simMaterials.quantum;
        const target = layer.getWrite('albedo');
        this.renderer.setRenderTarget(target);
        this.copyMesh.material = mat;
        mat.uniforms.tSource.value = layer.getRead('albedo').texture;
        mat.uniforms.time.value = this.clock.getElapsedTime();
        this.renderer.render(this.copyScene, this.copyCamera);
        layer.swap('albedo');
        this.renderer.setRenderTarget(null);
    }

    stepChronos(layer: PaintLayer) {
        const mat = this.simMaterials.chronos;
        const target = layer.getWrite('albedo');
        this.renderer.setRenderTarget(target);
        this.copyMesh.material = mat;
        mat.uniforms.tSource.value = layer.getRead('albedo').texture;
        mat.uniforms.time.value = this.clock.getElapsedTime();
        this.renderer.render(this.copyScene, this.copyCamera);
        layer.swap('albedo');
        this.renderer.setRenderTarget(null);
    }

    copyTo(sourceTarget: THREE.WebGLRenderTarget, destTarget: THREE.WebGLRenderTarget) {
        this.renderer.setRenderTarget(destTarget);
        this.copyMaterial.uniforms.tDiffuse.value = sourceTarget.texture;
        this.copyMaterial.uniforms.uOpacity.value = 1.0;
        this.copyMaterial.blending = THREE.NoBlending;
        this.copyMesh.material = this.copyMaterial;
        this.renderer.render(this.copyScene, this.copyCamera);
        this.renderer.setRenderTarget(null);
    }

    snapshotLayer(layer: PaintLayer): { [key: string]: THREE.WebGLRenderTarget } {
        const snapshot: any = {};
        const channels = ['albedo', 'normal', 'roughness', 'metalness', 'emission'];
        const options = { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, type: THREE.HalfFloatType, format: THREE.RGBAFormat };
        channels.forEach(ch => {
            const target = new THREE.WebGLRenderTarget(layer.getRead(ch).width, layer.getRead(ch).height, options);
            this.copyTo(layer.getRead(ch), target);
            snapshot[ch] = target;
        });
        return snapshot;
    }

    restoreLayer(layer: PaintLayer, snapshot: { [key: string]: THREE.WebGLRenderTarget }) {
        Object.keys(snapshot).forEach(ch => {
            const histTarget = snapshot[ch];
            this.copyTo(histTarget, layer.getRead(ch));
            this.copyTo(histTarget, layer.getWrite(ch));
        });
    }

    disposeSnapshot(snapshot: { [key: string]: THREE.WebGLRenderTarget }) {
        Object.values(snapshot).forEach(rt => rt.dispose());
    }

    compose(layers: PaintLayer[], dest: PaintLayer) {
        const channels = ['albedo', 'normal', 'roughness', 'metalness', 'emission'];
        const oldAutoClear = this.renderer.autoClear;
        this.renderer.autoClear = false;

        channels.forEach(ch => {
            const target = dest.getWrite(ch);
            this.renderer.setRenderTarget(target);
            this.renderer.setClearColor(new THREE.Color(0, 0, 0), 0);
            this.renderer.clear();

            layers.forEach((layer) => {
                if (!layer.visible || layer.opacity <= 0.001) return;
                this.copyMaterial.uniforms.tDiffuse.value = layer.getRead(ch).texture;
                this.copyMaterial.uniforms.uOpacity.value = layer.opacity;
                this.copyMaterial.blending = THREE.NormalBlending;
                this.copyMesh.material = this.copyMaterial;
                this.renderer.render(this.copyScene, this.copyCamera);
            });
            dest.swap(ch);
        });

        this.renderer.setRenderTarget(null);
        this.renderer.autoClear = oldAutoClear;
    }

    dispose() {
        this.brushMesh.geometry.dispose();
        this.brushMaterial.dispose();
        this.copyMesh.geometry.dispose();
        this.copyMaterial.dispose();
        this.fillMaterial.dispose();

        this.bakeMaterials.normal.dispose();
        this.bakeMaterials.position.dispose();
        this.bakeMaterials.curvature.dispose();
        this.meshMaps.normal.dispose();
        this.meshMaps.position.dispose();
        this.meshMaps.curvature.dispose();

        this.maskSystem.dispose();

        Object.values(this.simMaterials).forEach((m: any) => m.dispose());
    }
}
