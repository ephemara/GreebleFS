
import React from 'react';
import {
    Stethoscope, Library, BookTemplate, Sliders, Zap,
    Crosshair, Trash2, Mountain, Aperture, Lightbulb,
    Globe, Grid3X3, Download, Monitor, Loader2, Sparkles, Palette,
    Sticker, Sun, Upload, DownloadCloud
} from 'lucide-react';
import { MATERIAL_CATEGORIES } from './KAutopbrpresets';
import KAutopbrdecals from './KAutopbrdecals';
import KAutopbrlighting from './KAutopbrlighting';
import KAutopbrHDR from './KAutopbrHDR';
import { generatePattern } from './KAutopbrEngine';
import { rustProcedural } from '../../../services/proceduralClient';

interface KAutopbrUIProps {
    activeTab: string;
    setActiveTab: (tab: string) => void;
    sceneTargets: Array<{
        id: string;
        name: string;
        materialUuid: string | null;
        colorHex: string;
    }>;
    activeSceneTargetId: string | null;
    setActiveSceneTargetId: (id: string) => void;
    resetTargetMaterial: () => void;
    sharedState: any;
    loadMaterialFromLibrary: (mat: any) => void;
    sourceImage: any;
    setSourceImage: (img: any) => void;
    params: any;
    setParams: (p: any) => void;
    applyPreset: (preset: any) => void;
    maps: any;
    downloadMap: (url: string, name: string) => void;
    downloadAll: () => void;
    decalImage: any;
    handleDecalUpload: (e: any) => void;
    lighting: any;
    setLighting: (l: any) => void;
    handleMapOverride: (type: string, e: any) => void;
    handleExtractFromMesh: () => void;
    viewShape: string;
    envMode: string;
    materialMode: 'matte' | 'glossy';      // NEW: Material mode toggle
    setMaterialMode: (mode: 'matte' | 'glossy') => void;  // NEW
    onEnvChange: (mode: string, path?: string) => void;
}

