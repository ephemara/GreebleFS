
import * as THREE from 'three';
import { SCULPT_FRAGMENT, SIM_VERTEX } from './KTectonshaders';

export class TectonSculptor {
    renderer: THREE.WebGLRenderer;
    scene: THREE.Scene;
    camera: THREE.OrthographicCamera;
    mesh: THREE.Mesh;
    material: THREE.ShaderMaterial;

    constructor(renderer: THREE.WebGLRenderer) {
        this.renderer = renderer;
        this.scene = new THREE.Scene();
        this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

        this.material = new THREE.ShaderMaterial({
            uniforms: {
                heightMap: { value: null },
                brushPos: { value: new THREE.Vector2(0.5, 0.5) },
                brushRadius: { value: 0.1 },
                brushStrength: { value: 0.5 },
                mode: { value: 0 },
                noiseSeed: { value: 0.0 },
                res: { value: new THREE.Vector2(512, 512) }
            },
            vertexShader: SIM_VERTEX,
            fragmentShader: SCULPT_FRAGMENT
        });

        this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.material);
        this.scene.add(this.mesh);
    }

    applyBrush(
        sourceTarget: THREE.WebGLRenderTarget,
        destTarget: THREE.WebGLRenderTarget,
        uv: THREE.Vector2,
        params: { radius: number, strength: number, mode: number }
    ) {
        this.material.uniforms.heightMap.value = sourceTarget.texture;
        this.material.uniforms.brushPos.value.copy(uv);
        this.material.uniforms.brushRadius.value = params.radius;
        this.material.uniforms.brushStrength.value = params.strength;
        this.material.uniforms.mode.value = params.mode;
        this.material.uniforms.noiseSeed.value = Math.random();
        this.material.uniforms.res.value.set(sourceTarget.width, sourceTarget.height);

        this.renderer.setRenderTarget(destTarget);
        this.renderer.render(this.scene, this.camera);
        this.renderer.setRenderTarget(null);
    }
}