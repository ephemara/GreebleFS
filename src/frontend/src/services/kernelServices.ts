import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { KernelArtifact, KernelMaterial, KernelAlpha } from '../core/types/kernel';
import { ThumbnailGen } from '../core/services/thumbnailGenerator';

/**
 * Determine category from source string
 */
export const getCategoryFromSource = (source: string): string => {
    const upperSource = source.toUpperCase();
    if (upperSource.includes('SCULPT')) return 'K-SCULPT';
    if (upperSource.includes('GREEBLE')) return 'K-GREEBLE';
    if (upperSource.includes('TECTON')) return 'K-TECTON';
    if (upperSource.includes('SCATTER')) return 'K-SCATTER';
    if (upperSource.includes('CLONER')) return 'K-CLONER';
    if (upperSource.includes('CHRONOS')) return 'K-CHRONOS';
    if (upperSource.includes('QUANTUM')) return 'K-QUANTUM';
    if (upperSource.includes('PAINTER')) return 'K-PAINTER';
    if (upperSource.includes('ATLAS')) return 'K-ATLAS';
    if (upperSource.includes('MERGED')) return 'MERGED';
    return 'IMPORT';
};

/**
 * Commit a blob to kernel storage
 */
export const commitToKernel = async (
    blob: Blob,
    source: string,
    existingCount: number,
    setStatus: (status: string) => void
): Promise<KernelArtifact> => {
    const category = getCategoryFromSource(source);
    setStatus("GENERATING PREVIEW...");
    const thumbnail = await ThumbnailGen.generate(blob);

    const newArtifact: KernelArtifact = {
        id: `ART_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        name: `${source.split('_')[1] || source}_${existingCount + 1}`,
        source: category,
        blob: blob,
        timestamp: Date.now(),
        size: blob.size,
        isWelded: false,
        thumbnail: thumbnail
    };

    setStatus(`RECEIVED: ${newArtifact.name}`);
    return newArtifact;
};

/**
 * Merge multiple artifacts into one
 */
export const mergeArtifacts = async (
    artifactIds: string[],
    artifacts: KernelArtifact[],
    onCommit: (blob: Blob, source: string) => Promise<void>,
    setStatus: (status: string) => void
): Promise<void> => {
    if (artifactIds.length < 2) return;

    setStatus("INITIATING FUSION SEQUENCE...");

    const loader = new GLTFLoader();
    const exporter = new GLTFExporter();
    const mergedScene = new THREE.Scene();

    try {
        const loadPromises = artifactIds.map(id => {
            const art = artifacts.find(a => a.id === id);
            if (!art) return Promise.resolve(null);
            const blobToLoad = (art.isWelded && art.weldedBlob) ? art.weldedBlob : art.blob;
            const url = URL.createObjectURL(blobToLoad);
            return new Promise<THREE.Group | null>((resolve) => {
                loader.load(
                    url,
                    (gltf) => {
                        const container = new THREE.Group();
                        container.name = art.name;
                        container.add(gltf.scene);
                        resolve(container);
                    },
                    undefined,
                    () => resolve(null)
                );
            });
        });

        const loadedScenes = await Promise.all(loadPromises);
        loadedScenes.forEach(scene => {
            if (scene) mergedScene.add(scene);
        });

        exporter.parse(
            mergedScene,
            (gltf) => {
                const blob = new Blob([gltf as ArrayBuffer], { type: 'model/gltf-binary' });
                onCommit(blob, "MERGED_ENTITY");
                setStatus("FUSION COMPLETE");
            },
            (err) => {
                console.error(err);
                setStatus("FUSION ERROR");
            },
            { binary: true }
        );
    } catch (e) {
        console.error(e);
        setStatus("CRITICAL MERGE FAILURE");
    }
};

/**
 * Weld artifact geometry into single mesh
 */
export const weldArtifact = async (
    artifact: KernelArtifact,
    setStatus: (status: string) => void
): Promise<Blob> => {
    setStatus("WELDING GEOMETRY...");

    const url = URL.createObjectURL(artifact.blob);
    const loader = new GLTFLoader();
    const gltf = await new Promise<any>((resolve, reject) =>
        loader.load(url, resolve, undefined, reject)
    );

    const geometries: THREE.BufferGeometry[] = [];
    gltf.scene.traverse((child: any) => {
        if (child.isMesh) {
            const geo = child.geometry.clone();
            child.updateMatrixWorld(true);
            geo.applyMatrix4(child.matrixWorld);
            if (!geo.attributes.uv) {
                const count = geo.attributes.position.count;
                geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(count * 2), 2));
            }
            geometries.push(geo);
        }
    });

    if (geometries.length === 0) throw new Error("No geometry found");

    const mergedGeo = BufferGeometryUtils.mergeGeometries(geometries, false);
    const mergedMesh = new THREE.Mesh(
        mergedGeo,
        new THREE.MeshStandardMaterial({
            color: 0x888888,
            roughness: 0.5,
            metalness: 0.5,
            name: 'Monolith_Mat'
        })
    );
    mergedMesh.name = `${artifact.name}_Monolith`;

    return new Promise((resolve, reject) => {
        const exporter = new GLTFExporter();
        exporter.parse(
            mergedMesh,
            (res) => {
                const weldedBlob = new Blob([res as ArrayBuffer], { type: 'model/gltf-binary' });
                setStatus("WELD COMPLETE");
                resolve(weldedBlob);
            },
            (err) => {
                setStatus("WELD FAILED");
                reject(err);
            },
            { binary: true }
        );
    });
};

/**
 * Create a new material
 */
export const createMaterial = (
    maps: any,
    existingCount: number
): KernelMaterial => {
    return {
        id: `MAT_${Date.now()}`,
        name: `Material_${existingCount + 1}`,
        base: maps.base,
        normal: maps.normal,
        roughness: maps.roughness,
        metallic: maps.metallic,
        ao: maps.ao,
        height: maps.height,
        emissive: maps.emissive,
        preview: maps.base
    };
};

/**
 * Create a new alpha
 */
export const createAlpha = (
    alphaData: { name: string, url: string },
    existingCount: number
): KernelAlpha => {
    const tex = new THREE.TextureLoader().load(alphaData.url);
    return {
        id: `ALPHA_${Date.now()}_${Math.random()}`,
        name: alphaData.name || `Alpha_${existingCount + 1}`,
        url: alphaData.url,
        preview: alphaData.url,
        texture: tex
    };
};

