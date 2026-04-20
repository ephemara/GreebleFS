import React, { useState, useEffect, useRef } from 'react';
import { Palette, Layers, Sparkles, Zap, Circle, Wand2 } from 'lucide-react';
import { processImage } from '../autopbr/KAutopbrEngine';
import * as THREE from 'three';

export default function KGraphosMaterialDock({
    projectMaterials,
    activeMaterial,
    setActiveMaterial,
    channels = { albedo: true, normal: false, roughness: false, metalness: false, emission: false },
    setChannels,
    brush,
    engineRef,
    onMaterialCommit
}: any) {
    const [materialParams, setMaterialParams] = useState({
        roughnessRange: [0.2, 0.8],
        metallicIntensity: 1.0,
        normalStrength: 1.0,
        emissionIntensity: 1.0
    });

    const channelList = [
        { id: 'albedo', label: 'Albedo', icon: Palette, color: 'rose' },
        { id: 'normal', label: 'Normal', icon: Layers, color: 'blue' },
        { id: 'roughness', label: 'Roughness', icon: Circle, color: 'green' },
        { id: 'metalness', label: 'Metallic', icon: Zap, color: 'yellow' },
        { id: 'emission', label: 'Emission', icon: Sparkles, color: 'purple' }
    ];

    const presetMaterials = [
        { id: 'metal', name: 'Metal', channels: { albedo: true, roughness: true, metalness: true, normal: false, emission: false } },
        { id: 'wood', name: 'Wood', channels: { albedo: true, normal: true, roughness: true, metalness: false, emission: false } },
        { id: 'plastic', name: 'Plastic', channels: { albedo: true, roughness: true, metalness: false, normal: false, emission: false } },
        { id: 'stone', name: 'Stone', channels: { albedo: true, normal: true, roughness: true, metalness: false, emission: false } },
        { id: 'glow', name: 'Glow', channels: { albedo: true, emission: true, roughness: false, metalness: false, normal: false } }
    ];

    const [isGenerating, setIsGenerating] = useState(false);
    const [showFlux, setShowFlux] = useState(false);
    const previewCanvasRef = useRef<HTMLCanvasElement>(null);

    const [fluxParams, setFluxParams] = useState({
        normalStrength: 0.03,
        roughnessContrast: 1.2,
        noise: 0.0,
        scratches: 0.0,
        dust: 0.0,
        wear: 0.0
    });

    // 3D Sphere Preview
    useEffect(() => {
        if (!previewCanvasRef.current || !activeMaterial) return;

        const canvas = previewCanvasRef.current;
        const w = canvas.clientWidth;
        const h = canvas.clientHeight;

        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 100);
        camera.position.z = 2.5;

        const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
        renderer.setSize(w, h);
        renderer.toneMapping = THREE.ACESFilmicToneMapping;

        const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
        scene.add(ambientLight);
        const dirLight = new THREE.DirectionalLight(0xffffff, 1.5);
        dirLight.position.set(5, 5, 5);
        scene.add(dirLight);
        const rimLight = new THREE.PointLight(0x3b82f6, 2.0, 20);
        rimLight.position.set(-5, 2, -5);
        scene.add(rimLight);

        const geometry = new THREE.SphereGeometry(1, 64, 64);
        const material = new THREE.MeshStandardMaterial({ roughness: 0.5, metalness: 0.0 });

        const loader = new THREE.TextureLoader();
        if (activeMaterial.base) {
            const baseMap = loader.load(activeMaterial.base);
            baseMap.colorSpace = THREE.SRGBColorSpace;
            material.map = baseMap;
        }
        if (activeMaterial.normal) {
            const normalMap = loader.load(activeMaterial.normal);
            normalMap.colorSpace = THREE.LinearSRGBColorSpace;
            material.normalMap = normalMap;
        }
        if (activeMaterial.roughness) {
            const roughMap = loader.load(activeMaterial.roughness);
            roughMap.colorSpace = THREE.LinearSRGBColorSpace;
            material.roughnessMap = roughMap;
        }
        if (activeMaterial.metallic) {
            const metalMap = loader.load(activeMaterial.metallic);
            metalMap.colorSpace = THREE.LinearSRGBColorSpace;
            material.metalnessMap = metalMap;
        }

        const sphere = new THREE.Mesh(geometry, material);
        scene.add(sphere);

        let frame = 0;
        const animate = () => {
            frame = requestAnimationFrame(animate);
            sphere.rotation.y += 0.005;
            renderer.render(scene, camera);
        };
        animate();

        return () => {
            cancelAnimationFrame(frame);
            renderer.dispose();
            geometry.dispose();
            material.dispose();
        };
    }, [activeMaterial]);

    const handleCreateFromColor = async () => {
        if (!brush?.color || !onMaterialCommit) return;
        setIsGenerating(true);

        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 512;
        const ctx = canvas.getContext('2d');
        if (ctx) {
            ctx.fillStyle = brush.color;
            ctx.fillRect(0, 0, 512, 512);

            const img = new Image();
            img.onload = () => {
                const params = {
                    normalStrength: fluxParams.normalStrength,
                    roughnessContrast: fluxParams.roughnessContrast,
                    roughnessBrightness: 0,
                    roughnessInvert: true,
                    metalContrast: 1.0,
                    metalBias: -50,
                    aoIntensity: 1.0,
                    heightContrast: 1.0,
                    makeSeamless: false,
                    dust: fluxParams.dust,
                    grunge: 0.0,
                    scratches: fluxParams.scratches,
                    edgeFry: 0.0,
                    hue: 0,
                    scale: 1.0,
                    cyberDetail: 0.0,
                    bioDetail: 0.0,
                    decalCount: 0.0,
                    noise: fluxParams.noise,
                    scanlines: 0.0,
                    pixelate: 0.0,
                    chromatic: 0.0,
                    wear: fluxParams.wear
                };

                const base = processImage(img, null, 'base', params);
                const normal = processImage(img, null, 'normal', params);
                const rough = processImage(img, null, 'roughness', params);
                const metal = processImage(img, null, 'metallic', params);

                if (base && normal && rough && metal) {
                    onMaterialCommit({
                        base,
                        normal,
                        roughness: rough,
                        metallic: metal,
                        preview: base,
                        name: `Color_${brush.color.substring(1)}`
                    });
                }
                setIsGenerating(false);
            };
            img.src = canvas.toDataURL();
        }
    };

    const handleCreateFromCanvas = async () => {
        if (!engineRef?.current || !onMaterialCommit) {
            console.error("MaterialDock: Engine or onMaterialCommit missing");
            return;
        }
        setIsGenerating(true);

        try {
            const r = engineRef.current;
            if (!r || !r.canvas) {
                console.error('MaterialDock: Engine or canvas not ready');
                setIsGenerating(false);
                return;
            }

            // Force a render to ensure the canvas is up to date
            r.render();

            const canvasDataUrl = r.canvas.toDataURL('image/png');
            console.log("MaterialDock: Captured canvas data, processing...");

            const img = new Image();
            img.onload = () => {
                console.log("MaterialDock: Image loaded, running AutoPBR...");
                const params = {
                    normalStrength: 0.05, // Slightly stronger for canvas capture
                    roughnessContrast: 1.2,
                    roughnessBrightness: 0,
                    roughnessInvert: true,
                    metalContrast: 1.0,
                    metalBias: -30,
                    aoIntensity: 1.0,
                    heightContrast: 1.0,
                    makeSeamless: false,
                    dust: 0.0,
                    grunge: 0.0,
                    scratches: 0.0,
                    edgeFry: 0.0,
                    hue: 0,
                    scale: 1.0,
                    cyberDetail: 0.0,
                    bioDetail: 0.0,
                    decalCount: 0.0,
                    noise: 0.0,
                    scanlines: 0.0,
                    pixelate: 0.0,
                    chromatic: 0.0,
                    wear: 0.0
                };

                try {
                    const base = processImage(img, null, 'base', params);
                    const normal = processImage(img, null, 'normal', params);
                    const rough = processImage(img, null, 'roughness', params);
                    const metal = processImage(img, null, 'metallic', params);

                    if (base && normal && rough && metal) {
                        console.log("MaterialDock: Material generated successfully");
                        onMaterialCommit({
                            base,
                            normal,
                            roughness: rough,
                            metallic: metal,
                            preview: base,
                            name: `Canvas_${Date.now().toString().slice(-4)}`
                        });
                    } else {
                        console.error("MaterialDock: Failed to generate one or more maps");
                    }
                } catch (err) {
                    console.error("MaterialDock: Error in processImage", err);
                }
                setIsGenerating(false);
            };
            img.onerror = (e) => {
                console.error('MaterialDock: Failed to load canvas image', e);
                setIsGenerating(false);
            };
            img.src = canvasDataUrl;
        } catch (e) {
            console.error('MaterialDock: Failed to generate material:', e);
            setIsGenerating(false);
        }
    };

    return (
        <div className="flex flex-col h-full gap-4 p-4 bg-[#0a0a0a] overflow-y-auto">
            <div className="flex flex-col gap-2">
                <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Material Library</div>
                <div className="grid grid-cols-3 gap-2 max-h-[200px] overflow-y-auto">
                    {projectMaterials && projectMaterials.map((mat: any) => (
                        <button key={mat.id} onClick={() => setActiveMaterial(mat)} className={`relative aspect-square rounded-lg border overflow-hidden transition-all ${activeMaterial?.id === mat.id ? 'border-rose-500 ring-2 ring-rose-500/50 scale-95' : 'border-[#333] hover:border-white hover:scale-95'}`} title={mat.name}>
                            <img src={mat.preview} className="w-full h-full object-cover" alt={mat.name} />
                            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent p-1">
                                <div className="text-[8px] font-bold text-white truncate">{mat.name}</div>
                            </div>
                        </button>
                    ))}
                    {(!projectMaterials || projectMaterials.length === 0) && (
                        <div className="col-span-3 text-[9px] text-gray-600 text-center py-4 italic border border-dashed border-[#222] rounded">No PBR Materials</div>
                    )}
                </div>
            </div>

            {activeMaterial && (
                <div className="flex flex-col gap-2">
                    <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Material Preview</div>
                    <div className="relative aspect-square rounded-lg border border-rose-900/30 bg-[#050505] overflow-hidden">
                        <canvas ref={previewCanvasRef} className="w-full h-full" />
                        <div className="absolute bottom-2 left-2 right-2 bg-black/80 backdrop-blur-sm rounded px-2 py-1">
                            <div className="text-[8px] font-bold text-rose-400 truncate">{activeMaterial.name}</div>
                        </div>
                    </div>
                </div>
            )}

            <div className="flex flex-col gap-2 border-t border-[#222] pt-4">
                <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">🔥 Create Material</div>
                <div className="grid grid-cols-1 gap-2">
                    <button onClick={handleCreateFromColor} disabled={isGenerating || !brush?.color} className="flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-[#333] bg-[#111] hover:bg-gradient-to-r hover:from-rose-900/20 hover:to-purple-900/20 hover:border-rose-500/50 text-gray-400 hover:text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                        <Palette size={14} />
                        <span className="text-[10px] font-bold">{isGenerating ? 'GENERATING...' : 'FROM PAINT COLOR'}</span>
                    </button>

                    <button onClick={() => setShowFlux(!showFlux)} className="text-[8px] text-gray-500 hover:text-rose-400 transition-all font-bold">
                        {showFlux ? '▼' : '▶'} FLUX ENGINE
                    </button>

                    {showFlux && (
                        <div className="flex flex-col gap-2 p-2 bg-[#050505] rounded-lg border border-rose-900/30">
                            <div className="flex flex-col gap-1">
                                <div className="flex justify-between text-[8px]"><span className="text-gray-500">NORMAL</span><span className="text-white font-mono">{fluxParams.normalStrength.toFixed(2)}</span></div>
                                <input type="range" min="0" max="0.2" step="0.01" value={fluxParams.normalStrength} onChange={(e) => setFluxParams({ ...fluxParams, normalStrength: parseFloat(e.target.value) })} className="w-full h-1 bg-[#222] rounded appearance-none cursor-pointer accent-blue-500" />
                            </div>
                            <div className="flex flex-col gap-1">
                                <div className="flex justify-between text-[8px]"><span className="text-gray-500">ROUGHNESS</span><span className="text-white font-mono">{fluxParams.roughnessContrast.toFixed(1)}</span></div>
                                <input type="range" min="0.5" max="2" step="0.1" value={fluxParams.roughnessContrast} onChange={(e) => setFluxParams({ ...fluxParams, roughnessContrast: parseFloat(e.target.value) })} className="w-full h-1 bg-[#222] rounded appearance-none cursor-pointer accent-green-500" />
                            </div>
                            <div className="flex flex-col gap-1">
                                <div className="flex justify-between text-[8px]"><span className="text-gray-500">NOISE</span><span className="text-white font-mono">{(fluxParams.noise * 100).toFixed(0)}%</span></div>
                                <input type="range" min="0" max="1" step="0.05" value={fluxParams.noise} onChange={(e) => setFluxParams({ ...fluxParams, noise: parseFloat(e.target.value) })} className="w-full h-1 bg-[#222] rounded appearance-none cursor-pointer accent-purple-500" />
                            </div>
                            <div className="flex flex-col gap-1">
                                <div className="flex justify-between text-[8px]"><span className="text-gray-500">SCRATCHES</span><span className="text-white font-mono">{(fluxParams.scratches * 100).toFixed(0)}%</span></div>
                                <input type="range" min="0" max="1" step="0.05" value={fluxParams.scratches} onChange={(e) => setFluxParams({ ...fluxParams, scratches: parseFloat(e.target.value) })} className="w-full h-1 bg-[#222] rounded appearance-none cursor-pointer accent-orange-500" />
                            </div>
                            <div className="flex flex-col gap-1">
                                <div className="flex justify-between text-[8px]"><span className="text-gray-500">DUST</span><span className="text-white font-mono">{(fluxParams.dust * 100).toFixed(0)}%</span></div>
                                <input type="range" min="0" max="1" step="0.05" value={fluxParams.dust} onChange={(e) => setFluxParams({ ...fluxParams, dust: parseFloat(e.target.value) })} className="w-full h-1 bg-[#222] rounded appearance-none cursor-pointer accent-yellow-500" />
                            </div>
                            <div className="flex flex-col gap-1">
                                <div className="flex justify-between text-[8px]"><span className="text-gray-500">WEAR</span><span className="text-white font-mono">{(fluxParams.wear * 100).toFixed(0)}%</span></div>
                                <input type="range" min="0" max="1" step="0.05" value={fluxParams.wear} onChange={(e) => setFluxParams({ ...fluxParams, wear: parseFloat(e.target.value) })} className="w-full h-1 bg-[#222] rounded appearance-none cursor-pointer accent-red-500" />
                            </div>
                        </div>
                    )}

                    <button onClick={handleCreateFromCanvas} disabled={isGenerating || !engineRef?.current} className="flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-[#333] bg-[#111] hover:bg-gradient-to-r hover:from-blue-900/20 hover:to-cyan-900/20 hover:border-blue-500/50 text-gray-400 hover:text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                        <Wand2 size={14} />
                        <span className="text-[10px] font-bold">{isGenerating ? 'GENERATING...' : 'FROM CANVAS'}</span>
                    </button>
                </div>
            </div>

            <div className="flex flex-col gap-2">
                <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Paint Channels</div>
                <div className="grid grid-cols-1 gap-2">
                    {channelList.map(channel => {
                        const Icon = channel.icon;
                        const isActive = channels[channel.id];
                        return (
                            <button key={channel.id} onClick={() => setChannels({ ...channels, [channel.id]: !isActive })} className={`flex items-center justify-between px-3 py-2 rounded-lg border transition-all ${isActive ? `bg-${channel.color}-900/30 border-${channel.color}-500 text-${channel.color}-400` : 'bg-[#111] border-[#333] text-gray-500 hover:border-white'}`}>
                                <div className="flex items-center gap-2">
                                    <Icon size={14} />
                                    <span className="text-[10px] font-bold">{channel.label}</span>
                                </div>
                                <div className={`w-3 h-3 rounded-full border-2 transition-all ${isActive ? `bg-${channel.color}-500 border-${channel.color}-400` : 'border-gray-600'}`} />
                            </button>
                        );
                    })}
                </div>
            </div>

            <div className="flex flex-col gap-2">
                <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Quick Presets</div>
                <div className="grid grid-cols-2 gap-2">
                    {presetMaterials.map(preset => (
                        <button key={preset.id} onClick={() => setChannels(preset.channels)} className="px-3 py-2 text-[9px] font-bold rounded-lg border border-[#333] bg-[#111] hover:border-white hover:bg-[#1a1a1a] text-gray-400 hover:text-white transition-all">
                            {preset.name.toUpperCase()}
                        </button>
                    ))}
                </div>
            </div>

            <div className="flex flex-col gap-3 border-t border-[#222] pt-4">
                <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Material Properties</div>
                <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                        <span className="text-[9px] text-gray-500">Normal Strength</span>
                        <span className="text-[9px] text-white font-mono">{materialParams.normalStrength.toFixed(2)}</span>
                    </div>
                    <input type="range" min="0" max="2" step="0.1" value={materialParams.normalStrength} onChange={(e) => setMaterialParams({ ...materialParams, normalStrength: parseFloat(e.target.value) })} className="w-full h-1 bg-[#222] rounded-lg appearance-none cursor-pointer accent-blue-500" />
                </div>
                <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                        <span className="text-[9px] text-gray-500">Metallic Intensity</span>
                        <span className="text-[9px] text-white font-mono">{materialParams.metallicIntensity.toFixed(2)}</span>
                    </div>
                    <input type="range" min="0" max="1" step="0.05" value={materialParams.metallicIntensity} onChange={(e) => setMaterialParams({ ...materialParams, metallicIntensity: parseFloat(e.target.value) })} className="w-full h-1 bg-[#222] rounded-lg appearance-none cursor-pointer accent-yellow-500" />
                </div>
            </div>

            <div className="mt-auto pt-4 border-t border-[#222]">
                <div className="bg-gradient-to-br from-rose-900/20 to-purple-900/20 border border-rose-500/30 rounded-lg p-3">
                    <div className="text-[8px] font-bold text-rose-400 uppercase tracking-widest mb-1">🔥 PBR Painter Mode Active</div>
                    <div className="text-[7px] text-gray-400 leading-relaxed">Paint with physically-based materials across multiple channels simultaneously.</div>
                </div>
            </div>
        </div>
    );
}
