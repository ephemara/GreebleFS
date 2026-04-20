import * as THREE from 'three';

export interface KernelArtifact {
    id: string;
    name: string;
    source: string;
    blob: Blob;
    timestamp: number;
    size: number;
    thumbnail?: string;
    isWelded?: boolean;
    weldedBlob?: Blob;
    isProcessing?: boolean;
}

export interface KernelMaterial {
    id: string;
    name: string;
    base: string; // Blob URL
    normal: string;
    roughness: string;
    metallic: string;
    ao: string;
    height: string;
    emissive: string;
    preview: string; // Base map for thumbnail
}

export interface KernelAlpha {
    id: string;
    name: string;
    url: string; // Blob URL
    preview: string; 
    texture: THREE.Texture;
}

export interface PerformanceSettings {
    resolution: number; // 0.5 - 2.0
    shadows: boolean;
    postFX: boolean;
    antialiasing: boolean;
    mode: 'ECO' | 'BALANCED' | 'ULTRA' | 'CUSTOM';
}

