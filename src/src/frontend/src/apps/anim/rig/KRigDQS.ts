import * as THREE from 'three';

/**
 * K-RIG DUAL QUATERNION SKINNING (DQS)
 * 
 * The Fix for the "Candy Wrapper Effect"
 * 
 * Standard Linear Blend Skinning (LBS) causes volume collapse during twists.
 * Dual Quaternion Skinning preserves volume and looks 10x better.
 * 
 * Implementation: Pure shader-based, no changes to geometry data structure.
 */

export class DualQuaternion {
    // Real part (rotation)
    real: THREE.Quaternion;
    // Dual part (translation)
    dual: THREE.Quaternion;

    constructor(
        real: THREE.Quaternion = new THREE.Quaternion(),
        dual: THREE.Quaternion = new THREE.Quaternion()
    ) {
        this.real = real.clone();
        this.dual = dual.clone();
    }

    /**
     * Create from rotation quaternion and translation vector
     */
    static fromRotationTranslation(rotation: THREE.Quaternion, translation: THREE.Vector3): DualQuaternion {
        const dq = new DualQuaternion();
        dq.real.copy(rotation);

        // dual = 0.5 * translation_quat * rotation
        const t = new THREE.Quaternion(translation.x, translation.y, translation.z, 0);
        dq.dual.copy(t).multiply(rotation);
        dq.dual.x *= 0.5;
        dq.dual.y *= 0.5;
        dq.dual.z *= 0.5;
        dq.dual.w *= 0.5;

        return dq;
    }

    /**
     * Create from THREE.js Matrix4
     */
    static fromMatrix4(matrix: THREE.Matrix4): DualQuaternion {
        const position = new THREE.Vector3();
        const quaternion = new THREE.Quaternion();
        const scale = new THREE.Vector3();
        matrix.decompose(position, quaternion, scale);

        return DualQuaternion.fromRotationTranslation(quaternion, position);
    }

    /**
     * Multiply two dual quaternions
     */
    multiply(other: DualQuaternion): DualQuaternion {
        const result = new DualQuaternion();

        // Real part: r0 * r1
        result.real.copy(this.real).multiply(other.real);

        // Dual part: r0 * d1 + d0 * r1
        const temp1 = this.real.clone().multiply(other.dual);
        const temp2 = this.dual.clone().multiply(other.real);

        result.dual.copy(temp1);
        result.dual.x += temp2.x;
        result.dual.y += temp2.y;
        result.dual.z += temp2.z;
        result.dual.w += temp2.w;

        return result;
    }

    /**
     * Normalize the dual quaternion
     */
    normalize(): DualQuaternion {
        const mag = Math.sqrt(
            this.real.x * this.real.x +
            this.real.y * this.real.y +
            this.real.z * this.real.z +
            this.real.w * this.real.w
        );

        if (mag > 0) {
            const invMag = 1.0 / mag;
            this.real.x *= invMag;
            this.real.y *= invMag;
            this.real.z *= invMag;
            this.real.w *= invMag;
            this.dual.x *= invMag;
            this.dual.y *= invMag;
            this.dual.z *= invMag;
            this.dual.w *= invMag;
        }

        return this;
    }

    /**
     * Scale (for blending)
     */
    scale(s: number): DualQuaternion {
        this.real.x *= s;
        this.real.y *= s;
        this.real.z *= s;
        this.real.w *= s;
        this.dual.x *= s;
        this.dual.y *= s;
        this.dual.z *= s;
        this.dual.w *= s;
        return this;
    }

    /**
     * Add (for blending)
     */
    add(other: DualQuaternion): DualQuaternion {
        this.real.x += other.real.x;
        this.real.y += other.real.y;
        this.real.z += other.real.z;
        this.real.w += other.real.w;
        this.dual.x += other.dual.x;
        this.dual.y += other.dual.y;
        this.dual.z += other.dual.z;
        this.dual.w += other.dual.w;
        return this;
    }

