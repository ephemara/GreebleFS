import * as THREE from 'three';
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js';
import { StudioStage } from './StudioStage';

export type GizmoMode = 'translate' | 'rotate' | 'scale';

export class GizmoSystem {
    private stage: StudioStage;
    public controls: TransformControls;
    public object: THREE.Object3D | null = null;
    private raycaster: THREE.Raycaster;

    constructor(stage: StudioStage) {
        this.stage = stage;
        this.raycaster = new THREE.Raycaster();
        
        this.controls = new TransformControls(stage.camera, stage.renderer.domElement);
        this.controls.size = 1.2; // Make it bigger and easier to grab
        
        // Disable OrbitControls when dragging
        this.controls.addEventListener('dragging-changed', (event) => {
            if (this.stage.controls) {
                this.stage.controls.enabled = !event.value;
            }
        });

        // CRITICAL: Manually add to scene
        this.stage.scene.add(this.controls as unknown as THREE.Object3D);
        
        console.log("K-GIZMO: System Initialized");
    }

    /**
     * Hit Test: Prevents clicking "through" the gizmo
     */
    checkHit(ndc: { x: number, y: number }): boolean {
        // @ts-ignore
        if (!this.controls.visible || !this.controls.enabled) return false;
        // @ts-ignore
        if (this.controls.dragging || this.controls.axis !== null) return true;

        this.raycaster.setFromCamera(new THREE.Vector2(ndc.x, ndc.y), this.stage.camera);
        // @ts-ignore
        const hits = this.raycaster.intersectObjects(this.controls.children, true);
        return hits.length > 0;
    }

    attach(object: THREE.Object3D) {
        if (!object) return;
        this.object = object;
        this.controls.attach(object);
        // @ts-ignore
        this.controls.visible = true;
        this.controls.enabled = true;
        
        // FORCE UPDATE: Sometimes it needs a kick to appear
        // @ts-ignore
        if (this.controls.updateMatrixWorld) this.controls.updateMatrixWorld();
        
        // NUCLEAR OPTION: Force materials to render on top
        this.forceOverlay();
        
        console.log("K-GIZMO: Attached to", object.uuid);
    }

    detach() {
        this.controls.detach();
        this.object = null;
        // @ts-ignore
        this.controls.visible = false;
        this.controls.enabled = false;
    }

    setMode(mode: GizmoMode) {
        this.controls.setMode(mode);
    }

    /**
     * Makes the Gizmo behave like UE5 (Always on top of geometry)
     */
    private forceOverlay() {
        // @ts-ignore
        this.controls.traverse((child: any) => {
            if (child.isMesh || child.isLine) {
                if (child.material) {
                    child.material.depthTest = false; // SEE THROUGH WALLS
                    child.material.depthWrite = false;
                    child.renderOrder = 9999; // RENDER LAST
                    child.material.transparent = true;
                }
            }
        });
    }

    dispose() {
        this.detach();
        this.controls.dispose();
        this.stage.scene.remove(this.controls as unknown as THREE.Object3D);
    }
}