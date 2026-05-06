import { useState, useRef, useEffect } from 'react';
import { Sun, Cloud, Sparkles, Check, Download, ChevronRight, ChevronDown } from 'lucide-react';
import { encodeRGBE } from './KAutopbrHDREncoder';

interface KAutopbrHDRProps {
    onApply: (dataUrl: string) => void;
    allowExport?: boolean;
}

export default function KAutopbrHDR({ onApply, allowExport = false }: KAutopbrHDRProps) {
    // Collapsible Sections
    const [openSection, setOpenSection] = useState<'atmosphere' | 'sun' | 'clouds' | null>('atmosphere');

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
        size: 0.05, // Smaller default
        bloom: 2.0,
        color: '#ffffff'
    });

    const [atmosphere, setAtmosphere] = useState({
        stars: 0.0,
        horizonBlur: 0.5,
        horizonHeight: 0.5,
    });

    const [clouds, setClouds] = useState({
        density: 0.0,
        scale: 20.0,
        opacity: 0.5,
        color: '#ffffff'
    });

    const canvasRef = useRef<HTMLCanvasElement>(null);

    // Draw Procedural Skybox
    useEffect(() => {
        if (!canvasRef.current) return;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const w = canvas.width;
        const h = canvas.height;

        // Gradient
        const grad = ctx.createLinearGradient(0, 0, 0, h);
        // Adjust stops based on horizonHeight
        const hH = Math.max(0.1, Math.min(0.9, atmosphere.horizonHeight));
        grad.addColorStop(0, colors.top);
        grad.addColorStop(hH, colors.middle);
        grad.addColorStop(1, colors.bottom);
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, w, h);

        // Stars
        if (atmosphere.stars > 0) {
            // Simple pseudo-random stars (fixed seed by recreating, but here just random is fine as it re-renders on change)
            // To make it stable we would need a seeded random function, but for this preview it's okay if they twinkle on edit.
            // Actually, let's try to keep them stable by seeding? No, complexity.
            const starCount = Math.floor(atmosphere.stars * 1000);
            ctx.fillStyle = '#fff';
            for (let i = 0; i < starCount; i++) {
                const x = Math.random() * w;
                const y = Math.random() * h * hH; // Keep stars above horizon mostly
                const s = Math.random() * 1.2;
                ctx.globalAlpha = Math.random() * 0.8 + 0.2;
                ctx.beginPath();
                ctx.arc(x, y, s, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.globalAlpha = 1.0;
        }

        // Clouds (Noise)
        if (clouds.density > 0) {
            const imgData = ctx.getImageData(0, 0, w, h);
            const data = imgData.data;
            const cloudR = parseInt(clouds.color.slice(1, 3), 16);
            const cloudG = parseInt(clouds.color.slice(3, 5), 16);
            const cloudB = parseInt(clouds.color.slice(5, 7), 16);
            
            for (let y = 0; y < h; y++) {
                if (y > h * hH + 50) continue; // Cutoff below horizon
                for (let x = 0; x < w; x++) {
                    const i = (y * w + x) * 4;
                    // Simple noise approximation
                    const noise = (Math.sin(x / clouds.scale) + Math.sin(y / clouds.scale) + Math.sin((x + y) / (clouds.scale * 0.5))) / 3;
                    if (noise > (1.0 - clouds.density)) {
                        const alpha = (noise - (1.0 - clouds.density)) * clouds.opacity;
                        data[i] = data[i] * (1 - alpha) + cloudR * alpha;
                        data[i+1] = data[i+1] * (1 - alpha) + cloudG * alpha;
                        data[i+2] = data[i+2] * (1 - alpha) + cloudB * alpha;
                    }
                }
            }
            ctx.putImageData(imgData, 0, 0);
        }

        // Sun
        const sunX = (sun.azimuth % 1) * w;
        const sunY = (1.0 - sun.elevation) * h;
        const sunRadius = Math.max(1, sun.size * h); // Minimum 1px

        // Sun Glow (Bloom)
        const bloomRadius = sunRadius * (sun.bloom + 1);
        const glow = ctx.createRadialGradient(sunX, sunY, sunRadius, sunX, sunY, bloomRadius);
        glow.addColorStop(0, sun.color); // Core color
        glow.addColorStop(1, 'rgba(255, 255, 255, 0)');
        ctx.globalAlpha = 0.6 * sun.intensity;
        ctx.fillStyle = glow;
        ctx.fillRect(0, 0, w, h);
        ctx.globalAlpha = 1.0;

        // Sun Core
        ctx.beginPath();
        ctx.arc(sunX, sunY, sunRadius, 0, Math.PI * 2);
        ctx.fillStyle = sun.color; // Use sun color for core too, maybe brighter?
        // White core center
        const core = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, sunRadius);
        core.addColorStop(0, '#fff');
        core.addColorStop(0.8, sun.color);
        ctx.fillStyle = core;
        ctx.fill();

    }, [colors, sun, atmosphere, clouds]);

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

    const SectionHeader = ({ id, label, icon: Icon }: any) => (
        <button 
            onClick={() => setOpenSection(openSection === id ? null : id)}
            className={`w-full flex items-center justify-between p-2 text-[9px] font-bold uppercase tracking-widest border border-[#222] rounded bg-[#111] hover:bg-[#1a1a1a] transition-colors ${openSection === id ? 'text-blue-400 border-blue-900/30' : 'text-gray-500'}`}
        >
            <div className="flex items-center gap-2"><Icon size={10} /> {label}</div>
            {openSection === id ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
        </button>
    );

    return (
        <div className="space-y-2 animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="aspect-[2/1] w-full bg-[#000] rounded border border-[#333] overflow-hidden relative group">
                <canvas ref={canvasRef} width={512} height={256} className="w-full h-full object-cover" />
                <div className="absolute bottom-2 right-2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    {allowExport && <button onClick={handleExport} className="bg-black/50 hover:bg-white hover:text-black text-white p-2 rounded backdrop-blur-sm transition-all" title="Export PNG"><Download size={14} /></button>}
                    <button onClick={handleProceduralApply} className="bg-blue-600 hover:bg-blue-500 text-white p-2 rounded shadow-lg transition-all" title="Apply to Scene"><Check size={14} /></button>
                </div>
            </div>

            {/* ATMOSPHERE */}
            <div className="space-y-1">
                <SectionHeader id="atmosphere" label="Atmosphere" icon={Sparkles} />
                {openSection === 'atmosphere' && (
                    <div className="p-2 bg-[#0e0e0e] border-x border-b border-[#222] rounded-b space-y-2">
                        <div className="flex gap-1">
                            <input type="color" value={colors.top} onChange={e => setColors({ ...colors, top: e.target.value })} className="flex-1 h-4 bg-transparent cursor-pointer rounded overflow-hidden" title="Zenith" />
                            <input type="color" value={colors.middle} onChange={e => setColors({ ...colors, middle: e.target.value })} className="flex-1 h-4 bg-transparent cursor-pointer rounded overflow-hidden" title="Horizon" />
                            <input type="color" value={colors.bottom} onChange={e => setColors({ ...colors, bottom: e.target.value })} className="flex-1 h-4 bg-transparent cursor-pointer rounded overflow-hidden" title="Nadir" />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <div className="flex justify-between text-[8px] text-gray-500 mb-0.5"><span>HORIZON H</span></div>
                                <input type="range" min="0" max="1" step="0.01" value={atmosphere.horizonHeight} onChange={e => setAtmosphere({ ...atmosphere, horizonHeight: parseFloat(e.target.value) })} className="w-full h-1 bg-[#222] rounded appearance-none accent-blue-500" />
                            </div>
                            <div>
                                <div className="flex justify-between text-[8px] text-gray-500 mb-0.5"><span>BLUR</span></div>
                                <input type="range" min="0" max="1" step="0.01" value={atmosphere.horizonBlur} onChange={e => setAtmosphere({ ...atmosphere, horizonBlur: parseFloat(e.target.value) })} className="w-full h-1 bg-[#222] rounded appearance-none accent-blue-500" />
                            </div>
                            <div className="col-span-2">
                                <div className="flex justify-between text-[8px] text-gray-500 mb-0.5"><span>STARS DENSITY</span></div>
                                <input type="range" min="0" max="1" step="0.01" value={atmosphere.stars} onChange={e => setAtmosphere({ ...atmosphere, stars: parseFloat(e.target.value) })} className="w-full h-1 bg-[#222] rounded appearance-none accent-white" />
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* SUN */}
            <div className="space-y-1">
                <SectionHeader id="sun" label="Solar Body" icon={Sun} />
                {openSection === 'sun' && (
                    <div className="p-2 bg-[#0e0e0e] border-x border-b border-[#222] rounded-b space-y-2">
                         <div className="flex gap-2 items-center">
                            <input type="color" value={sun.color} onChange={e => setSun({ ...sun, color: e.target.value })} className="w-6 h-4 bg-transparent cursor-pointer rounded overflow-hidden" />
                            <input type="range" min="0" max="5" step="0.1" value={sun.intensity} onChange={e => setSun({ ...sun, intensity: parseFloat(e.target.value) })} className="flex-1 h-1 bg-[#222] rounded appearance-none accent-yellow-500" title="Intensity" />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <div className="flex justify-between text-[8px] text-gray-500 mb-0.5"><span>AZIMUTH</span></div>
                                <input type="range" min="0" max="1" step="0.01" value={sun.azimuth} onChange={e => setSun({ ...sun, azimuth: parseFloat(e.target.value) })} className="w-full h-1 bg-[#222] rounded appearance-none accent-yellow-500" />
                            </div>
                            <div>
                                <div className="flex justify-between text-[8px] text-gray-500 mb-0.5"><span>ELEVATION</span></div>
                                <input type="range" min="0" max="1" step="0.01" value={sun.elevation} onChange={e => setSun({ ...sun, elevation: parseFloat(e.target.value) })} className="w-full h-1 bg-[#222] rounded appearance-none accent-orange-500" />
                            </div>
                            <div>
                                <div className="flex justify-between text-[8px] text-gray-500 mb-0.5"><span>SIZE</span></div>
                                <input type="range" min="0.01" max="0.5" step="0.01" value={sun.size} onChange={e => setSun({ ...sun, size: parseFloat(e.target.value) })} className="w-full h-1 bg-[#222] rounded appearance-none accent-yellow-500" />
                            </div>
                            <div>
                                <div className="flex justify-between text-[8px] text-gray-500 mb-0.5"><span>BLOOM</span></div>
                                <input type="range" min="0" max="10" step="0.1" value={sun.bloom} onChange={e => setSun({ ...sun, bloom: parseFloat(e.target.value) })} className="w-full h-1 bg-[#222] rounded appearance-none accent-orange-500" />
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* CLOUDS */}
            <div className="space-y-1">
                <SectionHeader id="clouds" label="Clouds (Noise)" icon={Cloud} />
                {openSection === 'clouds' && (
                    <div className="p-2 bg-[#0e0e0e] border-x border-b border-[#222] rounded-b space-y-2">
                         <div className="flex gap-2 items-center">
                            <input type="color" value={clouds.color} onChange={e => setClouds({ ...clouds, color: e.target.value })} className="w-6 h-4 bg-transparent cursor-pointer rounded overflow-hidden" />
                            <div className="text-[8px] text-gray-500">CLOUD TINT</div>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <div className="flex justify-between text-[8px] text-gray-500 mb-0.5"><span>DENSITY</span></div>
                                <input type="range" min="0" max="1" step="0.01" value={clouds.density} onChange={e => setClouds({ ...clouds, density: parseFloat(e.target.value) })} className="w-full h-1 bg-[#222] rounded appearance-none accent-gray-400" />
                            </div>
                            <div>
                                <div className="flex justify-between text-[8px] text-gray-500 mb-0.5"><span>OPACITY</span></div>
                                <input type="range" min="0" max="1" step="0.01" value={clouds.opacity} onChange={e => setClouds({ ...clouds, opacity: parseFloat(e.target.value) })} className="w-full h-1 bg-[#222] rounded appearance-none accent-gray-400" />
                            </div>
                             <div>
                                <div className="flex justify-between text-[8px] text-gray-500 mb-0.5"><span>SCALE</span></div>
                                <input type="range" min="5" max="100" step="1" value={clouds.scale} onChange={e => setClouds({ ...clouds, scale: parseFloat(e.target.value) })} className="w-full h-1 bg-[#222] rounded appearance-none accent-gray-400" />
                            </div>
                        </div>
                    </div>
                )}
            </div>

        </div>
    );
}
