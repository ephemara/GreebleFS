
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import { PLYLoader } from 'three/examples/jsm/loaders/PLYLoader.js';
import { ColladaLoader } from 'three/examples/jsm/loaders/ColladaLoader.js';
import { USDZLoader } from 'three/examples/jsm/loaders/USDZLoader.js';

import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { OBJExporter } from 'three/examples/jsm/exporters/OBJExporter.js';
import { PLYExporter } from 'three/examples/jsm/exporters/PLYExporter.js';
import { STLExporter } from 'three/examples/jsm/exporters/STLExporter.js';
import { USDZExporter } from 'three/examples/jsm/exporters/USDZExporter.js';

import { Globe, Activity, Box, Sliders, BoxSelect, Gamepad2, Swords, Pickaxe, Truck, Printer, Sun, Microscope, Skull, Ghost, Scan } from 'lucide-react';

export const EXPORT_PRESETS: any = {
    'GENERIC': { label: 'Standard / Web', scale: 1, rotX: 0, up: 'Y', icon: Globe, desc: '1 Unit = 1 Meter. Y-Up.' },
    'UNREAL':  { label: 'Unreal Engine 5', scale: 100, rotX: 0, up: 'Z', icon: Activity, desc: '1 Unit = 1 cm. Z-Up conversion.' },
    'UNITY':   { label: 'Unity 3D', scale: 1, rotX: 0, up: 'Y', icon: Box, desc: '1 Unit = 1 Meter. Y-Up.' },
    'BLENDER': { label: 'Blender', scale: 1, rotX: 0, up: 'Z', icon: Sliders, desc: 'Z-Up match.' },
    'GODOT':   { label: 'Godot Engine', scale: 1, rotX: 0, up: 'Y', icon: Activity, desc: 'Standard GLTF pipeline.' },
    'ROBLOX':  { label: 'Roblox Studio', scale: 20, rotX: 0, up: 'Y', icon: BoxSelect, desc: 'Scaled for Roblox studs.' },
    'SOURCE':  { label: 'Source Engine', scale: 52.5, rotX: 0, up: 'Z', icon: Gamepad2, desc: 'Hammer Units (HL2/GMod).' },
    'CREATION':{ label: 'Bethesda RPG', scale: 70, rotX: 0, up: 'Z', icon: Swords, desc: 'Skyrim/Fallout scale.' },
    'MINECRAFT':{ label: 'Minecraft .OBJ', scale: 1, rotX: 0, up: 'Y', icon: Pickaxe, desc: 'Block scale. 1 Unit = 1 Block.' },
    'LEGO':    { label: 'Brick / LDraw', scale: 125, rotX: 0, up: 'Y', icon: Truck, desc: 'Scaled to Studs (1m = 125 studs).' },
    'PRINT':   { label: '3D Print (Cura)', scale: 1000, rotX: 0, up: 'Z', icon: Printer, desc: 'Converted to Millimeters.' },
    'BRYCE':   { label: 'Bryce 3D / Retro', scale: 10, rotX: 0, up: 'Y', icon: Sun, desc: 'Legacy scaling for retro software.' },
    'MICRO':   { label: 'Microverse', scale: 0.01, rotX: 0, up: 'Y', icon: Microscope, desc: 'What is this? A center for ANTS?' },
    'KAIJU':   { label: 'Kaiju / Cinema', scale: 100, rotX: 0, up: 'Y', icon: Skull, desc: 'City-destroying scale.' },
    'PS1':     { label: 'PS1 / Voxel', scale: 100, rotX: 0, up: 'Y', icon: Ghost, desc: 'Fixed point precision ready.' },
    'AR_IOS':  { label: 'Apple AR (USDZ)', scale: 0.1, rotX: 0, up: 'Y', icon: Scan, desc: 'Small scale for table-top AR.' },
};

