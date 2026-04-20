/**
 * SPHParticleRenderer.ts
 * 
 * GPU-accelerated particle renderer for SPH fluid visualization.
 * Renders particles received from Rust salva3d simulation.
 */

import * as THREE from 'three';

const PARTICLE_VERT = `
    attribute float size;
    attribute vec3 velocity;
    
    varying vec3 vColor;
    varying float vSpeed;
    
    uniform float uPointSize;
    uniform float uTime;
    
    void main() {
        vSpeed = length(velocity);
        
        // Color based on velocity (blue = slow, cyan = fast)
        float speedNorm = clamp(vSpeed / 2.0, 0.0, 1.0);
        vColor = mix(
            vec3(0.1, 0.4, 0.8),   // Deep blue (slow)
            vec3(0.2, 0.9, 1.0),   // Cyan (fast)
            speedNorm
        );
        
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = uPointSize * (300.0 / -mvPosition.z);
        gl_Position = projectionMatrix * mvPosition;
    }
`;

const PARTICLE_FRAG = `
    varying vec3 vColor;
    varying float vSpeed;
    
    void main() {
        // Circular particle with soft edge
        vec2 uv = gl_PointCoord * 2.0 - 1.0;
        float dist = length(uv);
        
        if (dist > 1.0) discard;
        
        // Soft glow falloff
        float alpha = 1.0 - smoothstep(0.0, 1.0, dist);
        alpha *= 0.8;
        
        // Add glow for fast particles
        float glow = vSpeed * 0.3;
        vec3 color = vColor + vec3(glow);
        
        gl_FragColor = vec4(color, alpha);
    }
`;

export class SPHParticleRenderer {
    private geometry: THREE.BufferGeometry;
    private material: THREE.ShaderMaterial;
    private points: THREE.Points;
    private maxParticles: number;
    private particleCount: number = 0;

    constructor(scene: THREE.Scene, maxParticles: number = 100000) {
        this.maxParticles = maxParticles;

        // Pre-allocate buffers
        this.geometry = new THREE.BufferGeometry();

        const positions = new Float32Array(maxParticles * 3);
        const velocities = new Float32Array(maxParticles * 3);
        const sizes = new Float32Array(maxParticles);

        this.geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        this.geometry.setAttribute('velocity', new THREE.BufferAttribute(velocities, 3));
        this.geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

        // Dynamic draw range
        this.geometry.setDrawRange(0, 0);

        this.material = new THREE.ShaderMaterial({
            uniforms: {
                uPointSize: { value: 10.0 },
                uTime: { value: 0.0 },
            },
            vertexShader: PARTICLE_VERT,
            fragmentShader: PARTICLE_FRAG,
            transparent: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
        });

        this.points = new THREE.Points(this.geometry, this.material);
        this.points.frustumCulled = false;
        this.points.visible = false;

        scene.add(this.points);
    }

    /**
     * Update particle positions from Rust simulation
     */
    updateFromFluidState(positions: [number, number, number][], velocities: [number, number, number][]): void {
        this.particleCount = Math.min(positions.length, this.maxParticles);

        const posAttr = this.geometry.getAttribute('position') as THREE.BufferAttribute;
        const velAttr = this.geometry.getAttribute('velocity') as THREE.BufferAttribute;
        const sizeAttr = this.geometry.getAttribute('size') as THREE.BufferAttribute;

        for (let i = 0; i < this.particleCount; i++) {
            const p = positions[i];
            const v = velocities[i];

            posAttr.setXYZ(i, p[0], p[1], p[2]);
            velAttr.setXYZ(i, v[0], v[1], v[2]);

            // Size based on velocity
            const speed = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
            sizeAttr.setX(i, 1.0 + speed * 0.5);
        }

        posAttr.needsUpdate = true;
        velAttr.needsUpdate = true;
        sizeAttr.needsUpdate = true;

        this.geometry.setDrawRange(0, this.particleCount);
        this.points.visible = this.particleCount > 0;
    }

    /**
     * Update from flat Float32Array (more efficient)
     */
    updateFromArrays(positions: Float32Array, velocities: Float32Array): void {
        this.particleCount = Math.min(positions.length / 3, this.maxParticles);

        const posAttr = this.geometry.getAttribute('position') as THREE.BufferAttribute;
        const velAttr = this.geometry.getAttribute('velocity') as THREE.BufferAttribute;

        // Direct copy for efficiency
        (posAttr.array as Float32Array).set(positions.subarray(0, this.particleCount * 3));
        (velAttr.array as Float32Array).set(velocities.subarray(0, this.particleCount * 3));

        posAttr.needsUpdate = true;
        velAttr.needsUpdate = true;

        this.geometry.setDrawRange(0, this.particleCount);
        this.points.visible = this.particleCount > 0;
    }

    /**
     * Set particle color scheme
     */
    setColorMode(mode: 'velocity' | 'paint'): void {
        // Can extend this to use brush color for paint mode
    }

    /**
     * Set particle size
     */
    setPointSize(size: number): void {
        this.material.uniforms.uPointSize.value = size;
    }

    /**
     * Update time uniform for animations
     */
    update(time: number): void {
        this.material.uniforms.uTime.value = time;
    }

    /**
     * Show/hide particles
     */
    setVisible(visible: boolean): void {
        this.points.visible = visible && this.particleCount > 0;
    }

    /**
     * Get particle count
     */
    getParticleCount(): number {
        return this.particleCount;
    }

    /**
     * Dispose resources
     */
    dispose(): void {
        this.geometry.dispose();
        this.material.dispose();
        this.points.parent?.remove(this.points);
    }
}

export default SPHParticleRenderer;
