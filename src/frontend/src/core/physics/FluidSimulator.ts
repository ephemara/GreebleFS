
import * as THREE from 'three';
import { 
    FLUID_VERT, FLUID_ADVECT, FLUID_DIV, FLUID_PRESS, FLUID_GRAD, FLUID_SPLAT 
} from '../shaders/physicsShaders';

/**
 * FluidSimulator
 * A robust, shader-based Navier-Stokes fluid simulation.
 * Manages FBOs, Materials, and the Ping-Pong rendering steps.
 */
export class FluidSimulator {
    renderer: THREE.WebGLRenderer;
    resolution: THREE.Vector2;
    
    // Scene Setup
    scene: THREE.Scene;
    camera: THREE.OrthographicCamera;
    mesh: THREE.Mesh; // The fullscreen quad

    // Render Targets (Ping-Pong)
    velocity: { read: THREE.WebGLRenderTarget, write: THREE.WebGLRenderTarget };
    density: { read: THREE.WebGLRenderTarget, write: THREE.WebGLRenderTarget }; // "Ink" or "Color"
    divergence: THREE.WebGLRenderTarget;
    pressure: { read: THREE.WebGLRenderTarget, write: THREE.WebGLRenderTarget };

    // Materials
    materials: {
        advect: THREE.ShaderMaterial;
        div: THREE.ShaderMaterial;
        press: THREE.ShaderMaterial;
        grad: THREE.ShaderMaterial;
        splat: THREE.ShaderMaterial;
    };

