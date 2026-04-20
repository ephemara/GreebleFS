import * as THREE from 'three';
import { UNIVERSAL_VIEWPORT_GRID_THEME } from '../zen/viewportTheme';

export interface AdaptiveInfiniteGridOptions {
    elevation?: number;
    minCellSize?: number;
    minorDivisions?: number;
    majorLineEvery?: number;
    minExtent?: number;
    maxExtent?: number;
    minorColor?: THREE.ColorRepresentation;
    majorColor?: THREE.ColorRepresentation;
    minorOpacity?: number;
    majorOpacity?: number;
}

const GRID_STEP_SEQUENCE = [1, 2, 5] as const;
type GridFocusTarget = { x: number; y: number; z: number };

const clamp = (value: number, min: number, max: number): number =>
    Math.min(max, Math.max(min, value));

const quantizeGridStep = (idealStep: number): number => {
    if (!Number.isFinite(idealStep) || idealStep <= 0) {
        return 1;
    }

    const exponent = Math.floor(Math.log10(idealStep));
    const power = Math.pow(10, exponent);
    const normalized = idealStep / power;

    let closest: number = GRID_STEP_SEQUENCE[0];
    let closestDelta = Number.POSITIVE_INFINITY;

    for (const candidate of GRID_STEP_SEQUENCE) {
        const delta = Math.abs(candidate - normalized);
        if (delta < closestDelta) {
            closest = candidate;
            closestDelta = delta;
        }
    }

    return closest * power;
};

const disposeObjectMaterials = (object: THREE.Object3D) => {
    object.traverse((child) => {
        const material = (child as THREE.Mesh).material;
        if (!material) {
            return;
        }

        const materials = Array.isArray(material) ? material : [material];
        materials.forEach((entry) => entry.dispose());
    });
};

export class AdaptiveInfiniteGrid {
    readonly group = new THREE.Group();

    private minorGrid: THREE.GridHelper | null = null;
    private majorGrid: THREE.GridHelper | null = null;
    private readonly focus = new THREE.Vector3();
    private lastGridKey = '';
    private readonly options: Required<AdaptiveInfiniteGridOptions>;

    constructor(options: AdaptiveInfiniteGridOptions = {}) {
        this.options = {
            elevation: options.elevation ?? UNIVERSAL_VIEWPORT_GRID_THEME.elevation,
            minCellSize: options.minCellSize ?? UNIVERSAL_VIEWPORT_GRID_THEME.minCellSize,
            minorDivisions: options.minorDivisions ?? UNIVERSAL_VIEWPORT_GRID_THEME.minorDivisions,
            majorLineEvery: options.majorLineEvery ?? UNIVERSAL_VIEWPORT_GRID_THEME.majorLineEvery,
            minExtent: options.minExtent ?? UNIVERSAL_VIEWPORT_GRID_THEME.minExtent,
            maxExtent: options.maxExtent ?? UNIVERSAL_VIEWPORT_GRID_THEME.maxExtent,
            minorColor: options.minorColor ?? UNIVERSAL_VIEWPORT_GRID_THEME.minorColor,
            majorColor: options.majorColor ?? UNIVERSAL_VIEWPORT_GRID_THEME.majorColor,
            minorOpacity: options.minorOpacity ?? UNIVERSAL_VIEWPORT_GRID_THEME.minorOpacity,
            majorOpacity: options.majorOpacity ?? UNIVERSAL_VIEWPORT_GRID_THEME.majorOpacity
        };

        this.group.name = 'AdaptiveInfiniteGrid';
        this.group.position.y = this.options.elevation;
    }

    setVisible(visible: boolean) {
        this.group.visible = visible;
    }

    update(camera: THREE.Camera, target?: GridFocusTarget | null) {
        this.focus.set(
            target?.x ?? camera.position.x,
            target?.y ?? this.options.elevation,
            target?.z ?? camera.position.z
        );

        const visibleHeight = camera instanceof THREE.OrthographicCamera
            ? Math.abs(camera.top - camera.bottom) / Math.max(camera.zoom, 0.0001)
            : 2
            * Math.tan(THREE.MathUtils.degToRad((camera as THREE.PerspectiveCamera).fov * 0.5))
            * camera.position.distanceTo(this.focus);

        const idealMinorStep = Math.max(this.options.minCellSize, visibleHeight / 20);
        const minorStep = quantizeGridStep(idealMinorStep);
        const size = clamp(
            Math.max(this.options.minExtent, minorStep * this.options.minorDivisions),
            this.options.minExtent,
            this.options.maxExtent
        );
        const minorDivisions = Math.max(1, Math.round(size / minorStep));
        const majorStep = minorStep * this.options.majorLineEvery;
        const majorDivisions = Math.max(1, Math.round(size / majorStep));

        const gridKey = [size, minorDivisions, majorDivisions].join(':');
        if (gridKey !== this.lastGridKey) {
            this.rebuild(size, minorDivisions, majorDivisions);
            this.lastGridKey = gridKey;
        }

        this.group.position.x = Math.round(this.focus.x / majorStep) * majorStep;
        this.group.position.z = Math.round(this.focus.z / majorStep) * majorStep;
    }

    dispose() {
        if (this.minorGrid) {
            this.group.remove(this.minorGrid);
            this.minorGrid.geometry.dispose();
            disposeObjectMaterials(this.minorGrid);
            this.minorGrid = null;
        }

        if (this.majorGrid) {
            this.group.remove(this.majorGrid);
            this.majorGrid.geometry.dispose();
            disposeObjectMaterials(this.majorGrid);
            this.majorGrid = null;
        }

        this.lastGridKey = '';
    }

    private rebuild(size: number, minorDivisions: number, majorDivisions: number) {
        this.dispose();

        this.minorGrid = this.createGrid(size, minorDivisions, this.options.minorColor, this.options.minorOpacity, 0);
        this.majorGrid = this.createGrid(size, majorDivisions, this.options.majorColor, this.options.majorOpacity, 0.001);

        this.group.add(this.minorGrid, this.majorGrid);
    }

    private createGrid(
        size: number,
        divisions: number,
        color: THREE.ColorRepresentation,
        opacity: number,
        yOffset: number
    ): THREE.GridHelper {
        const grid = new THREE.GridHelper(size, divisions, color, color);
        grid.position.y = yOffset;
        grid.frustumCulled = false;
        grid.renderOrder = -1000;
        grid.userData.ignoreRaycast = true;
        grid.raycast = () => { };

        const materials = Array.isArray(grid.material) ? grid.material : [grid.material];
        materials.forEach((material) => {
            material.transparent = true;
            material.opacity = opacity;
            material.depthWrite = false;
            material.toneMapped = false;
        });

        return grid;
    }
}
