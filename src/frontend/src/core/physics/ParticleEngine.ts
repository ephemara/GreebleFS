
import * as THREE from 'three';
import { 
    PARTICLE_SIM_VERT, VELOCITY_FRAGMENT, POSITION_FRAGMENT, 
    RENDER_VERT, RENDER_FRAG 
} from './ParticleShaders';
import { FluidSimulator } from './FluidSimulator';

export interface ParticleEngineOptions {
    size?: number; // Texture size (resolution)
    pointSize?: number;
    color?: string | number;
}

/**
 * K-QUANTUM PARTICLE ENGINE
 * Massive GPU-accelerated particle system with complex physics kernels.
 */
export class ParticleEngine {
    renderer: THREE.WebGLRenderer;
    resolution: number;
    
    scene: THREE.Scene;
    camera: THREE.OrthographicCamera;
    mesh: THREE.Mesh; // Simulation Quad

    // Ping-Pong Buffers
    velocity: { read: THREE.WebGLRenderTarget, write: THREE.WebGLRenderTarget };
    position: { read: THREE.WebGLRenderTarget, write: THREE.WebGLRenderTarget };
    
    // Materials
    velMat: THREE.ShaderMaterial;
    posMat: THREE.ShaderMaterial;
    renderMat: THREE.ShaderMaterial;
    
    // Renderable Particles
    particles: THREE.Points;
    
    // State
    mouse = new THREE.Vector3(0, 0, 0);

