import { useMemo, useRef, useEffect } from 'react';
import * as THREE from 'three';
import { useThree } from '@react-three/fiber';
import { TransformControls } from '@react-three/drei';
import { useGreebleStore, SceneObject, Layer } from '../../../store/useGreebleStore';
import {
    createGeometry,
    generateTitanStructure,
    generateHyperGreeble,
    generateSuperGreeble,
    getFluxMaterial
} from '../KGreebleEngine';

// --- TEXTURE LOADER HELPER ---
// Loads textures from Data URLs safely
const useLayerTextures = (layer: Layer) => {
    // We use useMemo with a manual loader because useTexture with Data URLs 
    // that change frequently might cause issues or caching weirdness.
    // Also, some maps might be null.

    return useMemo(() => {
        const loader = new THREE.TextureLoader();
        const load = (url: string | null) => {
            if (!url) return null;
            const tex = loader.load(url);
            tex.colorSpace = THREE.SRGBColorSpace; // Assume sRGB for albedo
            tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
            return tex;
        };

        const loadNonColor = (url: string | null) => {
            if (!url) return null;
            const tex = loader.load(url);
            tex.colorSpace = THREE.NoColorSpace; // Linear for normal/roughness
            tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
            return tex;
        };

        return {
            map: load(layer.texture),
            normalMap: loadNonColor(layer.normalMap),
            roughnessMap: loadNonColor(layer.roughnessMap), // Contains AO/Rough/Metal
            displacementMap: loadNonColor(layer.displacementMap)
        };
    }, [layer.texture, layer.normalMap, layer.roughnessMap, layer.displacementMap]);
};

// --- MATERIAL FACTORY ---
const useLayerMaterial = (layer: Layer) => {
    // We only use global matParams for defaults or if layer has no params.
    // Ideally we should rely on layer.matParams if they exist.
    const { matParams: globalParams } = useGreebleStore();
    const params = layer.matParams || globalParams;

    const textures = useLayerTextures(layer);

    return useMemo(() => {
        const flux = layer.flux || { enabled: false };

        if (flux.enabled) {
            const matData = getFluxMaterial(flux.type, {
                time: { value: 0 },
                chaos: { value: flux.chaos },
                colorA: { value: new THREE.Color(flux.colorA) },
                colorB: { value: new THREE.Color(flux.colorB) },
                map: { value: textures.map }
            });

            const mat = new THREE.ShaderMaterial(matData);
            mat.userData.isFlux = true;
            mat.userData.fluxType = flux.type;
            mat.side = THREE.DoubleSide; // Flux is always double
            return mat;
        } else {
            const mat = new THREE.MeshStandardMaterial({
                color: layer.color,
                side: params.doubleSided ? THREE.DoubleSide : THREE.FrontSide,

                // Textures
                map: textures.map,
                normalMap: textures.normalMap,
                roughnessMap: textures.roughnessMap,
                metalnessMap: textures.roughnessMap, // ORM packed
                aoMap: textures.roughnessMap,        // ORM packed
                displacementMap: textures.displacementMap,

                // Parameters - only use high values if we have texture maps
                displacementScale: textures.displacementMap ? params.displacementScale : 0,
                roughness: textures.roughnessMap ? 1.0 : 0.7, // Default to 0.7 if no map
                metalness: textures.roughnessMap ? 1.0 : 0.3, // Default to 0.3 if no map
            });

            // Update Texture Repeat
            if (textures.map) textures.map.repeat.set(params.scale, params.scale);
            if (textures.normalMap) textures.normalMap.repeat.set(params.scale, params.scale);
            if (textures.roughnessMap) textures.roughnessMap.repeat.set(params.scale, params.scale);
            if (textures.displacementMap) textures.displacementMap.repeat.set(params.scale, params.scale);

            return mat;
        }
    }, [layer.flux, layer.color, params, textures]);
};

