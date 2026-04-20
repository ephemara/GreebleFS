import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { useChronos } from './ChronosContext';
import { VELOCITY_TEMPLATE, SIM_VERTEX, POSITION_FRAG, RENDER_VERTEX, RENDER_FRAG } from './ChronosShaders';

export default function ChronosEngine() {
    const {
        simRes,
        speed, chaos, damping, mode,
        pointSize, opacity, colorHex, color2Hex, colorMode, gradientStrength, autoOrbit,
        highFidelity, // New prop
        isScriptActive, userScript,
        setCompileStatus,
        vatFramesCaptured, setVatFramesCaptured,
        sequenceFramesCaptured, setSequenceFramesCaptured,
        isRecordingVAT, isRecordingSequence,
        engineRef, mountRef, vatFramesRef
    } = useChronos();

    // Local refs for loop
    const requestRef = useRef<number>();

    // INIT ENGINE
    useEffect(() => {
        if (engineRef.current) {
            cancelAnimationFrame(engineRef.current.frameId);
            try {
                engineRef.current.renderer.dispose();
                engineRef.current.controls.dispose();
            } catch (e) { }
            engineRef.current = null;
            if (mountRef.current) mountRef.current.innerHTML = '';
        }
        initEngine();

        return () => {
            if (engineRef.current) cancelAnimationFrame(engineRef.current.frameId);
        };
    }, [simRes]);

    // UPDATE UNIFORMS & BLOOM
    useEffect(() => {
        const r = engineRef.current;
        if (!r) return;
        r.velMat.uniforms.speed.value = speed;
        r.velMat.uniforms.chaos.value = chaos;
        r.velMat.uniforms.uDamping.value = damping;
        r.velMat.uniforms.mode.value = mode;
        r.velMat.uniforms.uScriptActive.value = isScriptActive ? 1.0 : 0.0;
        r.posMat.uniforms.mode.value = mode;
        r.renderMat.uniforms.pointSize.value = pointSize;
        r.renderMat.uniforms.opacity.value = opacity;
        r.renderMat.uniforms.color.value.set(colorHex);
        r.renderMat.uniforms.color2.value.set(color2Hex);
        r.renderMat.uniforms.colorMode.value = (colorMode === 'SOLID' ? 0 : colorMode === 'VELOCITY' ? 1 : colorMode === 'POSITION' ? 2 : 3);
        r.renderMat.uniforms.gradientStrength.value = gradientStrength;
        r.controls.autoRotate = autoOrbit;

        // Update Bloom
        if (r.bloomPass) {
            r.bloomPass.enabled = highFidelity;
            // Boost opacity slightly in HiFi mode to make bloom pop
            r.renderMat.uniforms.opacity.value = highFidelity ? Math.min(1.0, opacity * 1.5) : opacity;
        }

    }, [speed, chaos, damping, mode, pointSize, opacity, colorHex, color2Hex, colorMode, gradientStrength, autoOrbit, isScriptActive, highFidelity]);

    // COMPILE SHADER (Listen to userScript/compile toggle)
    useEffect(() => {
        if (engineRef.current) {
            engineRef.current.compileShader = compileShader;
        }
    });

    const compileShader = () => {
        if (!engineRef.current) return;
        setCompileStatus("COMPILING...");
        try {
            const newFrag = VELOCITY_TEMPLATE.replace('/*_INJECT_*/', userScript);
            const r = engineRef.current;
            const newVelMat = new THREE.ShaderMaterial({
                uniforms: r.velMat.uniforms,
                vertexShader: SIM_VERTEX,
                fragmentShader: newFrag
            });
            r.velMat = newVelMat;
            setCompileStatus("COMPILED");
            setTimeout(() => setCompileStatus("READY"), 1000);
        } catch (e) {
            setCompileStatus("ERROR");
        }
    };

    const initEngine = async () => {
        if (!mountRef.current) return;

        const w = mountRef.current.clientWidth;
        const h = mountRef.current.clientHeight;

        const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true, powerPreference: "high-performance", stencil: false, depth: false, preserveDrawingBuffer: true });
        renderer.setSize(w, h);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.setClearColor(0x000000, 1);
        mountRef.current.appendChild(renderer.domElement);

        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(60, w / h, 0.1, 1000);
        camera.position.set(0, 30, 60);

        const controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.autoRotate = false;

        // POST PROCESSING
        const renderScene = new RenderPass(scene, camera);
        const bloomPass = new UnrealBloomPass(new THREE.Vector2(w, h), 1.5, 0.4, 0.85);
        bloomPass.threshold = 0;
        bloomPass.strength = 1.5;
        bloomPass.radius = 0.5;
        bloomPass.enabled = highFidelity; // Initial State

        const composer = new EffectComposer(renderer);
        composer.addPass(renderScene);
        composer.addPass(bloomPass);

        // GPGPU
        const fType = (renderer.capabilities.isWebGL2) ? THREE.HalfFloatType : THREE.FloatType;
        const getFBO = () => new THREE.WebGLRenderTarget(simRes, simRes, { type: fType, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, format: THREE.RGBAFormat, stencilBuffer: false, depthBuffer: false });
        const buffers = { vel: [getFBO(), getFBO()], pos: [getFBO(), getFBO()] };

        // Init Data
        const pCount = simRes * simRes;
        const posData = new Float32Array(pCount * 4);
        const originData = new Float32Array(pCount * 4);
        for (let i = 0; i < pCount; i++) {
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(2 * Math.random() - 1);
            const r = 30.0 + Math.random() * 5.0;
            const x = r * Math.sin(phi) * Math.cos(theta);
            const y = r * Math.sin(phi) * Math.sin(theta);
            const z = r * Math.cos(phi);
            posData[i * 4] = x; posData[i * 4 + 1] = y; posData[i * 4 + 2] = z; posData[i * 4 + 3] = 1.0;
            originData[i * 4] = x; originData[i * 4 + 1] = y; originData[i * 4 + 2] = z; originData[i * 4 + 3] = 1.0;
        }
        const initPosTex = new THREE.DataTexture(posData, simRes, simRes, THREE.RGBAFormat, THREE.FloatType); initPosTex.needsUpdate = true;
        const originTex = new THREE.DataTexture(originData, simRes, simRes, THREE.RGBAFormat, THREE.FloatType); originTex.needsUpdate = true;

        // Simulation Setup
        const simScene = new THREE.Scene();
        const simCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
        const simQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.MeshBasicMaterial());
        simScene.add(simQuad);

        const velMat = new THREE.ShaderMaterial({
            uniforms: {
                velocityTexture: { value: null }, positionTexture: { value: null }, originTexture: { value: originTex },
                time: { value: 0 }, dt: { value: 0.016 }, speed: { value: speed }, chaos: { value: chaos }, mode: { value: mode },
                uDamping: { value: damping }, uLimit: { value: 5.0 }, uScriptActive: { value: 0 }, mousePos: { value: new THREE.Vector3() }
            }, vertexShader: SIM_VERTEX, fragmentShader: VELOCITY_TEMPLATE.replace('/*_INJECT_*/', '')
        });

        const posMat = new THREE.ShaderMaterial({
            uniforms: { positionTexture: { value: null }, velocityTexture: { value: null }, originTexture: { value: originTex }, dt: { value: 0.016 }, time: { value: 0 }, mode: { value: mode } },
            vertexShader: SIM_VERTEX, fragmentShader: POSITION_FRAG
        });

        // Init FBOs
        simQuad.material = new THREE.MeshBasicMaterial({ map: initPosTex });
        renderer.setRenderTarget(buffers.pos[0]); renderer.render(simScene, simCam);
        renderer.setRenderTarget(buffers.pos[1]); renderer.render(simScene, simCam);
        const zeroTex = new THREE.DataTexture(new Float32Array(pCount * 4).fill(0), simRes, simRes, THREE.RGBAFormat, THREE.FloatType); zeroTex.needsUpdate = true;
        simQuad.material = new THREE.MeshBasicMaterial({ map: zeroTex });
        renderer.setRenderTarget(buffers.vel[0]); renderer.render(simScene, simCam);
        renderer.setRenderTarget(buffers.vel[1]); renderer.render(simScene, simCam);

        const renderMat = new THREE.ShaderMaterial({
            uniforms: {
                positionTexture: { value: null },
                velocityTexture: { value: null },
                pointSize: { value: pointSize },
                sizeMult: { value: Math.max(0.5, 256 / simRes) },
                color: { value: new THREE.Color(colorHex) },
                color2: { value: new THREE.Color(color2Hex) },
                colorMode: { value: 0 },
                gradientStrength: { value: gradientStrength },
                opacity: { value: opacity }
            },
            vertexShader: RENDER_VERTEX, fragmentShader: RENDER_FRAG, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false
        });

        const geo = new THREE.BufferGeometry();
        const refs = new Float32Array(pCount * 2);
        for (let i = 0; i < pCount; i++) { refs[i * 2] = (i % simRes) / simRes; refs[i * 2 + 1] = Math.floor(i / simRes) / simRes; }
        geo.setAttribute('reference', new THREE.BufferAttribute(refs, 2));
        geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pCount * 3), 3));
        const particles = new THREE.Points(geo, renderMat);
        particles.frustumCulled = false;
        scene.add(particles);

        const engine = {
            renderer, scene, camera, controls, buffers, velMat, posMat, renderMat, simScene, simCam, simQuad,
            composer, bloomPass, // Export composer stuff
            mouse: new THREE.Vector3(), raycaster: new THREE.Raycaster(), plane: new THREE.Plane(new THREE.Vector3(0, 0, 1), 0),
            clock: new THREE.Clock(), frameId: 0, isVAT: false, isSequence: false, compileShader: compileShader
        };
        engineRef.current = engine;

        const animate = () => {
            const r = engineRef.current;
            r.frameId = requestAnimationFrame(animate);
            const time = r.clock.getElapsedTime();
            r.controls.update();

            r.simQuad.material = r.velMat;
            r.velMat.uniforms.velocityTexture.value = r.buffers.vel[0].texture;
            r.velMat.uniforms.positionTexture.value = r.buffers.pos[0].texture;
            r.velMat.uniforms.time.value = time;
            r.velMat.uniforms.mousePos.value.copy(r.mouse);
            r.renderer.setRenderTarget(r.buffers.vel[1]);
            r.renderer.render(r.simScene, r.simCam);
            let temp = r.buffers.vel[0]; r.buffers.vel[0] = r.buffers.vel[1]; r.buffers.vel[1] = temp;

            r.simQuad.material = r.posMat;
            r.posMat.uniforms.positionTexture.value = r.buffers.pos[0].texture;
            r.posMat.uniforms.velocityTexture.value = r.buffers.vel[0].texture;
            r.posMat.uniforms.time.value = time;
            r.renderer.setRenderTarget(r.buffers.pos[1]);
            r.renderer.render(r.simScene, r.simCam);
            temp = r.buffers.pos[0]; r.buffers.pos[0] = r.buffers.pos[1]; r.buffers.pos[1] = temp;

            // --- EXPORT CAPTURE ---
            if (r.isVAT || r.isSequence) {
                const w = simRes; const h = simRes;
                const buffer = new Float32Array(w * h * 4);
                r.renderer.readRenderTargetPixels(r.buffers.pos[0], 0, 0, w, h, buffer);
                vatFramesRef.current.push(buffer);
                if (r.isVAT) setVatFramesCaptured(prev => prev + 1);
                if (r.isSequence) setSequenceFramesCaptured(prev => prev + 1);
            }

            r.renderer.setRenderTarget(null);
            r.renderMat.uniforms.positionTexture.value = r.buffers.pos[0].texture;
            r.renderMat.uniforms.velocityTexture.value = r.buffers.vel[0].texture;

            // RENDER (Through Composer if active, else standard)
            // Ideally we always use composer but disable pass, but toggling composer entirely is more performant?
            // Actually BloomPass has an 'enabled' flag. So we always render composer.

            r.composer.render();
            // r.renderer.render(r.scene, r.camera); // Replaced by composer
        };
        animate();
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!engineRef.current || !mountRef.current) return;
        const r = engineRef.current;
        const rect = mountRef.current.getBoundingClientRect();
        r.raycaster.setFromCamera({ x: ((e.clientX - rect.left) / rect.width) * 2 - 1, y: -((e.clientY - rect.top) / rect.height) * 2 + 1 }, r.camera);
        const target = new THREE.Vector3();
        r.camera.getWorldDirection(target); r.plane.normal.copy(target).negate();
        r.raycaster.ray.intersectPlane(r.plane, target);
        if (target) { r.mouse.copy(target); r.mouse.z = (e.buttons === 1) ? 1.0 : 0.0; }
    };

    const resetCamera = () => { if (engineRef.current) { engineRef.current.camera.position.set(0, 30, 60); engineRef.current.controls.target.set(0, 0, 0); engineRef.current.controls.update(); } };

    return (
        <div
            ref={mountRef}
            className="w-full h-full relative"
            onMouseMove={handleMouseMove}
            onMouseDown={handleMouseMove}
            onMouseUp={(e) => { if (engineRef.current) engineRef.current.mouse.z = 0.0; }}
            onDoubleClick={resetCamera}
        />
    );
}