export default function KAutopbrUI({
    activeTab, setActiveTab,
    sceneTargets, activeSceneTargetId, setActiveSceneTargetId, resetTargetMaterial,
    sharedState, loadMaterialFromLibrary,
    sourceImage, setSourceImage, params, setParams, applyPreset,
    maps, downloadMap, downloadAll,
    decalImage, handleDecalUpload,
    lighting, setLighting,
    handleMapOverride,
    handleExtractFromMesh,
    viewShape,
    envMode,
    materialMode,
    setMaterialMode,
    onEnvChange
}: KAutopbrUIProps) {

    const mapSlots = [
        { id: 'base', l: 'ALB', c: 'blue' },
        { id: 'normal', l: 'NRM', c: 'purple' },
        { id: 'roughness', l: 'RGH', c: 'orange' },
        { id: 'metallic', l: 'MET', c: 'gray' },
        { id: 'ao', l: 'OCC', c: 'emerald' },
        { id: 'height', l: 'DIS', c: 'pink' },
        { id: 'emissive', l: 'EMS', c: 'cyan' }
    ];

    return (
        <div className="w-full lg:w-[35%] bg-black/40 backdrop-blur-xl border-l border-white/10 flex flex-col h-full overflow-hidden z-20 shadow-2xl">
            <div className="flex border-b border-white/10 bg-black/20 overflow-x-auto scrollbar-hide">
                {[
                    { id: 'surgery', icon: Stethoscope, l: 'SCENE' },
                    { id: 'presets', icon: BookTemplate, l: 'PRESETS' },
                    { id: 'surface', icon: Sliders, l: 'SURFACE' },
                    { id: 'flux', icon: Zap, l: 'FLUX' },
                    { id: 'decal', icon: Sticker, l: 'DECAL' },
                    { id: 'hdr', icon: Globe, l: 'HDR' },
                    { id: 'light', icon: Sun, l: 'LIGHT' }
                ].map(t => (
                    <button key={t.id} onClick={() => setActiveTab(t.id)} className={`flex-1 min-w-[70px] py-3 text-[10px] font-bold flex flex-col items-center justify-center gap-1.5 border-b-2 transition-all ${activeTab === t.id ? 'border-blue-500 text-blue-400 bg-white/5' : 'border-transparent text-gray-500 hover:text-gray-300 hover:bg-white/5'}`}>
                        <t.icon size={16} /> {t.l}
                    </button>
                ))}
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar bg-transparent">
                {activeTab === 'surgery' && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                        <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2"><Stethoscope size={14} /> Sample Targets</div>
                        <div className="space-y-1 max-h-60 overflow-y-auto custom-scrollbar border border-[#222] rounded bg-[#111] p-1">
                            {sceneTargets.map((target, i) => (
                                <div key={target.id} onClick={() => setActiveSceneTargetId(target.id)} className={`p-2 rounded flex items-center gap-3 cursor-pointer border ${activeSceneTargetId === target.id ? 'bg-blue-900/20 border-blue-500/50 text-white' : 'bg-[#161616] border-transparent text-gray-400 hover:bg-[#222]'}`}>
                                    <div className="w-3 h-3 rounded-full border border-gray-600" style={{ backgroundColor: target.colorHex }}></div>
                                    <span className="flex-1 text-[10px] font-bold truncate">{target.name || `Sample_Target_${i}`}</span>
                                    {activeSceneTargetId === target.id && <Crosshair size={10} className="text-blue-400" />}
                                </div>
                            ))}
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                            {activeSceneTargetId && (viewShape === 'artifact' || sharedState?.activeMaterialId) && (
                                <button onClick={handleExtractFromMesh} className="py-2 bg-emerald-900/20 hover:bg-emerald-900/40 text-emerald-400 border border-emerald-900/50 rounded flex items-center justify-center gap-2 text-[10px] font-bold transition-all"><DownloadCloud size={14} /> EXTRACT TEXTURE</button>
                            )}
                            <button onClick={resetTargetMaterial} className={`py-1.5 bg-red-900/20 hover:bg-red-900/40 text-red-400 border border-red-900/50 rounded flex items-center justify-center gap-2 text-[9px] font-bold transition-all ${!activeSceneTargetId || (viewShape !== 'artifact' && !sharedState?.activeMaterialId) ? 'col-span-2' : ''}`}><Trash2 size={10} /> RESET ACTIVE</button>
                        </div>

                        <div className="pt-4 mt-4 border-t border-[#222]">
                            <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2 mb-3"><Library size={14} /> Project Library</div>
                            <div className="grid grid-cols-4 gap-3">
                                {sharedState?.materials?.length > 0 ? sharedState.materials.map((mat: any) => (
                                    <div key={mat.id} onClick={() => loadMaterialFromLibrary(mat)} className="cursor-pointer group relative aspect-square rounded border border-[#222] hover:border-blue-500 transition-all overflow-hidden bg-[#111]">
                                        <img src={mat.preview} className="w-full h-full object-cover opacity-70 group-hover:opacity-100" />
                                        <div className="absolute bottom-0 w-full bg-black/80 text-[8px] text-center py-1 truncate text-gray-300">{mat.name}</div>
                                    </div>
                                )) : (
                                    <div className="col-span-4 text-[10px] text-gray-600 text-center italic py-6 border border-dashed border-[#222] rounded">No stored materials</div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'presets' && sourceImage && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300 pb-10">
                        <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2"><BookTemplate size={14} /> Material Presets</div>

                        {Object.values(MATERIAL_CATEGORIES).map((category: any) => (
                            <div key={category.id} className="space-y-3">
                                <div className="flex items-center gap-2 text-[10px] font-bold text-blue-400 uppercase tracking-wider border-b border-[#222] pb-1">
                                    <category.icon size={12} />
                                    {category.label}
                                </div>
                                <div className="grid grid-cols-3 gap-3">
                                    {category.presets.map((preset: any) => (
                                        <button
                                            key={preset.id}
                                            onClick={() => applyPreset(preset)}
                                            className="p-3 bg-[#111] hover:bg-[#1a1a1a] border border-[#222] hover:border-blue-500/50 rounded flex flex-col items-center justify-center gap-2 transition-all group"
                                        >
                                            <preset.icon size={18} className="text-gray-500 group-hover:text-blue-400 transition-colors" />
                                            <span className="text-[9px] font-bold text-gray-400 group-hover:text-white text-center">{preset.label}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {(!sourceImage && activeTab !== 'surgery') ? (
                    <div className="h-full flex flex-col items-center justify-center text-gray-600 text-center opacity-50 mt-10"><Monitor size={32} className="mb-4 opacity-30" /><p className="text-[10px] font-bold">AWAITING SOURCE SIGNAL...</p></div>
                ) : (
                    <>
                        {activeTab === 'surface' && sourceImage && (
                            <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">

                                {/* 🎨 MATERIAL MODE TOGGLE - Like Substance Sampler */}
                                <div className="p-3 bg-gradient-to-r from-[#111] to-[#0a0a0a] rounded-lg border border-[#333] space-y-3">
                                    <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2"><Aperture size={12} /> Material Mode</div>
                                    <div className="grid grid-cols-2 gap-2">
                                        <button
                                            onClick={() => {
                                                setMaterialMode('matte');
                                                setParams({ ...params, roughnessBase: 0.8, metallicBase: 0.0 });
                                            }}
                                            className={`py-2.5 rounded-lg text-[11px] font-bold border-2 transition-all flex items-center justify-center gap-2 ${materialMode === 'matte'
                                                ? 'bg-orange-900/30 border-orange-500 text-orange-300 shadow-[0_0_15px_rgba(249,115,22,0.2)]'
                                                : 'bg-[#161616] border-[#333] text-gray-500 hover:text-white hover:border-[#444]'
                                                }`}
                                        >
                                            <div className="w-3 h-3 rounded-full bg-gradient-to-br from-gray-400 to-gray-600"></div>
                                            MATTE
                                        </button>
                                        <button
                                            onClick={() => {
                                                setMaterialMode('glossy');
                                                setParams({ ...params, roughnessBase: 0.2, metallicBase: 0.0 });
                                            }}
                                            className={`py-2.5 rounded-lg text-[11px] font-bold border-2 transition-all flex items-center justify-center gap-2 ${materialMode === 'glossy'
                                                ? 'bg-cyan-900/30 border-cyan-500 text-cyan-300 shadow-[0_0_15px_rgba(6,182,212,0.2)]'
                                                : 'bg-[#161616] border-[#333] text-gray-500 hover:text-white hover:border-[#444]'
                                                }`}
                                        >
                                            <div className="w-3 h-3 rounded-full bg-gradient-to-br from-white to-gray-300 shadow-lg"></div>
                                            GLOSSY
                                        </button>
                                    </div>
                                </div>


                                {/* Geometry Controls */}
                                <div className="p-3 bg-[#111] rounded border border-[#222] space-y-3">
                                    <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2"><Mountain size={12} /> Geometry</div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <div className="flex justify-between text-[9px] text-gray-500 font-bold mb-1"><span>NORMAL</span> <span className="text-blue-400">{(params.normalStrength * 100).toFixed(0)}%</span></div>
                                            <input type="range" min="0.001" max="0.1" step="0.001" value={params.normalStrength} onChange={e => setParams({ ...params, normalStrength: parseFloat(e.target.value) })} className="w-full h-1.5 bg-[#222] rounded appearance-none accent-blue-500" />
                                        </div>
                                        <div>
                                            <div className="flex justify-between text-[9px] text-gray-500 font-bold mb-1"><span>HEIGHT</span> <span className="text-blue-400">{(params.displacementScale * 100).toFixed(0)}%</span></div>
                                            <input type="range" min="0" max="0.2" step="0.001" value={params.displacementScale} onChange={e => setParams({ ...params, displacementScale: parseFloat(e.target.value) })} className="w-full h-1.5 bg-[#222] rounded appearance-none accent-blue-500" />
                                        </div>
                                    </div>
                                </div>

                                {/* Material Controls */}
                                <div className="p-3 bg-[#111] rounded border border-[#222] space-y-3">
                                    <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2"><Aperture size={12} /> Material</div>
                                    <div className="grid grid-cols-2 gap-4">
                                        {/* Roughness Base Slider */}
                                        <div>
                                            <div className="flex justify-between text-[9px] text-gray-500 font-bold mb-1"><span>ROUGHNESS</span> <span className="text-orange-400">{((params.roughnessBase || 0.7) * 100).toFixed(0)}%</span></div>
                                            <input type="range" min="0" max="1" step="0.01" value={params.roughnessBase || 0.7} onChange={e => setParams({ ...params, roughnessBase: parseFloat(e.target.value) })} className="w-full h-1.5 bg-[#222] rounded appearance-none accent-orange-500" />
                                        </div>
                                        {/* Metallic Base Slider */}
                                        <div>
                                            <div className="flex justify-between text-[9px] text-gray-500 font-bold mb-1"><span>METALLIC</span> <span className="text-gray-300">{((params.metallicBase || 0) * 100).toFixed(0)}%</span></div>
                                            <input type="range" min="0" max="1" step="0.01" value={params.metallicBase || 0} onChange={e => setParams({ ...params, metallicBase: parseFloat(e.target.value) })} className="w-full h-1.5 bg-[#222] rounded appearance-none accent-gray-400" />
                                        </div>
                                        <div className="col-span-2">
                                            <div className="flex justify-between text-[9px] text-gray-500 font-bold mb-1"><span>AO INTENSITY</span> <span className="text-blue-400">{(params.aoIntensity * 100).toFixed(0)}%</span></div>
                                            <input type="range" min="0" max="2" step="0.1" value={params.aoIntensity} onChange={e => setParams({ ...params, aoIntensity: parseFloat(e.target.value) })} className="w-full h-1.5 bg-[#222] rounded appearance-none accent-blue-500" />
                                        </div>
                                    </div>
                                    {/* Advanced Controls (collapsed) */}
                                    <details className="group">
                                        <summary className="text-[9px] text-gray-600 cursor-pointer hover:text-gray-400 transition">▶ Advanced Adjustments</summary>
                                        <div className="grid grid-cols-2 gap-3 mt-3 pt-3 border-t border-[#222]">
                                            <div>
                                                <div className="flex justify-between text-[8px] text-gray-600 font-bold mb-1"><span>ROUGH CONTRAST</span> <span className="text-gray-500">{params.roughnessContrast}x</span></div>
                                                <input type="range" min="0.1" max="3" step="0.1" value={params.roughnessContrast} onChange={e => setParams({ ...params, roughnessContrast: parseFloat(e.target.value) })} className="w-full h-1 bg-[#222] rounded appearance-none accent-gray-600" />
                                            </div>
                                            <div>
                                                <div className="flex justify-between text-[8px] text-gray-600 font-bold mb-1"><span>METAL CONTRAST</span> <span className="text-gray-500">{params.metalContrast}x</span></div>
                                                <input type="range" min="0.1" max="3" step="0.1" value={params.metalContrast} onChange={e => setParams({ ...params, metalContrast: parseFloat(e.target.value) })} className="w-full h-1 bg-[#222] rounded appearance-none accent-gray-600" />
                                            </div>
                                            <button onClick={() => setParams({ ...params, roughnessInvert: !params.roughnessInvert })} className={`py-1.5 rounded text-[9px] font-bold border transition ${params.roughnessInvert ? 'bg-purple-900/20 border-purple-500 text-purple-400' : 'bg-[#161616] border-[#333] text-gray-600 hover:text-white'}`}>INVERT ROUGH</button>
                                        </div>
                                    </details>
                                </div>

                                {/* Light/Emissive Controls */}
                                <div className="p-3 bg-[#111] rounded border border-[#222] space-y-3">
                                    <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2"><Lightbulb size={12} /> Light</div>
                                    <div>
                                        <div className="flex justify-between text-[9px] text-gray-500 font-bold mb-1"><span>EMISSIVE THRESHOLD</span> <span className="text-blue-400">{(params.emissiveThreshold * 100).toFixed(0)}%</span></div>
                                        <input type="range" min="0" max="0.95" step="0.01" value={params.emissiveThreshold} onChange={e => setParams({ ...params, emissiveThreshold: parseFloat(e.target.value) })} className="w-full h-1.5 bg-[#222] rounded appearance-none accent-blue-500" />
                                    </div>
                                </div>

                                {/* Global Adjustments */}
                                <div className="p-3 bg-[#111] rounded border border-[#222] space-y-3">
                                    <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2"><Globe size={12} /> Global Adjust</div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <div className="flex justify-between text-[9px] text-gray-500 font-bold mb-1"><span>UV SCALE</span> <span className="text-blue-400">{params.scale}x</span></div>
                                            <input type="range" min="0.1" max="5.0" step="0.1" value={params.scale} onChange={e => setParams({ ...params, scale: parseFloat(e.target.value) })} className="w-full h-1.5 bg-[#222] rounded appearance-none accent-blue-500" />
                                        </div>
                                        <button onClick={() => setParams({ ...params, makeSeamless: !params.makeSeamless })} className={`w-full py-2 rounded text-[10px] font-bold border transition ${params.makeSeamless ? 'bg-green-900/20 border-green-500 text-green-400' : 'bg-[#161616] border-[#222] text-gray-500 hover:text-white'}`}>{params.makeSeamless ? 'SEAMLESS: ON' : 'SEAMLESS: OFF'}</button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab === 'flux' && sourceImage && (
                            <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                                {/* Generators */}
                                <div className="space-y-3 bg-[#111] p-3 rounded border border-[#222]">
                                    <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2"><Sparkles size={12} /> Generators (🦀 Rust)</div>
                                    <div className="grid grid-cols-3 gap-2">
                                        <button onClick={async () => { const img = await rustProcedural.generateChecker(1024); setSourceImage(img); }} className="py-2 bg-[#222] hover:bg-blue-900/30 hover:text-blue-400 text-gray-400 rounded text-[9px] font-bold transition-all border border-transparent hover:border-blue-500/50">CHECKER</button>
                                        <button onClick={async () => { const img = await rustProcedural.generateNoise(1024, 'fbm'); setSourceImage(img); }} className="py-2 bg-[#222] hover:bg-blue-900/30 hover:text-blue-400 text-gray-400 rounded text-[9px] font-bold transition-all border border-transparent hover:border-blue-500/50">NOISE</button>
                                        <button onClick={async () => { const img = await rustProcedural.generateBricks(1024); setSourceImage(img); }} className="py-2 bg-[#222] hover:bg-blue-900/30 hover:text-blue-400 text-gray-400 rounded text-[9px] font-bold transition-all border border-transparent hover:border-blue-500/50">BRICKS</button>
                                    </div>
                                    <div className="grid grid-cols-3 gap-2">
                                        <button onClick={async () => { const r = await rustProcedural.generateProceduralTexture({ noise_type: 'perlin', width: 1024, height: 1024, scale: 4 }); setSourceImage(r.image); }} className="py-2 bg-[#161616] hover:bg-purple-900/30 hover:text-purple-400 text-gray-500 rounded text-[8px] font-bold transition-all border border-transparent hover:border-purple-500/50">PERLIN</button>
                                        <button onClick={async () => { const r = await rustProcedural.generateProceduralTexture({ noise_type: 'ridged', width: 1024, height: 1024, scale: 3, octaves: 6 }); setSourceImage(r.image); }} className="py-2 bg-[#161616] hover:bg-purple-900/30 hover:text-purple-400 text-gray-500 rounded text-[8px] font-bold transition-all border border-transparent hover:border-purple-500/50">RIDGED</button>
                                        <button onClick={async () => { const r = await rustProcedural.generateVoronoiTexture({ width: 1024, height: 1024, cell_count: 40, output_type: 'cell_value' }); setSourceImage(r.image); }} className="py-2 bg-[#161616] hover:bg-purple-900/30 hover:text-purple-400 text-gray-500 rounded text-[8px] font-bold transition-all border border-transparent hover:border-purple-500/50">CELLS</button>
                                    </div>
                                </div>
                                {/* Color Grading */}
                                <div className="space-y-3 bg-[#111] p-3 rounded border border-[#222]">
                                    <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2"><Palette size={12} /> Color Grading</div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <div className="flex justify-between text-[9px] text-gray-400 font-bold mb-1"><span>BRIGHTNESS</span> <span className="text-blue-400">{params.brightness || 1.0}x</span></div>
                                            <input type="range" min="0" max="2" step="0.01" value={params.brightness || 1.0} onChange={e => setParams({ ...params, brightness: parseFloat(e.target.value) })} className="w-full h-1.5 bg-[#222] rounded appearance-none accent-blue-500" />
                                        </div>
                                        <div>
                                            <div className="flex justify-between text-[9px] text-gray-400 font-bold mb-1"><span>CONTRAST</span> <span className="text-blue-400">{params.contrast || 1.0}x</span></div>
                                            <input type="range" min="0" max="2" step="0.01" value={params.contrast || 1.0} onChange={e => setParams({ ...params, contrast: parseFloat(e.target.value) })} className="w-full h-1.5 bg-[#222] rounded appearance-none accent-blue-500" />
                                        </div>
                                        <div>
                                            <div className="flex justify-between text-[9px] text-gray-400 font-bold mb-1"><span>GAMMA</span> <span className="text-blue-400">{params.gamma || 1.0}</span></div>
                                            <input type="range" min="0.1" max="3.0" step="0.1" value={params.gamma || 1.0} onChange={e => setParams({ ...params, gamma: parseFloat(e.target.value) })} className="w-full h-1.5 bg-[#222] rounded appearance-none accent-blue-500" />
                                        </div>
                                        <div>
                                            <div className="flex justify-between text-[9px] text-gray-400 font-bold mb-1"><span>HUE SHIFT</span> <span className="text-blue-400">{params.hue}°</span></div>
                                            <input type="range" min="0" max="360" step="1" value={params.hue} onChange={e => setParams({ ...params, hue: parseFloat(e.target.value) })} className="w-full h-1.5 bg-[#222] rounded appearance-none accent-blue-500" />
                                        </div>
                                    </div>
                                    <button onClick={() => setParams({ ...params, invert: !params.invert })} className={`w-full py-2 rounded text-[10px] font-bold border transition ${params.invert ? 'bg-white text-black border-white' : 'bg-[#161616] border-[#222] text-gray-500 hover:text-white'}`}>INVERT COLORS</button>
                                </div>

                                {/* Filters */}
                                <div className="space-y-3 bg-[#111] p-3 rounded border border-[#222]">
                                    <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2"><Sliders size={12} /> Filters</div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <div className="flex justify-between text-[9px] text-gray-400 font-bold mb-1"><span>BLUR</span> <span className="text-blue-400">{(params.blur * 100).toFixed(0)}%</span></div>
                                            <input type="range" min="0" max="1" step="0.01" value={params.blur || 0} onChange={e => setParams({ ...params, blur: parseFloat(e.target.value) })} className="w-full h-1.5 bg-[#222] rounded appearance-none accent-blue-500" />
                                        </div>
                                        <div>
                                            <div className="flex justify-between text-[9px] text-gray-400 font-bold mb-1"><span>SHARPEN</span> <span className="text-blue-400">{(params.sharpen * 100).toFixed(0)}%</span></div>
                                            <input type="range" min="0" max="1" step="0.01" value={params.sharpen || 0} onChange={e => setParams({ ...params, sharpen: parseFloat(e.target.value) })} className="w-full h-1.5 bg-[#222] rounded appearance-none accent-blue-500" />
                                        </div>
                                    </div>
                                </div>

                                {/* Synthesis */}
                                <div className="space-y-3 bg-[#111] p-3 rounded border border-[#222]">
                                    <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2"><Zap size={12} /> Synthesis</div>
                                    <div className="space-y-3">
                                        <div>
                                            <div className="flex justify-between text-[9px] text-gray-400 font-bold mb-1"><span>CYBER ETCHING</span> <span className="text-blue-400">{(params.cyberDetail * 100).toFixed(0)}%</span></div>
                                            <div className="flex gap-3">
                                                <input type="range" min="0" max="0.5" step="0.01" value={params.cyberDetail} onChange={e => setParams({ ...params, cyberDetail: parseFloat(e.target.value) })} className="w-full h-1.5 bg-[#222] rounded appearance-none accent-blue-500" />
                                                <input type="range" min="0.01" max="0.5" step="0.01" value={params.cyberScale} onChange={e => setParams({ ...params, cyberScale: parseFloat(e.target.value) })} className="w-1/2 h-1.5 bg-[#222] rounded appearance-none accent-blue-500" title="Pattern Scale" />
                                            </div>
                                        </div>
                                        <div>
                                            <div className="flex justify-between text-[9px] text-gray-400 font-bold mb-1"><span>BIO-GROWTH</span> <span className="text-blue-400">{(params.bioDetail * 100).toFixed(0)}%</span></div>
                                            <input type="range" min="0" max="1.0" step="0.01" value={params.bioDetail} onChange={e => setParams({ ...params, bioDetail: parseFloat(e.target.value) })} className="w-full h-1.5 bg-[#222] rounded appearance-none accent-blue-500" />
                                        </div>
                                    </div>
                                </div>

                                {/* Distortion */}
                                <div className="space-y-3 bg-[#111] p-3 rounded border border-[#222]">
                                    <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2"><Zap size={12} /> Distortion</div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <div className="flex justify-between text-[9px] text-gray-400 font-bold mb-1"><span>BITCRUSH</span> <span className="text-yellow-400">{(params.pixelate * 100).toFixed(0)}%</span></div>
                                            <input type="range" min="0" max="1.0" step="0.01" value={params.pixelate} onChange={e => setParams({ ...params, pixelate: parseFloat(e.target.value) })} className="w-full h-1.5 bg-[#222] rounded appearance-none accent-yellow-500" />
                                        </div>
                                        <div>
                                            <div className="flex justify-between text-[9px] text-gray-400 font-bold mb-1"><span>CRT RASTER</span> <span className="text-green-400">{(params.scanlines * 100).toFixed(0)}%</span></div>
                                            <input type="range" min="0" max="1.0" step="0.01" value={params.scanlines} onChange={e => setParams({ ...params, scanlines: parseFloat(e.target.value) })} className="w-full h-1.5 bg-[#222] rounded appearance-none accent-green-500" />
                                        </div>
                                        <div>
                                            <div className="flex justify-between text-[9px] text-gray-400 font-bold mb-1"><span>STATIC</span> <span className="text-white">{(params.noise * 100).toFixed(0)}%</span></div>
                                            <input type="range" min="0" max="1.0" step="0.01" value={params.noise} onChange={e => setParams({ ...params, noise: parseFloat(e.target.value) })} className="w-full h-1.5 bg-[#222] rounded appearance-none accent-gray-500" />
                                        </div>
                                        <div>
                                            <div className="flex justify-between text-[9px] text-gray-400 font-bold mb-1"><span>PRISM</span> <span className="text-red-400">{(params.chromatic * 100).toFixed(0)}%</span></div>
                                            <input type="range" min="0" max="1.0" step="0.01" value={params.chromatic} onChange={e => setParams({ ...params, chromatic: parseFloat(e.target.value) })} className="w-full h-1.5 bg-[#222] rounded appearance-none accent-red-500" />
                                        </div>
                                        <div className="col-span-2">
                                            <div className="flex justify-between text-[9px] text-gray-400 font-bold mb-1"><span>VIGNETTE</span> <span className="text-purple-400">{(params.vignette * 100).toFixed(0)}%</span></div>
                                            <input type="range" min="0" max="1.0" step="0.01" value={params.vignette || 0} onChange={e => setParams({ ...params, vignette: parseFloat(e.target.value) })} className="w-full h-1.5 bg-[#222] rounded appearance-none accent-purple-500" />
                                        </div>
                                    </div>
                                </div>

                                {/* Surface Wear */}
                                <div className="space-y-3 bg-[#111] p-3 rounded border border-[#222]">
                                    <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2"><Zap size={12} /> Surface Wear</div>
                                    <div className="grid grid-cols-3 gap-3">
                                        <div>
                                            <div className="flex justify-between text-[9px] text-gray-400 font-bold mb-1"><span>SCRATCH</span></div>
                                            <input type="range" min="0" max="1.0" step="0.01" value={params.scratches} onChange={e => setParams({ ...params, scratches: parseFloat(e.target.value) })} className="w-full h-1.5 bg-[#222] rounded appearance-none accent-blue-500" />
                                        </div>
                                        <div>
                                            <div className="flex justify-between text-[9px] text-gray-400 font-bold mb-1"><span>DUST</span></div>
                                            <input type="range" min="0" max="1.0" step="0.01" value={params.dust} onChange={e => setParams({ ...params, dust: parseFloat(e.target.value) })} className="w-full h-1.5 bg-[#222] rounded appearance-none accent-blue-500" />
                                        </div>
                                        <div>
                                            <div className="flex justify-between text-[9px] text-gray-400 font-bold mb-1"><span>GRUNGE</span></div>
                                            <input type="range" min="0" max="1.0" step="0.01" value={params.grunge} onChange={e => setParams({ ...params, grunge: parseFloat(e.target.value) })} className="w-full h-1.5 bg-[#222] rounded appearance-none accent-blue-500" />
                                        </div>
                                    </div>
                                </div>

                                {/* Edge & Relief */}
                                <div className="space-y-3 bg-[#111] p-3 rounded border border-[#222]">
                                    <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2"><Mountain size={12} /> Edge & Relief</div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <div className="flex justify-between text-[9px] text-gray-400 font-bold mb-1"><span>EDGE WEAR</span> <span className="text-blue-400">{(params.edgeWear * 100).toFixed(0)}%</span></div>
                                            <input type="range" min="0" max="1.0" step="0.01" value={params.edgeWear || 0} onChange={e => setParams({ ...params, edgeWear: parseFloat(e.target.value) })} className="w-full h-1.5 bg-[#222] rounded appearance-none accent-blue-500" />
                                        </div>
                                        <div>
                                            <div className="flex justify-between text-[9px] text-gray-400 font-bold mb-1"><span>CAVITY DIRT</span> <span className="text-blue-400">{(params.cavityDirt * 100).toFixed(0)}%</span></div>
                                            <input type="range" min="0" max="1.0" step="0.01" value={params.cavityDirt || 0} onChange={e => setParams({ ...params, cavityDirt: parseFloat(e.target.value) })} className="w-full h-1.5 bg-[#222] rounded appearance-none accent-blue-500" />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab === 'decal' && sourceImage && (
                            <KAutopbrdecals
                                decalImage={decalImage}
                                handleDecalUpload={handleDecalUpload}
                                params={params}
                                setParams={setParams}
                                sourceImage={sourceImage}
                            />
                        )}

                        {activeTab === 'hdr' && (
                            <KAutopbrHDR onApply={(url) => onEnvChange('custom', url)} />
                        )}

                        {activeTab === 'light' && (
                            <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                                <div className="p-3 bg-[#111] rounded border border-[#222] space-y-3">
                                    <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2"><Globe size={12} /> Environment</div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <button onClick={() => onEnvChange('studio')} className={`py-2 rounded text-[10px] font-bold border transition ${envMode === 'studio' ? 'bg-blue-900/20 border-blue-500 text-blue-400' : 'bg-[#161616] border-[#222] text-gray-500 hover:text-white'}`}>STUDIO (DEFAULT)</button>
                                        <label className={`py-2 rounded text-[10px] font-bold border transition text-center cursor-pointer ${envMode === 'custom' ? 'bg-purple-900/20 border-purple-500 text-purple-400' : 'bg-[#161616] border-[#222] text-gray-500 hover:text-white'}`}>
                                            CUSTOM HDR
                                            <input type="file" accept=".hdr" className="hidden" onChange={(e) => {
                                                const file = e.target.files?.[0];
                                                if (file) {
                                                    const url = URL.createObjectURL(file);
                                                    onEnvChange('custom', url);
                                                }
                                            }} />
                                        </label>
                                    </div>
                                </div>
                                <KAutopbrlighting lighting={lighting} setLighting={setLighting} />
                            </div>
                        )}

                        {(activeTab !== 'surgery' && activeTab !== 'library' && activeTab !== 'presets' && sourceImage) && (
                            <div className="flex overflow-x-auto gap-3 pt-4 border-t border-[#222] pb-2 custom-scrollbar">
                                {mapSlots.map(m => (
                                    <div key={m.id} className={`relative flex-shrink-0 w-14 h-14 bg-[#050505] rounded-md border border-${m.c}-900/30 overflow-hidden group`}>
                                        <img src={maps[m.id]} className="w-full h-full object-cover" />
                                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-2">
                                            <button onClick={() => downloadMap(maps[m.id], m.id)} className="p-1.5 bg-[#222] hover:bg-white hover:text-black rounded-full transition" title="Download"><Download size={8} /></button>
                                            <label className="p-1.5 bg-[#222] hover:bg-white hover:text-black rounded-full transition cursor-pointer" title="Replace">
                                                <Upload size={8} />
                                                <input type="file" className="hidden" onChange={(e) => handleMapOverride(m.id, e)} accept="image/*" />
                                            </label>
                                        </div>
                                        <div className={`absolute bottom-0 left-0 w-full bg-${m.c}-900/80 text-${m.c}-200 text-[6px] text-center font-bold py-1 backdrop-blur-sm border-t border-${m.c}-500/50`}>{m.l}</div>
                                    </div>
                                ))}
                            </div>
                        )}
                        {(activeTab !== 'surgery' && activeTab !== 'library' && activeTab !== 'presets' && sourceImage) && (
                            <button onClick={downloadAll} className="w-full py-3 bg-[#161616] hover:bg-[#222] border border-[#222] rounded text-[10px] font-bold transition text-gray-400 hover:text-white flex items-center justify-center gap-2 uppercase"><Download size={12} /> Download All Maps</button>
                        )}
                    </>
                )}
            </div>
        </div >
    );
}
