import React, { useState, useRef, useEffect } from 'react';
import { Sun, Cloud, Sparkles, Loader2, RefreshCw, Check, Download, Star, Wind } from 'lucide-react';
import { generateAITexture } from './KAutopbrEngine';
import { encodeRGBE } from './KAutopbrHDREncoder';

interface KAutopbrHDRProps {
    onApply: (dataUrl: string) => void;
}

export default function KAutopbrHDR({ onApply }: KAutopbrHDRProps) {
    const [mode, setMode] = useState<'procedural' | 'ai'>('procedural');
    const [generating, setGenerating] = useState(false);

    // Procedural State
    const [colors, setColors] = useState({
        top: '#0f172a',
        middle: '#3b82f6',
        bottom: '#64748b'
    });
    const [sun, setSun] = useState({
        azimuth: 0.2,
        elevation: 0.4,
        intensity: 1.0,
        size: 0.1,
        color: '#ffffff'
    });
    const [atmosphere, setAtmosphere] = useState({
        stars: 0.0,
        noise: 0.0,
        horizonBlur: 0.5
    });

    // AI State
    const [prompt, setPrompt] = useState('');
    const [aiResult, setAiResult] = useState<string | null>(null);

    const canvasRef = useRef<HTMLCanvasElement>(null);

    // Draw Procedural Skybox
    useEffect(() => {
        if (mode !== 'procedural' || !canvasRef.current) return;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const w = canvas.width;
        const h = canvas.height;

        // Gradient
        const grad = ctx.createLinearGradient(0, 0, 0, h);
        grad.addColorStop(0, colors.top);
        grad.addColorStop(atmosphere.horizonBlur, colors.middle);
        grad.addColorStop(1, colors.bottom);
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, w, h);

        // Stars
        if (atmosphere.stars > 0) {
            const starCount = Math.floor(atmosphere.stars * 500);
            ctx.fillStyle = '#fff';
            for (let i = 0; i < starCount; i++) {
                const x = Math.random() * w;
                const y = Math.random() * h * 0.6; // Keep stars mostly in sky
                const s = Math.random() * 1.5;
                ctx.globalAlpha = Math.random() * 0.8 + 0.2;
                ctx.beginPath();
                ctx.arc(x, y, s, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.globalAlpha = 1.0;
        }

        // Noise/Clouds (Simple)
        if (atmosphere.noise > 0) {
            const imgData = ctx.getImageData(0, 0, w, h);
            const data = imgData.data;
            for (let i = 0; i < data.length; i += 4) {
                if (Math.random() < atmosphere.noise * 0.1) {
                    const v = Math.random() * 50;
                    data[i] = Math.min(255, data[i] + v);
                    data[i + 1] = Math.min(255, data[i + 1] + v);
                    data[i + 2] = Math.min(255, data[i + 2] + v);
                }
            }
            ctx.putImageData(imgData, 0, 0);
        }

        // Sun
        const sunX = (sun.azimuth % 1) * w;
        const sunY = (1.0 - sun.elevation) * h;
        const sunRadius = sun.size * h;

        // Sun Glow
        const glow = ctx.createRadialGradient(sunX, sunY, sunRadius * 0.5, sunX, sunY, sunRadius * 4);
        glow.addColorStop(0, sun.color); // Use sun color
        glow.addColorStop(1, 'rgba(255, 255, 255, 0)');
        ctx.fillStyle = glow;
        ctx.fillRect(0, 0, w, h);

        // Sun Core
        ctx.beginPath();
        ctx.arc(sunX, sunY, sunRadius, 0, Math.PI * 2);
        ctx.fillStyle = '#fff';
        ctx.fill();

    }, [colors, sun, atmosphere, mode]);

    const handleProceduralApply = () => {
        if (!canvasRef.current) return;
        onApply(canvasRef.current.toDataURL('image/png'));
    };

    const handleExport = () => {
        if (!canvasRef.current) return;
        const ctx = canvasRef.current.getContext('2d');
        if (!ctx) return;

        const imageData = ctx.getImageData(0, 0, canvasRef.current.width, canvasRef.current.height);
        const hdrBlob = encodeRGBE(imageData);

        const link = document.createElement('a');
        link.download = 'k_autopbr_skybox.hdr';
        link.href = URL.createObjectURL(hdrBlob);
        link.click();
        URL.revokeObjectURL(link.href);
    };

    const handleAIGenerate = async () => {
        if (!prompt) return;
        setGenerating(true);
        const res = await generateAITexture(`hdri skybox, equirectangular projection, 360 panorama, ${prompt}`);
        if (res) {
            setAiResult(res);
        }
        setGenerating(false);
    };

    const handleAIApply = () => {
        if (aiResult) onApply(aiResult);
    };

    const handleAIExport = () => {
        if (!aiResult) return;

        const img = new Image();
        img.src = aiResult;
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            if (!ctx) return;

            ctx.drawImage(img, 0, 0);
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const hdrBlob = encodeRGBE(imageData);

            const link = document.createElement('a');
            link.download = 'k_autopbr_ai_skybox.hdr';
            link.href = URL.createObjectURL(hdrBlob);
            link.click();
            URL.revokeObjectURL(link.href);
        };
    };

    return (
        <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="flex bg-[#111] p-1 rounded border border-[#222]">
                <button onClick={() => setMode('procedural')} className={`flex-1 py-2 text-[10px] font-bold rounded transition-all flex items-center justify-center gap-2 ${mode === 'procedural' ? 'bg-blue-900/30 text-blue-400' : 'text-gray-500 hover:text-white'}`}>
                    <Sun size={14} /> PROCEDURAL
                </button>
                <button onClick={() => setMode('ai')} className={`flex-1 py-2 text-[10px] font-bold rounded transition-all flex items-center justify-center gap-2 ${mode === 'ai' ? 'bg-purple-900/30 text-purple-400' : 'text-gray-500 hover:text-white'}`}>
                    <Sparkles size={14} /> AI DREAM
                </button>
            </div>

            {mode === 'procedural' && (
                <div className="space-y-4">
                    <div className="aspect-[2/1] w-full bg-[#000] rounded border border-[#333] overflow-hidden relative group">
                        <canvas ref={canvasRef} width={512} height={256} className="w-full h-full object-cover" />
                        <div className="absolute bottom-2 right-2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={handleExport} className="bg-black/50 hover:bg-white hover:text-black text-white p-2 rounded backdrop-blur-sm transition-all" title="Export PNG"><Download size={14} /></button>
                            <button onClick={handleProceduralApply} className="bg-blue-600 hover:bg-blue-500 text-white p-2 rounded shadow-lg transition-all" title="Apply to Scene"><Check size={14} /></button>
                        </div>
                    </div>

                    <div className="p-3 bg-[#111] rounded border border-[#222] space-y-3">
                        <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2"><Sun size={12} /> Atmosphere</div>
                        <div className="flex gap-2">
                            <input type="color" value={colors.top} onChange={e => setColors({ ...colors, top: e.target.value })} className="flex-1 h-6 bg-transparent cursor-pointer rounded overflow-hidden" title="Zenith" />
                            <input type="color" value={colors.middle} onChange={e => setColors({ ...colors, middle: e.target.value })} className="flex-1 h-6 bg-transparent cursor-pointer rounded overflow-hidden" title="Horizon" />
                            <input type="color" value={colors.bottom} onChange={e => setColors({ ...colors, bottom: e.target.value })} className="flex-1 h-6 bg-transparent cursor-pointer rounded overflow-hidden" title="Nadir" />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <div className="flex justify-between text-[9px] text-gray-500 mb-1"><span>STARS</span></div>
                                <input type="range" min="0" max="1" step="0.01" value={atmosphere.stars} onChange={e => setAtmosphere({ ...atmosphere, stars: parseFloat(e.target.value) })} className="w-full h-1.5 bg-[#222] rounded appearance-none accent-white" />
                            </div>
                            <div>
                                <div className="flex justify-between text-[9px] text-gray-500 mb-1"><span>NOISE</span></div>
                                <input type="range" min="0" max="1" step="0.01" value={atmosphere.noise} onChange={e => setAtmosphere({ ...atmosphere, noise: parseFloat(e.target.value) })} className="w-full h-1.5 bg-[#222] rounded appearance-none accent-gray-400" />
                            </div>
                        </div>
                    </div>

                    <div className="p-3 bg-[#111] rounded border border-[#222] space-y-3">
                        <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2"><Sun size={12} /> Sun</div>
                        <div className="flex gap-3 items-center">
                            <input type="color" value={sun.color} onChange={e => setSun({ ...sun, color: e.target.value })} className="w-10 h-6 bg-transparent cursor-pointer rounded overflow-hidden" />
                            <input type="range" min="0" max="2" step="0.1" value={sun.intensity} onChange={e => setSun({ ...sun, intensity: parseFloat(e.target.value) })} className="flex-1 h-1.5 bg-[#222] rounded appearance-none accent-yellow-500" title="Intensity" />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <div className="flex justify-between text-[9px] text-gray-500 mb-1"><span>AZIMUTH</span></div>
                                <input type="range" min="0" max="1" step="0.01" value={sun.azimuth} onChange={e => setSun({ ...sun, azimuth: parseFloat(e.target.value) })} className="w-full h-1.5 bg-[#222] rounded appearance-none accent-yellow-500" />
                            </div>
                            <div>
                                <div className="flex justify-between text-[9px] text-gray-500 mb-1"><span>ELEVATION</span></div>
                                <input type="range" min="0" max="1" step="0.01" value={sun.elevation} onChange={e => setSun({ ...sun, elevation: parseFloat(e.target.value) })} className="w-full h-1.5 bg-[#222] rounded appearance-none accent-orange-500" />
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {mode === 'ai' && (
                <div className="space-y-2">
                    <div className="aspect-[2/1] w-full bg-[#000] rounded border border-[#333] overflow-hidden relative flex items-center justify-center group">
                        {aiResult ? (
                            <img src={aiResult} className="w-full h-full object-cover" />
                        ) : (
                            <div className="text-center p-4">
                                <Cloud className="w-6 h-6 text-gray-700 mx-auto mb-2" />
                                <p className="text-[8px] text-gray-600">AI Generated Skybox</p>
                            </div>
                        )}
                        {aiResult && (
                            <div className="absolute bottom-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onClick={handleAIExport} className="bg-black/50 hover:bg-white hover:text-black text-white p-1.5 rounded backdrop-blur-sm transition-all" title="Export PNG"><Download size={12} /></button>
                                <button onClick={handleAIApply} className="bg-purple-600 hover:bg-purple-500 text-white p-1.5 rounded shadow-lg transition-all"><Check size={12} /></button>
                            </div>
                        )}
                        {generating && <div className="absolute inset-0 bg-black/50 flex items-center justify-center"><Loader2 className="animate-spin text-purple-500" /></div>}
                    </div>

                    <div className="flex gap-1">
                        <input
                            type="text"
                            placeholder="Describe skybox..."
                            className="flex-1 bg-[#111] border border-[#333] rounded px-2 py-1.5 text-[9px] text-white focus:border-purple-500 outline-none transition-all"
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleAIGenerate()}
                        />
                        <button onClick={handleAIGenerate} disabled={generating || !prompt} className="bg-[#1a1a1a] hover:bg-purple-900/30 text-gray-400 hover:text-purple-400 border border-[#333] hover:border-purple-500/50 px-2 rounded transition-all disabled:opacity-50">
                            <Sparkles size={12} />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
