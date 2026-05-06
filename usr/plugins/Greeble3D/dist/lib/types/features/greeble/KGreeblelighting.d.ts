import * as THREE from 'three';
export declare const initLighting: (scene: THREE.Scene) => {
    keyLight: THREE.DirectionalLight;
    fillLight: THREE.PointLight;
    rimLight: THREE.SpotLight;
    bounceLight: THREE.DirectionalLight;
};
export declare const updateLighting: (lights: {
    keyLight: THREE.DirectionalLight;
    fillLight: THREE.PointLight;
    rimLight: THREE.SpotLight;
    bounceLight: THREE.DirectionalLight;
}, intensity: number, angle: number) => void;