export const ExchangeSystem = {
    normalize: (object: THREE.Object3D) => {
        // Critical: Update world matrices before calculating bounding box
        object.updateMatrixWorld(true);

        const box = new THREE.Box3().setFromObject(object);
        const size = new THREE.Vector3();
        const center = new THREE.Vector3();
        
        // Handle empty scene case
        if (box.isEmpty()) {
            // If empty, assume unit size centered at origin to prevent NaNs
            size.set(1,1,1);
            center.set(0,0,0);
        } else {
            box.getSize(size);
            box.getCenter(center);
        }

        const maxDim = Math.max(size.x, size.y, size.z);
        const targetSize = 3.0; 
        const scaleFactor = targetSize / (maxDim || 1); 

        // Apply normalization transforms
        object.scale.set(scaleFactor, scaleFactor, scaleFactor);
        
        // Center the object. We subtract the scaled center vector.
        object.position.sub(center.multiplyScalar(scaleFactor)); 
        
        // Lift to floor (Y=0)
        object.position.y += (size.y * scaleFactor) / 2;

        return { object, meta: { originalSize: size, scaleFactor: scaleFactor, polyCount: 0 } };
    },

    sanitizeMaterials: (object: THREE.Object3D) => {
        object.traverse((c: any) => {
            if (c.isMesh) {
                c.castShadow = true; c.receiveShadow = true;
                
                // Upgrade Legacy Materials to Standard for PBR rendering
                if (!c.material || c.material.type === 'MeshPhongMaterial' || c.material.type === 'MeshLambertMaterial' || c.material.type === 'MeshBasicMaterial') {
                    const oldColor = c.material?.color || new THREE.Color(0xcccccc);
                    const oldMap = c.material?.map || null;
                    const oldNormal = c.material?.normalMap || null;
                    
                    c.material = new THREE.MeshStandardMaterial({
                        color: oldColor, 
                        map: oldMap,
                        normalMap: oldNormal,
                        roughness: 0.5, 
                        metalness: 0.5, 
                        side: THREE.DoubleSide
                    });
                }
                
                // Ensure Environment Map works
                if (c.material) {
                    c.material.envMapIntensity = 1.0;
                    c.material.needsUpdate = true;
                }
            }
        });
    },

    import: (file: File): Promise<THREE.Group> => {
        return new Promise((resolve, reject) => {
            const url = URL.createObjectURL(file);
            const ext = file.name.split('.').pop()?.toLowerCase();
            
            const finalize = (obj: any) => {
                const group = new THREE.Group();
                // Ensure we wrap consistent structure
                const content = (obj.isScene || obj.isGroup) ? obj : new THREE.Group().add(obj);
                group.add(content);
                URL.revokeObjectURL(url);
                resolve(group);
            };
            
            const onError = (e: any) => reject(e);

            try {
                switch (ext) {
                    case 'glb':
                    case 'gltf': new GLTFLoader().load(url, (g) => finalize(g.scene), undefined, onError); break;
                    case 'fbx': new FBXLoader().load(url, finalize, undefined, onError); break;
                    case 'obj': new OBJLoader().load(url, finalize, undefined, onError); break;
                    case 'stl': new STLLoader().load(url, (geo) => finalize(new THREE.Mesh(geo)), undefined, onError); break;
                    case 'ply': new PLYLoader().load(url, (geo) => { geo.computeVertexNormals(); finalize(new THREE.Mesh(geo)); }, undefined, onError); break;
                    case 'dae': new ColladaLoader().load(url, (c) => finalize(c.scene), undefined, onError); break;
                    case 'usdz': new USDZLoader().load(url, finalize, undefined, onError); break;
                    default: reject(new Error("Unsupported Format"));
                }
            } catch (err) { reject(err); }
        });
    },

    export: (object: THREE.Object3D, presetKey: string, format: string): Promise<Blob> => {
        return new Promise((resolve, reject) => {
            const preset = EXPORT_PRESETS[presetKey] || EXPORT_PRESETS['GENERIC'];
            const exportScene = object.clone();
            
            // Apply Preset Transforms
            exportScene.scale.multiplyScalar(preset.scale);
            if (preset.up === 'Z') exportScene.applyMatrix4(new THREE.Matrix4().makeRotationX(-Math.PI / 2));
            exportScene.updateMatrixWorld(true);

            switch(format) {
                case 'GLB':
                    new GLTFExporter().parse(exportScene, (g) => resolve(new Blob([g as ArrayBuffer], {type:'model/gltf-binary'})), reject, { binary: true });
                    break;
                case 'OBJ':
                    const obj = new OBJExporter().parse(exportScene);
                    resolve(new Blob([obj], {type:'text/plain'}));
                    break;
                case 'PLY':
                    new PLYExporter().parse(exportScene, (ply) => resolve(new Blob([ply], {type:'text/plain'})), {});
                    break;
                case 'STL':
                    const stl = new STLExporter().parse(exportScene);
                    resolve(new Blob([stl], {type:'application/octet-stream'}));
                    break;
                case 'USDZ':
                    void new USDZExporter()
                        .parse(exportScene)
                        .then((u) => {
                            const usdzData = new Uint8Array(u);
                            resolve(new Blob([usdzData.buffer], { type: 'application/octet-stream' }));
                        }, reject);
                    break;
                default:
                    reject(new Error("Format Not Supported"));
            }
        });
    }
};
