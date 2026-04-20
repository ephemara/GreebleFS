import * as THREE from 'three';
import { StudioStage } from './StudioStage';

export type GizmoMode = 'translate' | 'rotate' | 'scale';
type Axis = 'X' | 'Y' | 'Z';

export class KGizmo {
    public root: THREE.Group;
    private stage: StudioStage;
    
    // Visual Handles
    private translateGroup: THREE.Group;
    private rotateGroup: THREE.Group;
    private scaleGroup: THREE.Group;
    
    // Interaction State
    private activeAxis: Axis | null = null;
    private mode: GizmoMode = 'translate';
    
    // Math Internals
    public attachedObject: THREE.Object3D | null = null;
    private plane = new THREE.Plane();
    private offset = new THREE.Vector3(); // Click offset
    private startScale = new THREE.Vector3();
    private startRot = new THREE.Euler();
    private startMouse = new THREE.Vector2(); // For rotation calculation
    
    // Configuration
    private gizmoScaleFactor = 0.08; // Smaller = gizmo stays smaller on screen

    constructor(stage: StudioStage) {
        this.stage = stage;
        this.root = new THREE.Group();
        
        // Build all 3 visual sets
        this.translateGroup = this.buildTranslate();
        this.rotateGroup = this.buildRotate();
        this.scaleGroup = this.buildScale();
        
        this.root.add(this.translateGroup);
        this.root.add(this.rotateGroup);
        this.root.add(this.scaleGroup);
        
        // Initial visibility
        this.setMode('translate');
        this.root.visible = false;
        
        // Ensure it renders on top
        this.root.traverse((c) => c.renderOrder = 9999);
        this.stage.scene.add(this.root);
    }

    // --- BUILDERS ---

    private createMaterial(color: number) {
        return new THREE.MeshBasicMaterial({ 
            color, 
            depthTest: false, 
            depthWrite: false,
            transparent: true,
            opacity: 0.8
        });
    }

