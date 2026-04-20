
import * as THREE from 'three';
import { BRUSH_VERT, MASK_BRUSH_FRAG, COPY_VERT, FILL_FRAG } from './PaintShaders';
import { TEXTURE_SIZE } from './PaintSystem';

/**
 * MaskSystem
 * Handles a dedicated high-precision single-channel buffer for masking operations.
 * Supports Add/Subtract painting modes.
 */
export class MaskSystem {
    renderer: THREE.WebGLRenderer;
    target: THREE.WebGLRenderTarget;
    
    // Mask Painting Scene
    scene: THREE.Scene;
    camera: THREE.OrthographicCamera;
    brushMesh: THREE.Mesh;
    brushMaterial: THREE.ShaderMaterial;
    
    // Utils
    fillMaterial: THREE.ShaderMaterial;
    quadMesh: THREE.Mesh;

    constructor(renderer: THREE.WebGLRenderer, size: number = TEXTURE_SIZE) {
        this.renderer = renderer;
        
        // Single channel R is enough, but RGBA is safer for compatibility.
        // Float type for smooth gradients.
        this.target = new THREE.WebGLRenderTarget(size, size, {
            minFilter: THREE.LinearFilter,
            magFilter: THREE.LinearFilter,
            type: THREE.HalfFloatType,
            format: THREE.RGBAFormat,
            depthBuffer: false,
            stencilBuffer: false
        });

        this.scene = new THREE.Scene();
        this.camera = new THREE.OrthographicCamera(0, 1, 1, 0, 0, 10);
        this.camera.position.z = 1;

        this.brushMaterial = new THREE.ShaderMaterial({
            uniforms: {
                uOpacity: { value: 1.0 },
                uHardness: { value: 0.5 },
                uAngle: { value: 0.0 },
                uValue: { value: 1.0 }, // 1 = Add, 0 = Subtract (handled via blend equation mainly)
                uBrushAlpha: { value: null },
                uUseBrushAlpha: { value: false }
            },
            vertexShader: BRUSH_VERT,
            fragmentShader: MASK_BRUSH_FRAG,
            transparent: true,
            depthTest: false,
            depthWrite: false
        });

        this.brushMesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), this.brushMaterial);
        this.scene.add(this.brushMesh);

        this.fillMaterial = new THREE.ShaderMaterial({
            uniforms: {
                tSource: { value: null },
                uUseTexture: { value: false },
                uColor: { value: new THREE.Color(0,0,0) },
                uAlpha: { value: 1.0 }
            },
            vertexShader: COPY_VERT,
            fragmentShader: FILL_FRAG,
            depthTest: false,
            depthWrite: false
        });
        
        this.quadMesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.fillMaterial);
        
        // Initialize Black Mask
        this.clear();
    }

    clear() {
        const oldTarget = this.renderer.getRenderTarget();
        this.renderer.setRenderTarget(this.target);
        this.renderer.setClearColor(0x000000, 0);
        this.renderer.clear();
        this.renderer.setRenderTarget(oldTarget);
    }

    /**
     * Paint onto the mask buffer.
     * @param uv Brush UV position
     * @param params Brush parameters
     * @param subtract If true, erases the mask
     */
    paint(uv: THREE.Vector2, params: any, subtract: boolean = false) {
        const oldAutoClear = this.renderer.autoClear;
        this.renderer.autoClear = false;
        
        this.renderer.setRenderTarget(this.target);

        // Setup Brush
        const brushSizeUV = params.size / TEXTURE_SIZE;
        this.brushMesh.scale.set(brushSizeUV, brushSizeUV, 1);
        this.brushMesh.position.set(uv.x, uv.y, 0);
        
        this.brushMaterial.uniforms.uOpacity.value = params.flow * (params.opacity || 1.0);
        this.brushMaterial.uniforms.uHardness.value = params.hardness;
        this.brushMaterial.uniforms.uAngle.value = Math.random() * 0.1;
        
        if (params.alphaMap) {
            this.brushMaterial.uniforms.uUseBrushAlpha.value = true;
            this.brushMaterial.uniforms.uBrushAlpha.value = params.alphaMap;
        } else {
            this.brushMaterial.uniforms.uUseBrushAlpha.value = false;
        }

        // --- BLENDING LOGIC FOR MASKING ---
        // We write to Red channel.
        // Add Mode: Src + Dst (clamped)
        // Subtract Mode: Dst - Src (clamped)
        
        if (subtract) {
            this.brushMaterial.blending = THREE.CustomBlending;
            this.brushMaterial.blendEquation = THREE.ReverseSubtractEquation; // Dest - Source
            this.brushMaterial.blendSrc = THREE.OneFactor;
            this.brushMaterial.blendDst = THREE.OneFactor;
        } else {
            this.brushMaterial.blending = THREE.AdditiveBlending;
        }

        this.renderer.render(this.scene, this.camera);
        
        this.renderer.setRenderTarget(null);
        this.renderer.autoClear = oldAutoClear;
    }

    dispose() {
        this.target.dispose();
        this.brushMaterial.dispose();
        this.brushMesh.geometry.dispose();
        this.fillMaterial.dispose();
    }
}
