import * as THREE from 'three';

/**
 * Shared Material System
 * Utilities for creating and managing PBR materials across apps
 */

export interface MaterialMaps {
    base?: string | THREE.Texture;
    normal?: string | THREE.Texture;
    roughness?: string | THREE.Texture;
    metallic?: string | THREE.Texture;
    ao?: string | THREE.Texture;
    height?: string | THREE.Texture;
    emissive?: string | THREE.Texture;
}

export interface MaterialParams {
    color?: THREE.Color | string | number;
    roughness?: number;
    metalness?: number;
    normalScale?: THREE.Vector2;
    aoMapIntensity?: number;
    displacementScale?: number;
    emissive?: THREE.Color | string | number;
    emissiveIntensity?: number;
}

/**
 * Create a PBR material from maps and parameters
 */
export const createPBRMaterial = (
    maps: MaterialMaps = {},
    params: MaterialParams = {}
): THREE.MeshStandardMaterial => {
    const material = new THREE.MeshStandardMaterial({
        color: params.color || 0xffffff,
        roughness: params.roughness ?? 0.5,
        metalness: params.metalness ?? 0.5,
        normalScale: params.normalScale || new THREE.Vector2(1, 1),
        aoMapIntensity: params.aoMapIntensity ?? 1.0,
        displacementScale: params.displacementScale ?? 0,
        emissive: params.emissive || 0x000000,
        emissiveIntensity: params.emissiveIntensity ?? 1.0
    });

    // Load textures
    const loader = new THREE.TextureLoader();
    
    if (maps.base) {
        if (typeof maps.base === 'string') {
            material.map = loader.load(maps.base);
        } else {
            material.map = maps.base;
        }
    }

    if (maps.normal) {
        if (typeof maps.normal === 'string') {
            material.normalMap = loader.load(maps.normal);
        } else {
            material.normalMap = maps.normal;
        }
        material.normalMapType = THREE.TangentSpaceNormalMap;
    }

    if (maps.roughness) {
        if (typeof maps.roughness === 'string') {
            material.roughnessMap = loader.load(maps.roughness);
        } else {
            material.roughnessMap = maps.roughness;
        }
    }

    if (maps.metallic) {
        if (typeof maps.metallic === 'string') {
            material.metalnessMap = loader.load(maps.metallic);
        } else {
            material.metalnessMap = maps.metallic;
        }
    }

    if (maps.ao) {
        if (typeof maps.ao === 'string') {
            material.aoMap = loader.load(maps.ao);
        } else {
            material.aoMap = maps.ao;
        }
    }

    if (maps.height) {
        if (typeof maps.height === 'string') {
            material.displacementMap = loader.load(maps.height);
        } else {
            material.displacementMap = maps.height;
        }
    }

    if (maps.emissive) {
        if (typeof maps.emissive === 'string') {
            material.emissiveMap = loader.load(maps.emissive);
        } else {
            material.emissiveMap = maps.emissive;
        }
    }

    return material;
};

/**
 * Create a material from a single ORM texture (packed AO, Roughness, Metallic)
 */
export const createMaterialFromORM = (
    ormTexture: THREE.Texture | string,
    baseColor?: THREE.Color | string | number,
    params: MaterialParams = {}
): THREE.MeshStandardMaterial => {
    const loader = new THREE.TextureLoader();
    const orm = typeof ormTexture === 'string' ? loader.load(ormTexture) : ormTexture;

    const material = new THREE.MeshStandardMaterial({
        color: baseColor || 0xffffff,
        roughness: params.roughness ?? 0.5,
        metalness: params.metalness ?? 0.5,
        ...params
    });

    // ORM texture: R = AO, G = Roughness, B = Metallic
    material.aoMap = orm;
    material.roughnessMap = orm;
    material.metalnessMap = orm;
    material.aoMapIntensity = params.aoMapIntensity ?? 1.0;

    return material;
};

/**
 * Clone a material with optional overrides
 */
export const cloneMaterial = (
    source: THREE.Material,
    overrides: Partial<THREE.MeshStandardMaterialParameters> = {}
): THREE.MeshStandardMaterial => {
    if (source instanceof THREE.MeshStandardMaterial) {
        return source.clone();
    }
    
    // Create new material with defaults
    return new THREE.MeshStandardMaterial({
        color: 0xffffff,
        roughness: 0.5,
        metalness: 0.5,
        ...overrides
    });
};
