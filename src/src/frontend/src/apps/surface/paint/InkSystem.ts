
import { getStroke } from 'perfect-freehand';
import * as THREE from 'three';

/**
 * Wraps 'perfect-freehand' to generate Three.js Geometries for ink strokes.
 */
export class InkSystem {

    /**
     * Generates a ShapeGeometry from a set of points using perfect-freehand.
     * @param points Array of [x, y, pressure] points.
     * @param options Stroke options (size, thinning, etc.)
     * @returns THREE.ShapeGeometry or null if invalid
     */
    static generateStrokeGeometry(points: number[][], options: any = {}): THREE.ShapeGeometry | null {
        if (points.length < 2) return null;

        // 1. Get Outline Points from perfect-freehand
        // Output is flat array of [x, y] coordinates forming the polygon loop
        const outline = getStroke(points, {
            size: 10,
            thinning: 0.5,
            smoothing: 0.5,
            streamline: 0.5,
            simulatePressure: true,
            ...options
        });

        if (!outline || outline.length < 3) return null;

        // 2. Convert to Three.Shape
        const shape = new THREE.Shape();
        const first = outline[0];
        shape.moveTo(first[0], first[1]);

        for (let i = 1; i < outline.length; i++) {
            const p = outline[i];
            shape.lineTo(p[0], p[1]);
        }
        shape.closePath();

        // 3. Triangulate into Geometry
        // curveSegments: 1 is usually enough for these linear segments
        return new THREE.ShapeGeometry(shape, 1);
    }
}