    constructor(renderer: THREE.WebGLRenderer, options: ParticleEngineOptions = {}) {
        this.renderer = renderer;
        this.resolution = options.size || 256;
        
        // 1. Simulation Environment
        this.scene = new THREE.Scene();
        this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
        
        // 2. Data Initialization
        const size = this.resolution;
        const count = size * size;
        const posData = new Float32Array(count * 4);
        const velData = new Float32Array(count * 4);
        const originData = new Float32Array(count * 4);
        
        for (let i = 0; i < count; i++) {
            const i4 = i * 4;
            // Sphere distribution
            const r = 10 + Math.random() * 10;
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(2 * Math.random() - 1);
            
            const x = r * Math.sin(phi) * Math.cos(theta);
            const y = r * Math.sin(phi) * Math.sin(theta);
            const z = r * Math.cos(phi);
            
            posData[i4] = x; posData[i4+1] = y; posData[i4+2] = z; posData[i4+3] = 1.0; // Life
            originData[i4] = x; originData[i4+1] = y; originData[i4+2] = z; originData[i4+3] = 1.0;
            velData[i4] = 0; velData[i4+1] = 0; velData[i4+2] = 0; velData[i4+3] = 0;
        }
        
        const type = (renderer.capabilities.isWebGL2) ? THREE.HalfFloatType : THREE.FloatType;
        const texOptions = { type, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, format: THREE.RGBAFormat };
        
        const initPos = new THREE.DataTexture(posData, size, size, THREE.RGBAFormat, THREE.FloatType);
        initPos.needsUpdate = true;
        const initVel = new THREE.DataTexture(velData, size, size, THREE.RGBAFormat, THREE.FloatType);
        initVel.needsUpdate = true;
        const originTex = new THREE.DataTexture(originData, size, size, THREE.RGBAFormat, THREE.FloatType);
        originTex.needsUpdate = true;

        // 3. FBOs
        const createFBO = () => new THREE.WebGLRenderTarget(size, size, texOptions);
        this.velocity = { read: createFBO(), write: createFBO() };
        this.position = { read: createFBO(), write: createFBO() };
        
        // Fill initial FBOs
        const quadGeo = new THREE.PlaneGeometry(2, 2);
        const copyMat = new THREE.MeshBasicMaterial({ map: initPos });
        const quad = new THREE.Mesh(quadGeo, copyMat);
        this.scene.add(quad);
        
        renderer.setRenderTarget(this.position.read); renderer.render(this.scene, this.camera);
        renderer.setRenderTarget(this.position.write); renderer.render(this.scene, this.camera);
        
        copyMat.map = initVel;
        renderer.setRenderTarget(this.velocity.read); renderer.render(this.scene, this.camera);
        renderer.setRenderTarget(this.velocity.write); renderer.render(this.scene, this.camera);
        
        this.scene.remove(quad); // Clean up init quad

        // 4. Simulation Shaders
        this.velMat = new THREE.ShaderMaterial({
            uniforms: {
                velocityTexture: { value: null },
                positionTexture: { value: null },
                fluidTexture: { value: null }, // Linkable
                originTexture: { value: originTex },
                time: { value: 0 },
                dt: { value: 0.016 },
                speed: { value: 1.0 },
                chaos: { value: 1.0 },
                mode: { value: 0 },
                mousePos: { value: new THREE.Vector3() },
                uDamping: { value: 0.96 },
                audioLevel: { value: 0 }, audioBass: { value: 0 }, audioHigh: { value: 0 }
            },
            vertexShader: PARTICLE_SIM_VERT,
            fragmentShader: VELOCITY_FRAGMENT
        });

        this.posMat = new THREE.ShaderMaterial({
            uniforms: {
                positionTexture: { value: null },
                velocityTexture: { value: null },
                originTexture: { value: originTex },
                dt: { value: 0.016 },
                time: { value: 0 },
                mode: { value: 0 }
            },
            vertexShader: PARTICLE_SIM_VERT,
            fragmentShader: POSITION_FRAGMENT
        });

        this.mesh = new THREE.Mesh(quadGeo, this.velMat); // Re-add quad with sim material
        this.scene.add(this.mesh);

        // 5. Rendering Setup (The Particles)
        this.renderMat = new THREE.ShaderMaterial({
            uniforms: {
                positionTexture: { value: null },
                velocityTexture: { value: null },
                pointSize: { value: options.pointSize || 2.0 },
                color: { value: new THREE.Color(options.color || 0x00ffcc) },
                opacity: { value: 0.8 }
            },
            vertexShader: RENDER_VERT,
            fragmentShader: RENDER_FRAG,
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });

        const geo = new THREE.BufferGeometry();
        const refs = new Float32Array(count * 2);
        for(let i=0; i<count; i++) {
            refs[i*2] = (i % size) / size;
            refs[i*2+1] = Math.floor(i / size) / size;
        }
        geo.setAttribute('reference', new THREE.BufferAttribute(refs, 2));
        geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3)); // Dummy positions
        
        this.particles = new THREE.Points(geo, this.renderMat);
        this.particles.frustumCulled = false;
    }

    /**
     * Link a Fluid Simulator to drive particles (Mode 17)
     */
    bindFluid(fluid: FluidSimulator) {
        this.velMat.uniforms.fluidTexture.value = fluid.velocity.read.texture;
    }

    setMode(mode: number) {
        this.velMat.uniforms.mode.value = mode;
        this.posMat.uniforms.mode.value = mode;
    }

    setSpeed(speed: number) { this.velMat.uniforms.speed.value = speed; }
    setChaos(chaos: number) { this.velMat.uniforms.chaos.value = chaos; }
    setColor(color: string) { this.renderMat.uniforms.color.value.set(color); }

    interaction(mouse: THREE.Vector3, isDown: boolean) {
        this.mouse.copy(mouse);
        this.mouse.z = isDown ? 1.0 : 0.0;
        this.velMat.uniforms.mousePos.value.copy(this.mouse);
    }

    update(time: number, dt: number = 0.016) {
        // 1. Update Velocity
        this.mesh.material = this.velMat;
        this.velMat.uniforms.velocityTexture.value = this.velocity.read.texture;
        this.velMat.uniforms.positionTexture.value = this.position.read.texture;
        this.velMat.uniforms.time.value = time;
        this.velMat.uniforms.dt.value = dt;
        
        this.renderer.setRenderTarget(this.velocity.write);
        this.renderer.render(this.scene, this.camera);
        // Swap Velocity
        let temp = this.velocity.read; this.velocity.read = this.velocity.write; this.velocity.write = temp;

        // 2. Update Position
        this.mesh.material = this.posMat;
        this.posMat.uniforms.positionTexture.value = this.position.read.texture;
        this.posMat.uniforms.velocityTexture.value = this.velocity.read.texture; // Use new velocity
        this.posMat.uniforms.time.value = time;
        this.posMat.uniforms.dt.value = dt;
        
        this.renderer.setRenderTarget(this.position.write);
        this.renderer.render(this.scene, this.camera);
        // Swap Position
        temp = this.position.read; this.position.read = this.position.write; this.position.write = temp;
        
        // 3. Update Render Material
        this.renderMat.uniforms.positionTexture.value = this.position.read.texture;
        this.renderMat.uniforms.velocityTexture.value = this.velocity.read.texture;
        
        this.renderer.setRenderTarget(null);
    }
    
    getRenderObject() {
        return this.particles;
    }

    dispose() {
        this.velocity.read.dispose(); this.velocity.write.dispose();
        this.position.read.dispose(); this.position.write.dispose();
    }
}
