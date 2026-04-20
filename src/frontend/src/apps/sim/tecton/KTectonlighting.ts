
import * as THREE from 'three';

export const calculateSunDirection = (azimuth: number, elevation: number): THREE.Vector3 => {
    const theta = (elevation * Math.PI) / 180;
    const phi = (azimuth * Math.PI) / 180;
    const x = Math.cos(phi) * Math.cos(theta);
    const y = Math.sin(theta);
    const z = Math.sin(phi) * Math.cos(theta);
    return new THREE.Vector3(x, y, z);
};