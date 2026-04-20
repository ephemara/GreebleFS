import { BufferGeometry, Mesh } from 'three';

declare module 'three' {
    interface BufferGeometry {
        computeBoundsTree(options?: any): any;
        disposeBoundsTree(): void;
        boundsTree: any;
    }
}
