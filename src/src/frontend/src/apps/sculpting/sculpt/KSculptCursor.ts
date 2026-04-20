/**
 * KSculptCursor.ts
 * 
 * GPU-based brush cursor for KSculpt.
 * Projects a circle directly onto the mesh surface via shader.
 * No 3D geometry needed - zero overhead, perfect accuracy.
 * 
 * Inspired by ZBrush/Blender's surface cursor implementation.
 */

import * as THREE from 'three';

const BRUSH_CURSOR_VERTEX_DECLARATION_MARKER = '// __ksculpt_brush_cursor_vertex_declaration__';
const BRUSH_CURSOR_VERTEX_ASSIGNMENT_MARKER = '// __ksculpt_brush_cursor_vertex_assignment__';
const BRUSH_CURSOR_FRAGMENT_DECLARATION_MARKER = '// __ksculpt_brush_cursor_fragment_declaration__';
const BRUSH_CURSOR_FRAGMENT_MAIN_MARKER = '// __ksculpt_brush_cursor_fragment_main__';

// Shader uniforms for brush cursor
export interface BrushCursorUniforms {
    uBrushPosition: THREE.Vector3;
    uBrushRadius: number;
    uBrushColor: THREE.Color;
    uBrushVisible: boolean;
    uSymmetryPosition: THREE.Vector3;
    uSymmetryVisible: boolean;
}

// Vertex shader - just passes world position to fragment
const brushCursorVertexChunk = `
${BRUSH_CURSOR_VERTEX_DECLARATION_MARKER}
varying vec3 vWorldPosition;
`;

const brushCursorVertexMain = `
${BRUSH_CURSOR_VERTEX_ASSIGNMENT_MARKER}
vWorldPosition = worldPosition.xyz;
`;

const brushCursorVertexFallbackMain = `
${BRUSH_CURSOR_VERTEX_ASSIGNMENT_MARKER}
vWorldPosition = (modelMatrix * vec4(transformed, 1.0)).xyz;
`;

// Fragment shader - draws circle at brush position
const brushCursorFragmentChunk = `
${BRUSH_CURSOR_FRAGMENT_DECLARATION_MARKER}
uniform vec3 uBrushPosition;
uniform float uBrushRadius;
uniform vec3 uBrushColor;
uniform bool uBrushVisible;
uniform vec3 uSymmetryPosition;
uniform bool uSymmetryVisible;

varying vec3 vWorldPosition;

float drawBrushCircle(vec3 worldPos, vec3 brushCenter, float radius) {
    float dist = distance(worldPos, brushCenter);
    
    // Ring effect: visible between 0.9*radius and 1.0*radius
    float innerRadius = radius * 0.92;
    float outerRadius = radius * 1.0;
    
    // Smooth ring
    float ring = smoothstep(innerRadius - 0.01, innerRadius, dist) 
               - smoothstep(outerRadius, outerRadius + 0.01, dist);
    
    return ring;
}
`;

const brushCursorFragmentMain = `
    ${BRUSH_CURSOR_FRAGMENT_MAIN_MARKER}
    vec3 cursorColor = vec3(0.0);
    float cursorAlpha = 0.0;
    
    // Main brush cursor
    if (uBrushVisible) {
        float brushRing = drawBrushCircle(vWorldPosition, uBrushPosition, uBrushRadius);
        cursorColor += uBrushColor * brushRing;
        cursorAlpha = max(cursorAlpha, brushRing * 0.8);
    }
    
    // Symmetry cursor
    if (uSymmetryVisible) {
        float symRing = drawBrushCircle(vWorldPosition, uSymmetryPosition, uBrushRadius);
        cursorColor += vec3(1.0, 0.3, 0.0) * symRing; // Orange for symmetry
        cursorAlpha = max(cursorAlpha, symRing * 0.5);
    }
    
    // Blend cursor onto surface color
    if (cursorAlpha > 0.0) {
        gl_FragColor.rgb = mix(gl_FragColor.rgb, cursorColor, cursorAlpha);
    }
`;

function injectBrushCursorVertexShader(vertexShaderSource: string): string {
    let patchedVertexShader = vertexShaderSource;

    if (!patchedVertexShader.includes(BRUSH_CURSOR_VERTEX_DECLARATION_MARKER)) {
        patchedVertexShader = patchedVertexShader.replace(
            '#include <common>',
            `#include <common>
            ${brushCursorVertexChunk}`
        );
    }

    if (!patchedVertexShader.includes(BRUSH_CURSOR_VERTEX_ASSIGNMENT_MARKER)) {
        if (patchedVertexShader.includes('#include <worldpos_vertex>')) {
            patchedVertexShader = patchedVertexShader.replace(
                '#include <worldpos_vertex>',
                `#include <worldpos_vertex>
                ${brushCursorVertexMain}`
            );
        } else {
            patchedVertexShader = patchedVertexShader.replace(
                '#include <project_vertex>',
                `${brushCursorVertexFallbackMain}
                #include <project_vertex>`
            );
        }
    }

    return patchedVertexShader;
}

function injectBrushCursorFragmentShader(fragmentShaderSource: string): string {
    let patchedFragmentShader = fragmentShaderSource;

    if (!patchedFragmentShader.includes(BRUSH_CURSOR_FRAGMENT_DECLARATION_MARKER)) {
        patchedFragmentShader = patchedFragmentShader.replace(
            '#include <common>',
            `#include <common>
            ${brushCursorFragmentChunk}`
        );
    }

    if (!patchedFragmentShader.includes(BRUSH_CURSOR_FRAGMENT_MAIN_MARKER)) {
        patchedFragmentShader = patchedFragmentShader.replace(
            '#include <dithering_fragment>',
            `#include <dithering_fragment>
            ${brushCursorFragmentMain}`
        );
    }

    return patchedFragmentShader;
}