// --- OBJECT RENDERER ---
const SceneObjectRenderer = ({
    object,
    layerId,
    material
}: {
    object: SceneObject,
    layerId: string,
    material: THREE.Material
}) => {
    const {
        setSelectedObjectUUID, selectedObjectUUID, setTransformData,
        setActiveLayerId,
        mode, gizmoMode, transformSpace, snapEnabled,
        isSnapshotting
    } = useGreebleStore();
    const meshRef = useRef<THREE.Object3D>(null);

    // Create Geometry / Group
    const { geometry, group } = useMemo(() => {
        let geo: THREE.BufferGeometry | null = null;
        let grp: THREE.Group | null = null;

        // Check if it's a complex generator
        if (object.type === 'XENO') {
            grp = generateTitanStructure(material, object.params || {});
        } else if (object.type === 'HYPER') {
            grp = generateHyperGreeble(material, object.params || {}, []); // Imports empty for now
        } else if (object.type === 'SUPER') {
            grp = generateSuperGreeble(material);
        } else {
            // Standard Primitive
            geo = createGeometry(object.type);
        }

        return { geometry: geo, group: grp };
    }, [object.type, object.params]); // Material intentionally excluded from dep array for complex groups to avoid full rebuild

    // Update Material for Groups (since they are created once)
    useEffect(() => {
        if (group) {
            group.traverse((c: any) => {
                if (c.isMesh) c.material = material;
            });
        }
    }, [group, material]);

    // Update Transforms
    useEffect(() => {
        if (meshRef.current) {
            meshRef.current.position.set(...object.position);
            meshRef.current.rotation.set(...object.rotation);
            meshRef.current.scale.set(...object.scale);
            // Mark as container for selection
            meshRef.current.userData.isContainer = true;
            meshRef.current.userData.layerId = layerId;
            meshRef.current.userData.objectId = object.id;
        }
    }, [object.position, object.rotation, object.scale, layerId, object.id]);

    // Interaction
    const handleClick = (e: any) => {
        e.stopPropagation();
        if (meshRef.current) {
            setSelectedObjectUUID(meshRef.current.uuid);
            setActiveLayerId(layerId);

            // Sync transform data for UI
            setTransformData({
                posX: meshRef.current.position.x,
                posY: meshRef.current.position.y,
                posZ: meshRef.current.position.z,
                rotX: meshRef.current.rotation.x,
                rotY: meshRef.current.rotation.y,
                rotZ: meshRef.current.rotation.z,
                scaleX: meshRef.current.scale.x,
                scaleY: meshRef.current.scale.y,
                scaleZ: meshRef.current.scale.z,
                scale: meshRef.current.scale.x, // Approx
                rotationY: meshRef.current.rotation.y,
                height: meshRef.current.position.y
            });
        }
    };

    const isSelected = selectedObjectUUID === meshRef.current?.uuid;

    // Debug logging
    useEffect(() => {
        if (isSelected) {
            console.log('Object selected:', {
                uuid: meshRef.current?.uuid,
                mode,
                isSnapshotting,
                gizmoMode,
                shouldShowGizmo: isSelected && !isSnapshotting && (mode === 'edit' || mode === 'animate')
            });
        }
    }, [isSelected, mode, isSnapshotting, gizmoMode]);

    if (group) {
        return (
            <>
                <primitive
                    object={group}
                    ref={meshRef}
                    onClick={handleClick}
                    onPointerDown={handleClick}
                />
                {isSelected && !isSnapshotting && (mode === 'edit' || mode === 'animate') && meshRef.current && (
                    <TransformControls
                        object={meshRef.current}
                        mode={gizmoMode}
                        space={transformSpace}
                        translationSnap={snapEnabled ? 1 : null}
                        rotationSnap={snapEnabled ? Math.PI / 12 : null}
                        scaleSnap={snapEnabled ? 0.25 : null}
                        size={1.5}
                        showX={true}
                        showY={true}
                        showZ={true}
                    />
                )}
            </>
        );
    }

    if (geometry) {
        return (
            <>
                <mesh
                    ref={meshRef as any}
                    geometry={geometry}
                    material={material}
                    castShadow
                    receiveShadow
                    onClick={handleClick}
                    onPointerDown={handleClick}
                />
                {isSelected && !isSnapshotting && (mode === 'edit' || mode === 'animate') && meshRef.current && (
                    <TransformControls
                        object={meshRef.current}
                        mode={gizmoMode}
                        space={transformSpace}
                        translationSnap={snapEnabled ? 1 : null}
                        rotationSnap={snapEnabled ? Math.PI / 12 : null}
                        scaleSnap={snapEnabled ? 0.25 : null}
                        size={1.5}
                        showX={true}
                        showY={true}
                        showZ={true}
                    />
                )}
            </>
        );
    }

    return null;
};

// --- LAYER WRAPPER ---
const LayerWrapper = ({ layer }: { layer: Layer }) => {
    const material = useLayerMaterial(layer);

    // Update Shader Uniforms (Time)
    useThree(({ clock }) => {
        if (material instanceof THREE.ShaderMaterial && material.uniforms.time) {
            material.uniforms.time.value = clock.getElapsedTime();
        }
    });

    if (!layer.visible) return null;

    // Defensive check: ensure objects array exists before mapping
    const objects = layer.objects ?? [];

    return (
        <group name={layer.name}>
            {objects.map(obj => (
                <SceneObjectRenderer
                    key={obj.id}
                    object={obj}
                    layerId={layer.id}
                    material={material}
                />
            ))}
        </group>
    );
};

// --- MAIN RENDERER ---
export const LayersRenderer = () => {
    const layers = useGreebleStore(state => state.layers);

    return (
        <>
            {layers.map(layer => (
                <LayerWrapper key={layer.id} layer={layer} />
            ))}
        </>
    );
};
