import { useEffect, useRef, useState } from 'react';
import { useThree } from '@react-three/fiber';
import { TransformControls } from '@react-three/drei';
import { useGreebleStore } from '../../../store/useGreebleStore';
import * as THREE from 'three';
import { logger } from '../../../lib/utils/logger';

export const GizmoControls = () => {
    const { mode, gizmoMode, transformSpace, snapEnabled, selectedObjectUUID, setTransformData, setIsGizmoDragging } = useGreebleStore();
    const { scene, controls } = useThree();
    const transformRef = useRef<any>(null);
    const [selectedObject, setSelectedObject] = useState<THREE.Object3D | null>(null);

    // Find the selected object in the scene
    useEffect(() => {
        if (!selectedObjectUUID || !scene) {
            setSelectedObject(null);
            logger.log('🎯 GizmoControls: No selection');
            return;
        }

        // Search for object by UUID
        let found: THREE.Object3D | null = null;
        scene.traverse((obj) => {
            if (obj.uuid === selectedObjectUUID) {
                found = obj;
            }
        });

        if (found) {
            logger.log('✅ GizmoControls: Found object', (found as any).name || (found as any).type, 'UUID:', selectedObjectUUID);
        } else {
            logger.warn('⚠️ GizmoControls: Object not found with UUID:', selectedObjectUUID);
        }

        setSelectedObject(found);
    }, [selectedObjectUUID, scene]);

    // Disable orbit controls when dragging gizmo + set global dragging state
    useEffect(() => {
        const transformControl = transformRef.current;
        if (!transformControl || !controls) return;

        const handleDraggingChanged = (event: any) => {
            const isDragging = event.value;
            
            // Disable orbit controls during drag
            if (controls) {
                (controls as any).enabled = !isDragging;
            }
            
            // Set global dragging state to prevent raycasting during drag
            setIsGizmoDragging(isDragging);
            
            logger.log(`🎯 Gizmo dragging: ${isDragging ? 'STARTED' : 'STOPPED'}`);
        };

        transformControl.addEventListener('dragging-changed', handleDraggingChanged);
        return () => {
            transformControl.removeEventListener('dragging-changed', handleDraggingChanged);
            setIsGizmoDragging(false); // Clean up on unmount
        };
    }, [controls, setIsGizmoDragging]);

    // Update transform data when object moves
    useEffect(() => {
        const transformControl = transformRef.current;
        if (!transformControl || !selectedObject) return;

        const handleChange = () => {
            if (!selectedObject) return;

            setTransformData({
                posX: selectedObject.position.x,
                posY: selectedObject.position.y,
                posZ: selectedObject.position.z,
                rotX: selectedObject.rotation.x,
                rotY: selectedObject.rotation.y,
                rotZ: selectedObject.rotation.z,
                scaleX: selectedObject.scale.x,
                scaleY: selectedObject.scale.y,
                scaleZ: selectedObject.scale.z,
                scale: selectedObject.scale.x,
                rotationY: selectedObject.rotation.y,
                height: selectedObject.position.y
            });
        };

        transformControl.addEventListener('objectChange', handleChange);
        return () => {
            transformControl.removeEventListener('objectChange', handleChange);
        };
    }, [setTransformData, selectedObject]);

    // Only show gizmo in edit or animate mode with a selected object
    logger.log('🎯 GizmoControls render check:', {
        mode,
        hasSelectedUUID: !!selectedObjectUUID,
        hasSelectedObject: !!selectedObject,
        selectedUUID: selectedObjectUUID
    });
    
    if ((mode !== 'edit' && mode !== 'animate') || !selectedObject) {
        logger.log('⚠️ GizmoControls: Not rendering (mode or no object)');
        return null;
    }

    logger.log('✅ GizmoControls: Rendering gizmo!');

    return (
        <TransformControls
            ref={transformRef}
            object={selectedObject}
            mode={gizmoMode as any}
            space={transformSpace as any}
            translationSnap={snapEnabled ? 1.0 : undefined}
            rotationSnap={snapEnabled ? THREE.MathUtils.degToRad(15) : undefined}
            scaleSnap={snapEnabled ? 0.25 : undefined}
            showX
            showY
            showZ
            enabled={mode === 'edit' || mode === 'animate'}
            size={0.8}
        />
    );
};

