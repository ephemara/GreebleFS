import * as THREE from 'three';

/**
 * K-RIG MARKER SYSTEM
 * 
 * The 8-Dot Solution: Instead of manually placing bones, users place 8 markers
 * on key anatomical landmarks. The system then automatically fits a template
 * skeleton to these markers.
 * 
 * Marker Points:
 * 1. HEAD (Chin)
 * 2. L_WRIST
 * 3. R_WRIST
 * 4. L_ELBOW
 * 5. R_ELBOW
 * 6. L_KNEE
 * 7. R_KNEE
 * 8. GROIN (Hip Center)
 */

export enum MarkerType {
    HEAD = 'HEAD',
    L_WRIST = 'L_WRIST',
    R_WRIST = 'R_WRIST',
    L_ELBOW = 'L_ELBOW',
    R_ELBOW = 'R_ELBOW',
    L_KNEE = 'L_KNEE',
    R_KNEE = 'R_KNEE',
    GROIN = 'GROIN'
}

export interface Marker {
    type: MarkerType;
    position: THREE.Vector3;
    mesh: THREE.Mesh;
}

export class KRigMarkerSystem {
    markers: Map<MarkerType, Marker> = new Map();
    scene: THREE.Scene;
    raycaster = new THREE.Raycaster();

    // Visual settings
    markerBaseRadius = 0.05;
    markerScale = 1.0;

    markerColors: Map<MarkerType, number> = new Map([
        [MarkerType.HEAD, 0x00ffff],      // Cyan
        [MarkerType.L_WRIST, 0xff00ff],   // Magenta
        [MarkerType.R_WRIST, 0xff00ff],   // Magenta
        [MarkerType.L_ELBOW, 0xffff00],   // Yellow
        [MarkerType.R_ELBOW, 0xffff00],   // Yellow
        [MarkerType.L_KNEE, 0x00ff00],    // Green
        [MarkerType.R_KNEE, 0x00ff00],    // Green
        [MarkerType.GROIN, 0xff0000],     // Red
    ]);

    constructor(scene: THREE.Scene) {
        this.scene = scene;
    }

    setMarkerScale(scale: number) {
        this.markerScale = scale;
        // Optionally resize existing markers
        const radius = this.markerBaseRadius * this.markerScale;
        this.markers.forEach(m => {
            m.mesh.scale.set(radius, radius, radius);
        });
    }

    /**
     * Place a marker at a world position
     */
    placeMarker(type: MarkerType, worldPosition: THREE.Vector3) {
        if (this.markers.has(type)) {
            this.removeMarker(type);
        }

        const radius = this.markerBaseRadius * this.markerScale;
        const geometry = new THREE.SphereGeometry(radius, 16, 16);
        const material = new THREE.MeshBasicMaterial({
            color: this.markerColors.get(type) || 0xffffff,
            transparent: true,
            opacity: 0.8,
            depthTest: false
        });

        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.copy(worldPosition);
        mesh.userData.markerType = type;
        mesh.renderOrder = 999; // Always render on top

        // Add glow effect
        // Reuse radius
        const glowGeo = new THREE.SphereGeometry(radius * 1.5, 16, 16);
        const glowMat = new THREE.MeshBasicMaterial({
            color: this.markerColors.get(type) || 0xffffff,
            transparent: true,
            opacity: 0.3,
            depthTest: false
        });
        const glow = new THREE.Mesh(glowGeo, glowMat);
        mesh.add(glow);

        this.scene.add(mesh);

        const marker: Marker = {
            type,
            position: worldPosition.clone(),
            mesh
        };

        this.markers.set(type, marker);
        console.log(`K-RIG: Placed ${type} marker at`, worldPosition);
    }

    /**
     * Raycast to mesh and place marker at intersection point
     */
    placeMarkerOnMesh(
        type: MarkerType,
        ndc: { x: number; y: number },
        camera: THREE.Camera,
        targetMesh: THREE.Mesh
    ): boolean {
        this.raycaster.setFromCamera(new THREE.Vector2(ndc.x, ndc.y), camera);
        const intersects = this.raycaster.intersectObject(targetMesh);

        if (intersects.length > 0) {
            this.placeMarker(type, intersects[0].point);
            return true;
        }
        return false;
    }