    /**
     * Transform a point
     */
    transformPoint(point: THREE.Vector3): THREE.Vector3 {
        // First normalize
        this.normalize();

        // Extract translation: t = 2.0 * dual * conjugate(real)
        const realConj = new THREE.Quaternion(-this.real.x, -this.real.y, -this.real.z, this.real.w);
        const t = this.dual.clone().multiply(realConj);
        t.x *= 2.0;
        t.y *= 2.0;
        t.z *= 2.0;
        t.w *= 2.0;

        // Apply rotation then translation
        const rotated = point.clone().applyQuaternion(this.real);
        return rotated.add(new THREE.Vector3(t.x, t.y, t.z));
    }

    /**
     * Convert to array for shader uniforms [real.x, real.y, real.z, real.w, dual.x, dual.y, dual.z, dual.w]
     */
    toArray(): number[] {
        return [
            this.real.x, this.real.y, this.real.z, this.real.w,
            this.dual.x, this.dual.y, this.dual.z, this.dual.w
        ];
    }
}

/**
 * DQS Shader Injector
 * Modifies THREE.js materials to use Dual Quaternion Skinning
 */
export class DQSShaderInjector {
    /**
     * Inject DQS into a material's shader
     */
    static injectDQS(material: THREE.MeshStandardMaterial): void {
        material.onBeforeCompile = (shader) => {
            // Add DQ uniforms
            shader.uniforms.boneMatrices = { value: [] };
            shader.uniforms.useDQS = { value: true };

            // Inject vertex shader code
            shader.vertexShader = this.getDQSVertexShader(shader.vertexShader);

            // Store reference for updates
            (material as any).userData.dqsShader = shader;
        };

        material.needsUpdate = true;
    }

    /**
     * Update DQ uniforms from skeleton
     */
    static updateDQUniforms(material: THREE.MeshStandardMaterial, skeleton: THREE.Skeleton): void {
        const shader = (material as any).userData.dqsShader;
        if (!shader) return;

        // Convert bone matrices to dual quaternions
        const dualQuats: number[] = [];

        skeleton.bones.forEach((bone, i) => {
            const boneMatrix = skeleton.boneMatrices[i * 16];
            const matrix = new THREE.Matrix4().fromArray(skeleton.boneMatrices, i * 16);
            const dq = DualQuaternion.fromMatrix4(matrix);
            dualQuats.push(...dq.toArray());
        });

        if (shader.uniforms.boneMatrices) {
            shader.uniforms.boneMatrices.value = dualQuats;
        }
    }

