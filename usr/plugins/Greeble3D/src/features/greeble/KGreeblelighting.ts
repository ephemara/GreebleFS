
import * as THREE from 'three';

export const initLighting = (scene: THREE.Scene) => {
    const keyLight = new THREE.DirectionalLight(0xffffee, 2.0); 
    keyLight.position.set(20, 30, 20);
    keyLight.castShadow = true; 
    keyLight.shadow.mapSize.set(2048, 2048); 
    keyLight.shadow.bias = -0.0001; 
    scene.add(keyLight);
    
    const rimLight = new THREE.SpotLight(0x4455ff, 8); 
    rimLight.position.set(-20, 10, -20); 
    scene.add(rimLight);
    
    const fillLight = new THREE.PointLight(0xffaa88, 2.0); 
    fillLight.position.set(20, 5, -20); 
    scene.add(fillLight);
    
    const bounceLight = new THREE.DirectionalLight(0x444455, 1.2); 
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
