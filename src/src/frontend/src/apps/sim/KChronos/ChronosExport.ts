import { useChronos } from './ChronosContext';
import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import JSZip from 'jszip';
import { useRef } from 'react';

// Utils
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

export const useChronosExport = () => {
    const context = useChronos();
    const {
        status, setStatus,
        simRes,
        recResolution, recQuality, recFormat,
        isRecording, setIsRecording,
        isRecordingVAT, setIsRecordingVAT,
        isRecordingSequence, setIsRecordingSequence,
        setVatFramesCaptured, setSequenceFramesCaptured,
        setProcessingProgress,
        engineRef, mountRef, vatFramesRef,
        onCommit
    } = context;

    const mediaRecorderRef = useRef<any>(null);
    const chunksRef = useRef<any[]>([]);

    // --- GLTF SNAPSHOT ---
    const handleCommit = () => {
        const r = engineRef.current; if (!r) return;
        setStatus("FREEZING TIME...");

        const w = simRes; const h = simRes; const buf = new Float32Array(w * h * 4);
        r.renderer.readRenderTargetPixels(r.buffers.pos[0], 0, 0, w, h, buf);
        const geoPos = new Float32Array(w * h * 3);
        // Map texture data to position attribute
        for (let i = 0; i < w * h; i++) { geoPos[i * 3] = buf[i * 4]; geoPos[i * 3 + 1] = buf[i * 4 + 1]; geoPos[i * 3 + 2] = buf[i * 4 + 2]; }
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(geoPos, 3));
        const mesh = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.1 }));
        mesh.name = "Chronos_Particle_Freeze";

        const exporter = new GLTFExporter();
        exporter.parse(mesh, (gltf: any) => {
            const blob = new Blob([gltf], { type: 'application/octet-stream' });
            if (onCommit) {
                onCommit(blob, "K-CHRONOS_FREEZE");
                setStatus("SENT TO KERNEL");
            }
        }, (err) => console.error(err), { binary: true });
    };

    // --- VIDEO RECORDING ---
    const toggleRecording = () => {
        const r = engineRef.current; if (!r) return;
        if (isRecording) {
            if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') mediaRecorderRef.current.stop();
            setIsRecording(false);
            const w = mountRef.current!.clientWidth; const h = mountRef.current!.clientHeight;
            r.renderer.setSize(w, h); r.camera.aspect = w / h; r.camera.updateProjectionMatrix();
            setStatus("BLACKBOX SECURED");
        } else {
            let targetW = mountRef.current!.clientWidth; let targetH = mountRef.current!.clientHeight; let mbps = 8000000;
            if (recResolution === '1080p') { targetW = 1920; targetH = 1080; } else if (recResolution === '4K') { targetW = 3840; targetH = 2160; } else if (recResolution === '8K') { targetW = 7680; targetH = 4320; }
            if (recQuality === 'ULTRA') mbps *= 4; if (recQuality === 'LOSSLESS') mbps *= 12;

            r.renderer.setSize(targetW, targetH, false); r.camera.aspect = targetW / targetH; r.camera.updateProjectionMatrix();
            chunksRef.current = [];

            try {
                const stream = r.renderer.domElement.captureStream(60);
                let mimeType = 'video/webm; codecs=vp9';
                let extension = 'webm';
                if (recFormat === 'MP4' || recFormat === 'MOV') {
                    if (MediaRecorder.isTypeSupported('video/mp4')) { mimeType = 'video/mp4'; extension = recFormat.toLowerCase(); }
                    else { setStatus("WARN: MP4 UNSUPPORTED, FALLING BACK TO WEBM"); console.warn("MP4/MOV not supported. Fallback to WebM."); }
                }
                const recorder = new MediaRecorder(stream, { mimeType: mimeType, videoBitsPerSecond: mbps });
                recorder.ondataavailable = (e: any) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
                recorder.onstop = () => {
                    const blob = new Blob(chunksRef.current, { type: mimeType });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a'); a.style.display = 'none'; a.href = url; a.download = `CHRONOS_CINEMA_${Date.now()}.${extension}`; document.body.appendChild(a); a.click();
                    setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 100);
                };
                recorder.start(); mediaRecorderRef.current = recorder; setIsRecording(true);
            } catch (err: any) { alert("Recording Failed: " + err.message); setIsRecording(false); }
        }
    };

    // --- VAT EXPORT ---
    const processVATExport = async () => {
        const frames = vatFramesRef.current;
        if (frames.length === 0) { setStatus("VAT FAILED: NO FRAMES"); return; }
        const numFrames = frames.length; const numParticles = simRes * simRes;
        let minX = Infinity, minY = Infinity, minZ = Infinity, maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

        setStatus("CALCULATING BOUNDS...");
        for (let f = 0; f < numFrames; f += 10) {
            const data = frames[f];
            for (let p = 0; p < numParticles; p += 10) {
                const x = data[p * 4]; const y = data[p * 4 + 1]; const z = data[p * 4 + 2];
                if (Math.abs(x) > 500) continue;
                if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y; if (z < minZ) minZ = z; if (z > maxZ) maxZ = z;
            }
            setProcessingProgress(Math.floor((f / numFrames) * 30)); await sleep(5);
        }
        if (minX === Infinity) { minX = -10; maxX = 10; minY = -10; maxY = 10; minZ = -10; maxZ = 10; }
        const sizeX = maxX - minX + 1; const sizeY = maxY - minY + 1; const sizeZ = maxZ - minZ + 1;

        setStatus("GENERATING TEXTURE...");
        const canvas = document.createElement('canvas'); canvas.width = numParticles; canvas.height = numFrames;
        const ctx = canvas.getContext('2d'); if (!ctx) return;
        const imgData = ctx.createImageData(numParticles, numFrames);
        for (let f = 0; f < numFrames; f++) {
            const data = frames[f];
            for (let p = 0; p < numParticles; p++) {
                const idx = (f * numParticles + p) * 4; const dIdx = p * 4;
                imgData.data[idx] = Math.floor(((data[dIdx] - minX) / sizeX) * 255);
                imgData.data[idx + 1] = Math.floor(((data[dIdx + 1] - minY) / sizeY) * 255);
                imgData.data[idx + 2] = Math.floor(((data[dIdx + 2] - minZ) / sizeZ) * 255);
                imgData.data[idx + 3] = 255;
            }
            if (f % 10 === 0) { setProcessingProgress(30 + Math.floor((f / numFrames) * 70)); await sleep(5); }
        }
        ctx.putImageData(imgData, 0, 0);

        const link = document.createElement('a'); link.download = `Chronos_VAT_${Date.now()}.png`; link.href = canvas.toDataURL('image/png'); link.click();
        const json = { frames: numFrames, particles: numParticles, bounds: { min: [minX, minY, minZ], max: [maxX, maxY, maxZ] } };
        const blob = new Blob([JSON.stringify(json)], { type: "application/json" }); const jLink = document.createElement('a'); jLink.href = URL.createObjectURL(blob); jLink.download = `Chronos_VAT_Meta_${Date.now()}.json`; jLink.click();
        setStatus("VAT EXPORT COMPLETE"); setProcessingProgress(0);
    };

    const toggleVATRecording = () => {
        const r = engineRef.current; if (!r) return;
        if (isRecordingVAT) {
            r.isVAT = false; setIsRecordingVAT(false);
            setStatus("PROCESSING VAT...");
            setTimeout(() => processVATExport(), 100);
        } else {
            vatFramesRef.current = []; setVatFramesCaptured(0);
            r.isVAT = true; setIsRecordingVAT(true);
            setStatus("CAPTURING VAT...");
        }
    };

    // --- SEQUENCE EXPORT ---
    const processSequenceExport = async () => {
        const zip = new JSZip(); const frames = vatFramesRef.current; const r = engineRef.current;
        const geoPos = new Float32Array(simRes * simRes * 3);
        const exporter = new GLTFExporter();

        for (let f = 0; f < frames.length; f++) {
            const data = frames[f];
            for (let i = 0; i < simRes * simRes; i++) { geoPos[i * 3] = data[i * 4]; geoPos[i * 3 + 1] = data[i * 4 + 1]; geoPos[i * 3 + 2] = data[i * 4 + 2]; }
            const geo = new THREE.BufferGeometry();
            geo.setAttribute('position', new THREE.BufferAttribute(geoPos, 3));
            const mesh = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xffffff }));
            await new Promise<void>(res => exporter.parse(mesh, (gltf: any) => { zip.file(`frame_${f}.glb`, gltf); res(); }, (err) => console.error(err), { binary: true }));
            setProcessingProgress(Math.floor((f / frames.length) * 100)); if (f % 5 === 0) await sleep(10);
        }
        const content = await zip.generateAsync({ type: "blob" });
        const link = document.createElement('a'); link.href = URL.createObjectURL(content); link.download = `Chronos_Seq_${Date.now()}.zip`; link.click();
        setStatus("SEQUENCE EXPORT COMPLETE"); setProcessingProgress(0);
    };

    const toggleSequenceRecording = () => {
        const r = engineRef.current; if (!r) return;
        if (isRecordingSequence) {
            r.isSequence = false; setIsRecordingSequence(false);
            setStatus("COMPRESSING SEQUENCE...");
            setTimeout(() => processSequenceExport(), 100);
        } else {
            vatFramesRef.current = []; setSequenceFramesCaptured(0);
            r.isSequence = true; setIsRecordingSequence(true);
            setStatus("RECORDING SEQUENCE...");
        }
    };

    return {
        handleCommit,
        toggleRecording,
        toggleVATRecording,
        toggleSequenceRecording
    };
};