    /**
     * Remove a specific marker
     */
    removeMarker(type: MarkerType) {
        const marker = this.markers.get(type);
        if (marker) {
            this.scene.remove(marker.mesh);
            this.markers.delete(type);
        }
    }

    /**
     * Clear all markers
     */
    clearAll() {
        this.markers.forEach(marker => {
            this.scene.remove(marker.mesh);
        });
        this.markers.clear();
    }

    /**
     * Check if all required markers are placed
     */
    isComplete(): boolean {
        return this.markers.size === Object.keys(MarkerType).length;
    }

    /**
     * Get all marker positions as a map
     */
    getMarkerPositions(): Map<MarkerType, THREE.Vector3> {
        const positions = new Map<MarkerType, THREE.Vector3>();
        this.markers.forEach((marker, type) => {
            positions.set(type, marker.position.clone());
        });
        return positions;
    }

    /**
     * Preview marker position (ghost)
     */
    previewMesh: THREE.Mesh | null = null;

    updatePreview(position: THREE.Vector3) {
        if (!this.previewMesh) {
            const radius = this.markerBaseRadius * this.markerScale;
            // Note: Since we reuse the mesh, if scale changes dynamically we might need to recreate or rescale it.
            // For now, simpler to just rescale on update if needed, but here we create geometry.
            const geometry = new THREE.SphereGeometry(1, 16, 16); // Unit sphere, we scale it
            const material = new THREE.MeshBasicMaterial({
                color: 0xffffff,
                transparent: true,
                opacity: 0.5,
                depthTest: false
            });
            this.previewMesh = new THREE.Mesh(geometry, material);
            this.scene.add(this.previewMesh);
        }
        this.previewMesh.position.copy(position);
        const radius = this.markerBaseRadius * this.markerScale;
        this.previewMesh.scale.set(radius, radius, radius);
        this.previewMesh.visible = true;
    }

    hidePreview() {
        if (this.previewMesh) {
            this.previewMesh.visible = false;
        }
    }

    dispose() {
        this.clearAll();
        if (this.previewMesh) {
            this.scene.remove(this.previewMesh);
        }
    }
}

/**
 * SKELETON TEMPLATE FITTER
 * 
 * Takes the 8 marker points and fits a standard skeleton to match them.
 * Uses constraint-based solving to scale and position bones.
 */