/**
 * Creates brush cursor uniforms with default values
 */
export function createBrushCursorUniforms(): { [key: string]: THREE.IUniform } {
    return {
        uBrushPosition: { value: new THREE.Vector3(0, 0, 0) },
        uBrushRadius: { value: 1.0 },
        uBrushColor: { value: new THREE.Color(0x3daee9) }, // Same as HOVER_COLOR
        uBrushVisible: { value: false },
        uSymmetryPosition: { value: new THREE.Vector3(0, 0, 0) },
        uSymmetryVisible: { value: false },
    };
}

/**
 * Patches an existing Three.js material to include brush cursor projection.
 * Works with MeshStandardMaterial, MeshPhongMaterial, etc.
 */
export function patchMaterialWithBrushCursor(
    material: THREE.Material,
    uniforms: { [key: string]: THREE.IUniform }
): THREE.Material {
    // Clone material to avoid modifying original
    const patchedMaterial = material.clone();
    const existingProgramKey = patchedMaterial.customProgramCacheKey?.bind(patchedMaterial);
    patchedMaterial.customProgramCacheKey = () =>
        `${existingProgramKey ? existingProgramKey() : patchedMaterial.type}|ksculpt-brush-cursor-v2`;

    // Add our uniforms
    (patchedMaterial as any).uniforms = {
        ...(patchedMaterial as any).uniforms || {},
        ...uniforms,
    };

    // PRESERVE existing onBeforeCompile (e.g., mask visualization)
    const existingCallback = material.onBeforeCompile?.bind(material);

    // Inject shader code (chain with existing callback)
    patchedMaterial.onBeforeCompile = (shader, renderer) => {
        // Call existing callback first (mask visualization, etc.)
        if (existingCallback) {
            existingCallback(shader, renderer);
        }

        // Merge uniforms
        Object.assign(shader.uniforms, uniforms);

        shader.vertexShader = injectBrushCursorVertexShader(shader.vertexShader);
        shader.fragmentShader = injectBrushCursorFragmentShader(shader.fragmentShader);
    };

    // Force recompile
    patchedMaterial.needsUpdate = true;

    return patchedMaterial;
}

/**
 * Updates brush cursor uniforms from raycast hit
 */
export function updateBrushCursor(
    uniforms: { [key: string]: THREE.IUniform },
    hit: { point: THREE.Vector3; normal?: THREE.Vector3 } | null,
    radius: number,
    symmetry: 'NONE' | 'X' = 'NONE'
): void {
    if (hit) {
        uniforms.uBrushPosition.value.copy(hit.point);
        uniforms.uBrushRadius.value = radius;
        uniforms.uBrushVisible.value = true;

        // Symmetry
        if (symmetry === 'X') {
            uniforms.uSymmetryPosition.value.set(-hit.point.x, hit.point.y, hit.point.z);
            uniforms.uSymmetryVisible.value = true;
        } else {
            uniforms.uSymmetryVisible.value = false;
        }
    } else {
        uniforms.uBrushVisible.value = false;
        uniforms.uSymmetryVisible.value = false;
    }
}

/**
 * Manager class for GPU brush cursor
 */
export class GPUBrushCursor {
    private uniforms: { [key: string]: THREE.IUniform };
    private patchedMaterials: Map<string, { sourceId: string; material: THREE.Material }> = new Map();

    constructor() {
        this.uniforms = createBrushCursorUniforms();
    }

    /**
     * Patch a mesh's material to include GPU brush cursor
     */
    patchMesh(mesh: THREE.Mesh): void {
        if (!mesh.material) return;
        if (Array.isArray(mesh.material)) return;

        const meshId = mesh.uuid;
        const originalMaterial = mesh.material as THREE.Material;
        const existing = this.patchedMaterials.get(meshId);
        if (existing && mesh.material === existing.material) {
            return;
        }

        if (existing) {
            existing.material.dispose();
        }

        const patchedMaterial = patchMaterialWithBrushCursor(originalMaterial, this.uniforms);
        this.patchedMaterials.set(meshId, {
            sourceId: originalMaterial.uuid,
            material: patchedMaterial
        });
        mesh.material = patchedMaterial;

        console.log('[GPUBrushCursor] Patched mesh material for GPU cursor');
    }

    releaseMesh(mesh: THREE.Mesh): void {
        this.patchedMaterials.delete(mesh.uuid);
    }

    /**
     * Update cursor position from raycast hit
     */
    update(
        hit: { point: THREE.Vector3; normal?: THREE.Vector3 } | null,
        radius: number,
        symmetry: 'NONE' | 'X' = 'NONE'
    ): void {
        updateBrushCursor(this.uniforms, hit, radius, symmetry);
    }

    /**
     * Hide the cursor
     */
    hide(): void {
        this.uniforms.uBrushVisible.value = false;
        this.uniforms.uSymmetryVisible.value = false;
    }

    /**
     * Set cursor color
     */
    setColor(color: THREE.Color | number): void {
        if (typeof color === 'number') {
            this.uniforms.uBrushColor.value.set(color);
        } else {
            this.uniforms.uBrushColor.value.copy(color);
        }
    }

    /**
     * Dispose and cleanup
     */
    dispose(): void {
        this.patchedMaterials.forEach(({ material }) => material.dispose());
        this.patchedMaterials.clear();
    }
}

// Global singleton for easy access
export const gpuBrushCursor = new GPUBrushCursor();
