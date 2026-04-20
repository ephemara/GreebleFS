import React, { useState, useRef, useEffect } from 'react';
import { Grid, Sparkles, Save, RefreshCw, Circle, RotateCw, Waves } from 'lucide-react';
import * as THREE from 'three';

export default function KGraphosAlphaTab({ alphas, onAlphaCommit, brush, setBrush, onBrushCommit, ...props }: any) {
    if (!brush) return <div className="p-4 text-red-500">Error: Brush not initialized</div>;
    const [mode, setMode] = useState<'LIBRARY' | 'GENERATE'>('LIBRARY');
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);

    // Generator Params
    const [genType, setGenType] = useState('NOISE');
    const [params, setParams] = useState({
        scale: 5.0,
        detail: 2.0,
        contrast: 1.2,
        brightness: 0.0,
        distortion: 0.0,
        rotation: 0.0,
        power: 1.0, // Gamma/Sharpness
        invert: false,
        seed: 0
    });

    // Generate Alpha Preview
    useEffect(() => {
        if (mode !== 'GENERATE' || !canvasRef.current) return;

        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const w = canvas.width;
        const h = canvas.height;

        // Clear
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, w, h);

        const imgData = ctx.getImageData(0, 0, w, h);
        const data = imgData.data;

        // Helper Functions
        const rotX = (x: number, y: number, a: number) => x * Math.cos(a) - y * Math.sin(a);
        const rotY = (x: number, y: number, a: number) => x * Math.sin(a) + y * Math.cos(a);
        const noise = (x: number, y: number, z: number) => Math.sin(x * params.scale + z) * Math.cos(y * params.scale + z);

        const fbm = (x: number, y: number) => {
            let v = 0;
            let a = 0.5;
            let f = params.scale;
            for (let i = 0; i < Math.floor(params.detail); i++) {
                v += (Math.sin(x * f + params.seed) * Math.cos(y * f + params.seed)) * a;
                f *= 2.0;
                a *= 0.5;
            }
            return v * 0.5 + 0.5;
        };

        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                // Normalize UV
                let u = x / w;
                let v = y / h;

                // Center UV for rotation
                let cu = u - 0.5;
                let cv = v - 0.5;

                // Rotation
                if (params.rotation !== 0) {
                    const r = params.rotation * Math.PI;
                    const ru = rotX(cu, cv, r);
                    const rv = rotY(cu, cv, r);
                    cu = ru; cv = rv;
                }

                // Distortion
                if (params.distortion > 0) {
                    cu += Math.sin(cv * 10.0) * 0.05 * params.distortion;
                    cv += Math.cos(cu * 10.0) * 0.05 * params.distortion;
                }

                u = cu + 0.5;
                v = cv + 0.5;

                let val = 0;

                if (genType === 'NOISE') {
                    val = (Math.sin(u * params.scale * 10 + params.seed) + Math.cos(v * params.scale * 10 + params.seed)) * 0.5 + 0.5;
                    val += (Math.random() - 0.5) * (1 / (params.detail || 1)) * 0.5;
                }
                else if (genType === 'FBM') {
                    val = fbm(u, v);
                }
                else if (genType === 'RADIAL') {
                    const dist = Math.sqrt(cu * cu + cv * cv) * 2.0;
                    val = 1.0 - Math.min(1.0, dist * params.scale);
                    val = Math.pow(val, params.power); // Sharpen falloff
                }
                else if (genType === 'RIPPLE') {
                    const dist = Math.sqrt(cu * cu + cv * cv);
                    val = Math.sin(dist * params.scale * 10.0 - params.seed * 5.0) * 0.5 + 0.5;
                    val *= (1.0 - Math.min(1.0, dist * 2.0)); // Fade out
                }
                else if (genType === 'VORONOI') {
                    const cx = (u * params.scale) % 1;
                    const cy = (v * params.scale) % 1;
                    val = Math.sqrt((cx - 0.5) ** 2 + (cy - 0.5) ** 2);
                    val = 1.0 - val * 2.0; // Invert for cell look
                }
                else if (genType === 'GRID') {
                    const gx = (u * params.scale * 5) % 1;
                    const gy = (v * params.scale * 5) % 1;
                    const line = 0.1 * params.detail;
                    val = (gx < line || gy < line) ? 1.0 : 0.0;
                }
                else if (genType === 'BRICKS') {
                    const aspect = 0.5;
                    const by = Math.floor(v * params.scale * 5);
                    const offset = (by % 2 === 0) ? 0 : 0.5;
                    const bx = (u * params.scale * 5 + offset) % 1;
                    const bgap = 0.1 * params.detail;
                    const bval = (bx < bgap || ((v * params.scale * 5) % 1) < bgap) ? 0.0 : 1.0;
                    val = bval;
                }
                else if (genType === 'SHAPE') {
                    const dx = Math.abs(cu);
                    const dy = Math.abs(cv);
                    // Square vs Circle blend based on detail
                    const circle = Math.sqrt(cu * cu + cv * cv) * 2.0;
                    const square = Math.max(dx, dy) * 2.0;
                    const shape = circle * (1 - params.detail / 10) + square * (params.detail / 10);
                    val = shape < (1.0 / params.scale) ? 1.0 : 0.0;
                }

                // Global Adjustments
                val = Math.pow(val, params.power); // Gamma
                val = (val - 0.5) * params.contrast + 0.5 + params.brightness;
                if (params.invert) val = 1.0 - val;
                val = Math.max(0, Math.min(1, val));

                const idx = (y * w + x) * 4;
                const c = Math.floor(val * 255);
                data[idx] = c;
                data[idx + 1] = c;
                data[idx + 2] = c;
                data[idx + 3] = c; // Alpha based on brightness for transparency
            }
        }

        ctx.putImageData(imgData, 0, 0);
        setPreviewUrl(canvas.toDataURL());

    }, [mode, genType, params]);

    const handleCommit = () => {
        if (!previewUrl || !onAlphaCommit) return;
        const name = `${genType}_${Date.now().toString().slice(-4)}`;
        onAlphaCommit({ name, url: previewUrl });
        setMode('LIBRARY');
    };

    const handleSaveBrush = () => {
        if (!previewUrl || !onBrushCommit) return; // onAlphaCommit check just for safety

        const name = `${genType} Brush`;
        const loader = new THREE.TextureLoader();
        loader.load(previewUrl, (tex) => {
            const newBrush = {
                id: `CUSTOM_${Date.now()}`,
                label: name,
                icon: 'Star', // Use Star icon for custom brushes
                hardness: 0.8,
                flow: 0.5,
                opacity: 1.0,
                alphaMap: tex, // Save the actual texture object
                spacing: 0.1
            };
            if (onBrushCommit) onBrushCommit(newBrush);
        });
    };

    return (
        <div className="flex flex-col h-full gap-4 animate-in slide-in-from-left-4">
            {/* Header / Mode Switch */}
            <div className="flex bg-[#111] p-1 rounded-lg border border-[#222]">
                <button
                    onClick={() => setMode('LIBRARY')}
                    className={`flex-1 py-2 text-[10px] font-bold rounded flex items-center justify-center gap-2 transition-all ${mode === 'LIBRARY' ? 'bg-[#222] text-white shadow-sm' : 'text-gray-500 hover:text-gray-300'}`}
                >
                    <Grid size={12} /> LIBRARY
                </button>
                <button
                    onClick={() => setMode('GENERATE')}
                    className={`flex-1 py-2 text-[10px] font-bold rounded flex items-center justify-center gap-2 transition-all ${mode === 'GENERATE' ? 'bg-rose-900/30 text-rose-400 shadow-sm' : 'text-gray-500 hover:text-gray-300'}`}
                >
                    <Sparkles size={12} /> GENERATOR
                </button>
            </div>

            {/* LIBRARY MODE */}
            {mode === 'LIBRARY' && (
                <div className="flex-1 overflow-y-auto custom-scrollbar">
                    <div className="grid grid-cols-3 gap-2">
                        <button
                            onClick={() => setBrush((b: any) => ({ ...b, alphaMap: null }))}
                            className={`aspect-square rounded-lg border flex flex-col items-center justify-center gap-1 transition-all ${!brush.alphaMap ? 'bg-rose-500 border-rose-400 text-black' : 'bg-[#111] border-[#333] text-gray-500 hover:border-white'}`}
                        >
                            <Circle size={20} fill={!brush.alphaMap ? "black" : "none"} />
                            <span className="text-[8px] font-bold">NONE</span>
                        </button>

                        {alphas && alphas.map((alpha: any, i: number) => (
                            <button
                                key={i}
                                onClick={() => {
                                    const loader = new THREE.TextureLoader();
                                    loader.load(alpha.url, (tex) => {
                                        setBrush((b: any) => ({ ...b, alphaMap: tex }));
                                    });
                                }}
                                className="relative aspect-square rounded-lg border border-[#333] overflow-hidden group hover:border-white transition-all bg-black"
                            >
                                <img src={alpha.preview || alpha.url} className="w-full h-full object-contain opacity-70 group-hover:opacity-100" alt={alpha.name} />
                                <div className="absolute bottom-0 inset-x-0 bg-black/80 p-1 text-[8px] text-white truncate text-center opacity-0 group-hover:opacity-100 transition-opacity">
                                    {alpha.name}
                                </div>
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* GENERATE MODE */}
            {mode === 'GENERATE' && (
                <div className="flex flex-col gap-4 h-full overflow-y-auto custom-scrollbar">
                    {/* Preview */}
                    <div className="aspect-square w-full bg-black border border-[#333] rounded-lg overflow-hidden relative group">
                        <canvas ref={canvasRef} width={256} height={256} className="w-full h-full object-contain" />
                        <div className="absolute inset-0 pointer-events-none border-2 border-[#222] rounded-lg group-hover:border-rose-500/30 transition-colors" />
                    </div>

                    {/* Controls */}
                    <div className="flex flex-col gap-3 bg-[#111] p-3 rounded-lg border border-[#222]">
                        <div className="grid grid-cols-4 gap-1">
                            {['NOISE', 'FBM', 'RADIAL', 'RIPPLE', 'VORONOI', 'GRID', 'BRICKS', 'SHAPE'].map(t => (
                                <button
                                    key={t}
                                    onClick={() => setGenType(t)}
                                    className={`py-2 text-[8px] font-bold rounded border ${genType === t ? 'bg-rose-900/30 border-rose-500 text-rose-400' : 'bg-[#0a0a0a] border-[#222] text-gray-500'}`}
                                >
                                    {t}
                                </button>
                            ))}
                        </div>

                        <div className="space-y-3 mt-2">
                            {/* SCALE & DETAIL */}
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <div className="flex justify-between text-[9px] text-gray-500 font-bold mb-1"><span>SCALE</span><span>{params.scale.toFixed(1)}</span></div>
                                    <input type="range" min="1" max="20" step="0.1" value={params.scale} onChange={e => setParams({ ...params, scale: parseFloat(e.target.value) })} className="w-full h-1 bg-[#222] rounded-lg appearance-none cursor-pointer accent-rose-500" />
                                </div>
                                <div>
                                    <div className="flex justify-between text-[9px] text-gray-500 font-bold mb-1"><span>DETAIL</span><span>{params.detail.toFixed(1)}</span></div>
                                    <input type="range" min="1" max="10" step="0.1" value={params.detail} onChange={e => setParams({ ...params, detail: parseFloat(e.target.value) })} className="w-full h-1 bg-[#222] rounded-lg appearance-none cursor-pointer accent-rose-500" />
                                </div>
                            </div>

                            {/* DISTORTION & ROTATION */}
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <div className="flex justify-between text-[9px] text-gray-500 font-bold mb-1"><span className="flex items-center gap-1"><Waves size={8} /> WARP</span><span>{params.distortion.toFixed(1)}</span></div>
                                    <input type="range" min="0" max="5" step="0.1" value={params.distortion} onChange={e => setParams({ ...params, distortion: parseFloat(e.target.value) })} className="w-full h-1 bg-[#222] rounded-lg appearance-none cursor-pointer accent-rose-500" />
                                </div>
                                <div>
                                    <div className="flex justify-between text-[9px] text-gray-500 font-bold mb-1"><span className="flex items-center gap-1"><RotateCw size={8} /> ROTATE</span><span>{params.rotation.toFixed(1)}</span></div>
                                    <input type="range" min="0" max="2" step="0.01" value={params.rotation} onChange={e => setParams({ ...params, rotation: parseFloat(e.target.value) })} className="w-full h-1 bg-[#222] rounded-lg appearance-none cursor-pointer accent-rose-500" />
                                </div>
                            </div>

                            {/* CONTRAST & POWER */}
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <div className="flex justify-between text-[9px] text-gray-500 font-bold mb-1"><span>CONTRAST</span><span>{params.contrast.toFixed(1)}</span></div>
                                    <input type="range" min="0.5" max="3" step="0.1" value={params.contrast} onChange={e => setParams({ ...params, contrast: parseFloat(e.target.value) })} className="w-full h-1 bg-[#222] rounded-lg appearance-none cursor-pointer accent-rose-500" />
                                </div>
                                <div>
                                    <div className="flex justify-between text-[9px] text-gray-500 font-bold mb-1"><span>SHARPNESS</span><span>{params.power.toFixed(1)}</span></div>
                                    <input type="range" min="0.1" max="5" step="0.1" value={params.power} onChange={e => setParams({ ...params, power: parseFloat(e.target.value) })} className="w-full h-1 bg-[#222] rounded-lg appearance-none cursor-pointer accent-rose-500" />
                                </div>
                            </div>
                        </div>

                        <div className="flex gap-2 mt-2">
                            <button onClick={() => setParams({ ...params, invert: !params.invert })} className={`flex-1 py-2 text-[9px] font-bold rounded border ${params.invert ? 'bg-white text-black border-white' : 'bg-[#0a0a0a] border-[#333] text-gray-500'}`}>
                                INVERT
                            </button>
                            <button onClick={() => setParams({ ...params, seed: Math.random() })} className="flex-1 py-2 text-[9px] font-bold rounded border bg-[#0a0a0a] border-[#333] text-gray-500 hover:text-white hover:border-white flex items-center justify-center gap-2">
                                <RefreshCw size={10} /> RANDOMIZE
                            </button>
                        </div>
                    </div>

                    <div className="flex gap-2">
                        <button
                            onClick={handleCommit}
                            className="flex-1 py-3 bg-[#111] hover:bg-[#222] text-gray-300 font-bold text-[10px] rounded-lg flex items-center justify-center gap-2 border border-[#333] transition-all"
                        >
                            <Save size={14} /> SAVE ALPHA
                        </button>
                        <button
                            onClick={handleSaveBrush}
                            className="flex-1 py-3 bg-rose-600 hover:bg-rose-500 text-white font-bold text-[10px] rounded-lg flex items-center justify-center gap-2 shadow-lg shadow-rose-900/20 transition-all"
                        >
                            <Sparkles size={14} /> SAVE AS BRUSH
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