export class SkeletonFitter {
    /**
     * Fit a BIPED skeleton to the 8 marker points
     * Returns modified bone configuration ready for spawning
     */
    static fitBipedSkeleton(markers: Map<MarkerType, THREE.Vector3>): any {
        // Ensure all markers are present
        const requiredMarkers = Object.values(MarkerType);
        for (const markerType of requiredMarkers) {
            if (!markers.has(markerType as MarkerType)) {
                throw new Error(`Missing required marker: ${markerType}`);
            }
        }

        // Extract positions
        const head = markers.get(MarkerType.HEAD)!;
        const groin = markers.get(MarkerType.GROIN)!;
        const lWrist = markers.get(MarkerType.L_WRIST)!;
        const rWrist = markers.get(MarkerType.R_WRIST)!;
        const lElbow = markers.get(MarkerType.L_ELBOW)!;
        const rElbow = markers.get(MarkerType.R_ELBOW)!;
        const lKnee = markers.get(MarkerType.L_KNEE)!;
        const rKnee = markers.get(MarkerType.R_KNEE)!;

        // Calculate spine positions (interpolate between groin and head)
        const torsoHeight = head.y - groin.y;
        const hipY = groin.y;
        const spineY = hipY + torsoHeight * 0.3;
        const chestY = hipY + torsoHeight * 0.6;
        const neckY = hipY + torsoHeight * 0.85;
        const headY = head.y;

        // Calculate shoulder positions (midpoint between chest and elbows)
        const shoulderY = chestY;
        const lShoulderX = (lElbow.x + lWrist.x) * 0.5;
        const rShoulderX = (rElbow.x + rWrist.x) * 0.5;

        // Estimate ankle positions (below knee, projected down)
        const kneeToAnkleRatio = 0.6; // Proportional to knee height
        const lAnkleY = Math.max(0, lKnee.y * kneeToAnkleRatio);
        const rAnkleY = Math.max(0, rKnee.y * kneeToAnkleRatio);

        // Build fitted bone configuration
        const fittedConfig = {
            bones: [
                // 0: Hips (at groin)
                { name: 'Hips', pos: [groin.x, groin.y, groin.z], parent: -1 },

                // 1: Spine
                { name: 'Spine', pos: [groin.x, spineY, groin.z], parent: 0 },

                // 2: Chest
                { name: 'Chest', pos: [groin.x, chestY, groin.z], parent: 1 },

                // 3: Neck
                { name: 'Neck', pos: [head.x, neckY, head.z], parent: 2 },

                // 4: Head
                { name: 'Head', pos: [head.x, headY, head.z], parent: 3 },

                // LEFT ARM CHAIN
                // 5: L_Shoulder
                { name: 'L_Shoulder', pos: [lShoulderX, shoulderY, groin.z], parent: 2 },

                // 6: L_Arm (positioned at elbow)
                { name: 'L_Arm', pos: [lElbow.x, lElbow.y, lElbow.z], parent: 5 },

                // 7: L_ForeArm (positioned between elbow and wrist)
                {
                    name: 'L_ForeArm', pos: [
                        (lElbow.x + lWrist.x) * 0.5,
                        (lElbow.y + lWrist.y) * 0.5,
                        (lElbow.z + lWrist.z) * 0.5
                    ], parent: 6
                },

                // 8: L_Hand
                { name: 'L_Hand', pos: [lWrist.x, lWrist.y, lWrist.z], parent: 7, isIK: true },

                // RIGHT ARM CHAIN
                // 9: R_Shoulder
                { name: 'R_Shoulder', pos: [rShoulderX, shoulderY, groin.z], parent: 2 },

                // 10: R_Arm
                { name: 'R_Arm', pos: [rElbow.x, rElbow.y, rElbow.z], parent: 9 },

                // 11: R_ForeArm
                {
                    name: 'R_ForeArm', pos: [
                        (rElbow.x + rWrist.x) * 0.5,
                        (rElbow.y + rWrist.y) * 0.5,
                        (rElbow.z + rWrist.z) * 0.5
                    ], parent: 10
                },

                // 12: R_Hand
                { name: 'R_Hand', pos: [rWrist.x, rWrist.y, rWrist.z], parent: 11, isIK: true },

                // LEFT LEG CHAIN
                // 13: L_UpLeg
                {
                    name: 'L_UpLeg', pos: [
                        (groin.x + lKnee.x) * 0.5,
                        (groin.y + lKnee.y) * 0.7,
                        groin.z
                    ], parent: 0
                },

                // 14: L_Leg (at knee)
                { name: 'L_Leg', pos: [lKnee.x, lKnee.y, lKnee.z], parent: 13 },

                // 15: L_Foot
                { name: 'L_Foot', pos: [lKnee.x, lAnkleY, lKnee.z + 0.1], parent: 14, isIK: true },

                // RIGHT LEG CHAIN
                // 16: R_UpLeg
                {
                    name: 'R_UpLeg', pos: [
                        (groin.x + rKnee.x) * 0.5,
                        (groin.y + rKnee.y) * 0.7,
                        groin.z
                    ], parent: 0
                },

                // 17: R_Leg
                { name: 'R_Leg', pos: [rKnee.x, rKnee.y, rKnee.z], parent: 16 },

                // 18: R_Foot
                { name: 'R_Foot', pos: [rKnee.x, rAnkleY, rKnee.z + 0.1], parent: 17, isIK: true },
            ]
        };

        console.log('K-RIG: Fitted skeleton to markers', fittedConfig);
        return fittedConfig;
    }
}