    /**
     * Generate DQS vertex shader
     */
    private static getDQSVertexShader(originalShader: string): string {
        // Replace the skinning chunk with DQS version
        let shader = originalShader;

        // Add DQ blend function before main
        // Insert uniform declaration
        const uniformDecl = `
            uniform vec4 boneMatrices[256]; // Enough for 128 bones (2 vec4s per bone)
            uniform float useDQS;
        `;
        shader = uniformDecl + '\n' + shader;

        // Insert functions
        const dqFunctions = `
        // Dual Quaternion blending
        vec4[2] blendDualQuaternions(vec4 weights, vec4 indices) {
            // Get 4 bone dual quaternions
            int idx0 = int(indices.x) * 2;
            int idx1 = int(indices.y) * 2;
            int idx2 = int(indices.z) * 2;
            int idx3 = int(indices.w) * 2;

            vec4 dq0_real = boneMatrices[idx0];
            vec4 dq0_dual = boneMatrices[idx0 + 1];
            
            vec4 dq1_real = boneMatrices[idx1];
            vec4 dq1_dual = boneMatrices[idx1 + 1];
            
            vec4 dq2_real = boneMatrices[idx2];
            vec4 dq2_dual = boneMatrices[idx2 + 1];
            
            vec4 dq3_real = boneMatrices[idx3];
            vec4 dq3_dual = boneMatrices[idx3 + 1];

            // Ensure all quaternions are in the same hemisphere
            if (dot(dq0_real, dq1_real) < 0.0) { dq1_real *= -1.0; dq1_dual *= -1.0; }
            if (dot(dq0_real, dq2_real) < 0.0) { dq2_real *= -1.0; dq2_dual *= -1.0; }
            if (dot(dq0_real, dq3_real) < 0.0) { dq3_real *= -1.0; dq3_dual *= -1.0; }

            // Blend
            vec4 blended_real = dq0_real * weights.x + dq1_real * weights.y + dq2_real * weights.z + dq3_real * weights.w;
            vec4 blended_dual = dq0_dual * weights.x + dq1_dual * weights.y + dq2_dual * weights.z + dq3_dual * weights.w;

            // Normalize
            float mag = length(blended_real);
            if (mag > 0.0) {
                blended_real /= mag;
                blended_dual /= mag;
            }

            return vec4[2](blended_real, blended_dual);
        }

        // Transform point by dual quaternion
        vec3 dqTransformPoint(vec3 point, vec4 real, vec4 dual) {
            // Extract translation: t = 2.0 * dual * conjugate(real)
            vec4 real_conj = vec4(-real.xyz, real.w);
            vec4 t_quat;
            t_quat.w = dual.w * real_conj.w - dot(dual.xyz, real_conj.xyz);
            t_quat.xyz = dual.w * real_conj.xyz + real_conj.w * dual.xyz + cross(dual.xyz, real_conj.xyz);
            t_quat *= 2.0;
            vec3 translation = t_quat.xyz;

            // Apply rotation
            vec3 rotated = point + 2.0 * cross(real.xyz, cross(real.xyz, point) + real.w * point);
            
            return rotated + translation;
        }

        // Transform normal by dual quaternion (rotation only)
        vec3 dqTransformNormal(vec3 normal, vec4 real) {
            return normal + 2.0 * cross(real.xyz, cross(real.xyz, normal) + real.w * normal);
        }
        `;

        // Insert before main function
        shader = shader.replace('void main() {', dqFunctions + '\nvoid main() {');

        // Replace skinning section
        // Note: 'transformed' and 'objectNormal' are standard ThreeJS variables used in other chunks.
        // We must reuse them, not redeclare them.
        const dqsSkinning = `
            #ifdef USE_SKINNING
                vec4[2] dq = blendDualQuaternions(skinWeight, skinIndex);
                transformed = dqTransformPoint(position, dq[0], dq[1]);
                objectNormal = dqTransformNormal(normal, dq[0]);
                #ifdef USE_TANGENT
                    // objectTangent = dqTransformNormal(tangent.xyz, dq[0]);
                #endif
            #endif
        `;

        // Find and replace the skinning vertex chunk
        if (shader.includes('#include <skinning_vertex>')) {
            shader = shader.replace('#include <skinning_vertex>', dqsSkinning);
        }

        return shader;
    }

    /**
     * Toggle between LBS and DQS
     */
    static toggleDQS(material: THREE.MeshStandardMaterial, enabled: boolean): void {
        const shader = (material as any).userData.dqsShader;
        if (shader && shader.uniforms.useDQS) {
            shader.uniforms.useDQS.value = enabled;
        }
    }
}

/**
 * Apply DQS to a skinned mesh
 */
export function applyDQSToMesh(skinnedMesh: THREE.SkinnedMesh): void {
    const material = skinnedMesh.material as THREE.MeshStandardMaterial;

    if (!material) {
        console.error('K-RIG DQS: Material not found');
        return;
    }

    // Inject DQS shader
    DQSShaderInjector.injectDQS(material);

    // Setup update loop
    const originalOnBeforeRender = skinnedMesh.onBeforeRender;
    skinnedMesh.onBeforeRender = (renderer, scene, camera, geometry, material, group) => {
        if (originalOnBeforeRender) {
            originalOnBeforeRender.call(skinnedMesh, renderer, scene, camera, geometry, material, group);
        }

        // Update DQ uniforms
        if (skinnedMesh.skeleton) {
            DQSShaderInjector.updateDQUniforms(material as THREE.MeshStandardMaterial, skinnedMesh.skeleton);
        }
    };

    console.log('K-RIG: Dual Quaternion Skinning enabled');
}
