
import * as THREE from 'three';

export const initLighting = (scene: THREE.Scene) => {
    // Key Light - Warm, strong, casting shadows
    const keyLight = new THREE.DirectionalLight(0xfff0dd, 2.5);
    keyLight.position.set(15, 20, 15);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.set(4096, 4096);
    keyLight.shadow.bias = -0.0005;
    keyLight.shadow.normalBias = 0.1; // Stronger bias to remove artifacts
    scene.add(keyLight);

    // Rim Light - Cool, sharp, separates object from background
    const rimLight = new THREE.SpotLight(0x4455ff, 10);
    rimLight.position.set(-15, 10, -15);
    rimLight.lookAt(0, 0, 0);
    scene.add(rimLight);

    // Fill Light - Soft, cool, fills shadows
    const fillLight = new THREE.PointLight(0xcceeff, 1.0);
    fillLight.position.set(15, 5, -15);
    scene.add(fillLight);

    // Bounce Light - Subtle ground reflection
    const bounceLight = new THREE.DirectionalLight(0x444455, 0.5);
    bounceLight.position.set(0, -10, 0);
    scene.add(bounceLight);

    return { keyLight, fillLight, rimLight, bounceLight };
};

export const updateLighting = (
    lights: { keyLight: THREE.DirectionalLight, fillLight: THREE.PointLight, rimLight: THREE.SpotLight, bounceLight: THREE.DirectionalLight },
    intensity: number,
    angle: number
) => {
    if (!lights || !lights.keyLight) return;

    lights.keyLight.intensity = intensity;
    if (lights.fillLight) lights.fillLight.intensity = intensity * 0.5;
    if (lights.rimLight) lights.rimLight.intensity = intensity * 2.0;
    if (lights.bounceLight) lights.bounceLight.intensity = intensity * 0.6;

    const rad = (angle * Math.PI) / 180;
    const x = Math.sin(rad) * 30;
    const z = Math.cos(rad) * 30;
    lights.keyLight.position.set(x, 30, z);
};