    private buildTranslate() {
        const group = new THREE.Group();
        const arrowLen = 1.2;
        
        const buildArrow = (axis: Axis, color: number) => {
            const h = new THREE.Group();
            const line = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, arrowLen), this.createMaterial(color));
            line.position.y = arrowLen / 2;
            const cone = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.3), this.createMaterial(color));
            cone.position.y = arrowLen;
            h.add(line, cone);
            
            if (axis === 'X') h.rotateZ(-Math.PI / 2);
            if (axis === 'Z') h.rotateX(Math.PI / 2);
            
            h.userData = { axis, mode: 'translate' };
            h.children.forEach(c => c.userData = { axis, mode: 'translate' }); // Propagate data for raycast
            return h;
        };

        group.add(buildArrow('X', 0xff0000));
        group.add(buildArrow('Y', 0x00ff00));
        group.add(buildArrow('Z', 0x0000ff));
        return group;
    }

    private buildRotate() {
        const group = new THREE.Group();
        const r = 1.0;
        
        const buildRing = (axis: Axis, color: number) => {
            // Torus with tube radius
            const geo = new THREE.TorusGeometry(r, 0.03, 8, 64);
            const mesh = new THREE.Mesh(geo, this.createMaterial(color));
            
            if (axis === 'X') mesh.rotateY(Math.PI / 2);
            if (axis === 'Y') mesh.rotateX(Math.PI / 2);
            // Z is default
            
            mesh.userData = { axis, mode: 'rotate' };
            return mesh;
        };

        group.add(buildRing('X', 0xff0000));
        group.add(buildRing('Y', 0x00ff00));
        group.add(buildRing('Z', 0x0000ff));
        return group;
    }

    private buildScale() {
        const group = new THREE.Group();
        const len = 1.2;
        
        const buildLever = (axis: Axis, color: number) => {
            const h = new THREE.Group();
            const line = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, len), this.createMaterial(color));
            line.position.y = len / 2;
            const box = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.15, 0.15), this.createMaterial(color));
            box.position.y = len;
            h.add(line, box);
            
            if (axis === 'X') h.rotateZ(-Math.PI / 2);
            if (axis === 'Z') h.rotateX(Math.PI / 2);
            
            h.userData = { axis, mode: 'scale' };
            h.children.forEach(c => c.userData = { axis, mode: 'scale' });
            return h;
        };

        group.add(buildLever('X', 0xff0000));
        group.add(buildLever('Y', 0x00ff00));
        group.add(buildLever('Z', 0x0000ff));
        return group;
    }

    // --- CORE LOGIC ---

    update() {
        if (!this.attachedObject || !this.root.visible) return;

        // 1. Follow Object
        this.root.position.copy(this.attachedObject.position);
        this.root.quaternion.copy(this.attachedObject.quaternion); // Match rotation for local space

        // 2. Constant Screen Size
        // We calculate distance to camera, then scale the gizmo group inversely
        const dist = this.stage.camera.position.distanceTo(this.root.position);
        const scale = dist * this.gizmoScaleFactor;
        this.root.scale.set(scale, scale, scale);
    }

    attach(object: THREE.Object3D) {
        this.attachedObject = object;
        this.root.visible = true;
        this.update();
    }

    detach() {
        this.attachedObject = null;
        this.root.visible = false;
        this.activeAxis = null;
    }

    setMode(mode: GizmoMode) {
        this.mode = mode;
        this.translateGroup.visible = mode === 'translate';
        this.rotateGroup.visible = mode === 'rotate';
        this.scaleGroup.visible = mode === 'scale';
    }

    /**
     * RAYCAST HANDLER
     * Returns true if gizmo was hit/grabbed
     */
    onDown(raycaster: THREE.Raycaster, ndc: THREE.Vector2): boolean {
        if (!this.root.visible || !this.attachedObject) return false;

        // Collect visible meshes
        const meshes: THREE.Object3D[] = [];
        const activeGroup = this.mode === 'translate' ? this.translateGroup 
                          : this.mode === 'rotate' ? this.rotateGroup 
                          : this.scaleGroup;
        
        activeGroup.traverse(c => { if ((c as any).isMesh) meshes.push(c); });

        const intersects = raycaster.intersectObjects(meshes);
        if (intersects.length > 0) {
            const hit = intersects[0];
            // Walk up to find the group with userData
            let target = hit.object;
            while(!target.userData.axis && target.parent) target = target.parent;

            const axis = target.userData.axis as Axis;
            
            if (axis) {
                this.activeAxis = axis;
                this.stage.controls!.enabled = false; // Lock cam

                // Store Initial State
                this.startScale.copy(this.attachedObject.scale);
                this.startRot.copy(this.attachedObject.rotation);
                this.startMouse.copy(ndc);

                // Math: Create a plane facing the camera, anchored at object center
                const normal = new THREE.Vector3();
                this.stage.camera.getWorldDirection(normal);
                this.plane.setFromNormalAndCoplanarPoint(normal, this.root.position);
                
                // Calculate Offset
                const intersectPoint = new THREE.Vector3();
                raycaster.ray.intersectPlane(this.plane, intersectPoint);
                this.offset.subVectors(this.attachedObject.position, intersectPoint);
                
                return true;
            }
        }
        return false;
    }

    onMove(raycaster: THREE.Raycaster, ndc: THREE.Vector2) {
        if (!this.activeAxis || !this.attachedObject) return;

        const intersectPoint = new THREE.Vector3();
        raycaster.ray.intersectPlane(this.plane, intersectPoint);
        
        // 1. TRANSLATE
        if (this.mode === 'translate') {
            // Apply offset to get where we "want" to be
            const targetPos = intersectPoint.add(this.offset);
            
            // Axis Locking
            // In a real engine, we'd project vector onto axis line. 
            // Simplified: Just update the component of the axis.
            // Note: This simple version is World Space aligned.
            
            // For now, let's assume world space movement for simplicity
            if (this.activeAxis === 'X') this.attachedObject.position.x = targetPos.x;
            if (this.activeAxis === 'Y') this.attachedObject.position.y = targetPos.y;
            if (this.activeAxis === 'Z') this.attachedObject.position.z = targetPos.z;
        }

        // 2. SCALE
        if (this.mode === 'scale') {
            // Simple drag distance delta
            const dragY = (ndc.y - this.startMouse.y) * 5.0; // Sensitivity
            const dragX = (ndc.x - this.startMouse.x) * 5.0;
            const delta = dragX + dragY; // Combined movement
            
            const factor = 1 + delta;
            
            if (this.activeAxis === 'X') this.attachedObject.scale.x = this.startScale.x * factor;
            if (this.activeAxis === 'Y') this.attachedObject.scale.y = this.startScale.y * factor;
            if (this.activeAxis === 'Z') this.attachedObject.scale.z = this.startScale.z * factor;
        }

        // 3. ROTATE
        if (this.mode === 'rotate') {
            const dragX = (ndc.x - this.startMouse.x) * 5.0;
            
            // Simple Euler addition
            if (this.activeAxis === 'X') this.attachedObject.rotation.x = this.startRot.x + dragX;
            if (this.activeAxis === 'Y') this.attachedObject.rotation.y = this.startRot.y + dragX;
            if (this.activeAxis === 'Z') this.attachedObject.rotation.z = this.startRot.z + dragX;
        }

        // Sync visual gizmo location
        this.root.position.copy(this.attachedObject.position);
        if (this.mode !== 'rotate') this.root.quaternion.copy(this.attachedObject.quaternion);
    }

    onUp() {
        this.activeAxis = null;
        if (this.stage.controls) this.stage.controls.enabled = true;
    }

    get isDragging() { return this.activeAxis !== null; }
}