    constructor(renderer: THREE.WebGLRenderer, size: number = 128) {
        this.renderer = renderer;
        this.resolution = new THREE.Vector2(size, size);

        // 1. Setup Scene
        this.scene = new THREE.Scene();
        this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
        
        // 2. Setup Buffers
        const options: THREE.RenderTargetOptions = {
            type: THREE.HalfFloatType, // High precision physics
            format: THREE.RGBAFormat,
            minFilter: THREE.LinearFilter,
            magFilter: THREE.LinearFilter,
            depthBuffer: false,
            stencilBuffer: false
        };

        const createFBO = () => new THREE.WebGLRenderTarget(size, size, options);

        this.velocity = { read: createFBO(), write: createFBO() };
        this.density = { read: createFBO(), write: createFBO() };
        this.divergence = createFBO();
        this.pressure = { read: createFBO(), write: createFBO() };

        // 3. Setup Materials
        const texelSize = new THREE.Vector2(1.0 / size, 1.0 / size);

        this.materials = {
            advect: new THREE.ShaderMaterial({
                uniforms: {
                    velocityTex: { value: null },
                    sourceTex: { value: null },
                    dt: { value: 0.016 },
                    dissipation: { value: 0.98 }
                },
                vertexShader: FLUID_VERT,
                fragmentShader: FLUID_ADVECT
            }),
            div: new THREE.ShaderMaterial({
                uniforms: {
                    velocityTex: { value: null },
                    texelSize: { value: texelSize }
                },
                vertexShader: FLUID_VERT,
                fragmentShader: FLUID_DIV
            }),
            press: new THREE.ShaderMaterial({
                uniforms: {
                    pressureTex: { value: null },
                    divergenceTex: { value: null },
                    texelSize: { value: texelSize }
                },
                vertexShader: FLUID_VERT,
                fragmentShader: FLUID_PRESS
            }),
            grad: new THREE.ShaderMaterial({
                uniforms: {
                    pressureTex: { value: null },
                    velocityTex: { value: null },
                    texelSize: { value: texelSize }
                },
                vertexShader: FLUID_VERT,
                fragmentShader: FLUID_GRAD
            }),
            splat: new THREE.ShaderMaterial({
                uniforms: {
                    targetTex: { value: null },
                    point: { value: new THREE.Vector2() },
                    color: { value: new THREE.Vector3() },
                    radius: { value: 0.001 }
                },
                vertexShader: FLUID_VERT,
                fragmentShader: FLUID_SPLAT
            })
        };

        this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.materials.advect);
        this.scene.add(this.mesh);
    }

    /**
     * Add force/color to the simulation at a point
     */
    splat(uv: THREE.Vector2, force: THREE.Vector2, color: THREE.Vector3, radius: number = 0.005) {
        // Splat Velocity
        this.mesh.material = this.materials.splat;
        this.materials.splat.uniforms.targetTex.value = this.velocity.read.texture;
        this.materials.splat.uniforms.point.value.copy(uv);
        this.materials.splat.uniforms.color.value.set(force.x, force.y, 0.0);
        this.materials.splat.uniforms.radius.value = radius;
        
        this.renderer.setRenderTarget(this.velocity.write);
        this.renderer.render(this.scene, this.camera);
        this.swapVelocity();

        // Splat Color/Density
        this.materials.splat.uniforms.targetTex.value = this.density.read.texture;
        this.materials.splat.uniforms.color.value.copy(color);
        
        this.renderer.setRenderTarget(this.density.write);
        this.renderer.render(this.scene, this.camera);
        this.swapDensity();
    }

    /**
     * Run one simulation step
     */
    update(dt: number = 0.016, dissipation: number = 0.98) {
        // 1. Advect Velocity
        this.mesh.material = this.materials.advect;
        this.materials.advect.uniforms.velocityTex.value = this.velocity.read.texture;
        this.materials.advect.uniforms.sourceTex.value = this.velocity.read.texture;
        this.materials.advect.uniforms.dt.value = dt;
        this.materials.advect.uniforms.dissipation.value = dissipation;
        
        this.renderer.setRenderTarget(this.velocity.write);
        this.renderer.render(this.scene, this.camera);
        this.swapVelocity();

        // 2. Advect Density (Color)
        this.materials.advect.uniforms.velocityTex.value = this.velocity.read.texture;
        this.materials.advect.uniforms.sourceTex.value = this.density.read.texture;
        this.materials.advect.uniforms.dissipation.value = dissipation - 0.01; // Fade color slightly faster
        
        this.renderer.setRenderTarget(this.density.write);
        this.renderer.render(this.scene, this.camera);
        this.swapDensity();

        // 3. Divergence
        this.mesh.material = this.materials.div;
        this.materials.div.uniforms.velocityTex.value = this.velocity.read.texture;
        
        this.renderer.setRenderTarget(this.divergence);
        this.renderer.render(this.scene, this.camera);

        // 4. Pressure (Jacobi Iteration)
        this.mesh.material = this.materials.press;
        this.materials.press.uniforms.divergenceTex.value = this.divergence.texture;
        
        for (let i = 0; i < 10; i++) {
            this.materials.press.uniforms.pressureTex.value = this.pressure.read.texture;
            this.renderer.setRenderTarget(this.pressure.write);
            this.renderer.render(this.scene, this.camera);
            this.swapPressure();
        }

        // 5. Gradient Subtraction
        this.mesh.material = this.materials.grad;
        this.materials.grad.uniforms.pressureTex.value = this.pressure.read.texture;
        this.materials.grad.uniforms.velocityTex.value = this.velocity.read.texture;
        
        this.renderer.setRenderTarget(this.velocity.write);
        this.renderer.render(this.scene, this.camera);
        this.swapVelocity();
        
        this.renderer.setRenderTarget(null);
    }

    // --- UTILS ---
    private swapVelocity() {
        const temp = this.velocity.read;
        this.velocity.read = this.velocity.write;
        this.velocity.write = temp;
    }
    private swapDensity() {
        const temp = this.density.read;
        this.density.read = this.density.write;
        this.density.write = temp;
    }
    private swapPressure() {
        const temp = this.pressure.read;
        this.pressure.read = this.pressure.write;
        this.pressure.write = temp;
    }

    dispose() {
        this.velocity.read.dispose(); this.velocity.write.dispose();
        this.density.read.dispose(); this.density.write.dispose();
        this.divergence.dispose();
        this.pressure.read.dispose(); this.pressure.write.dispose();
    }
}
