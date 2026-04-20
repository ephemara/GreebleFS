
import React, { useState } from 'react';
import {
    Layers, Aperture, CircuitBoard,
    Share2, Image as ImageIcon, UploadCloud, Library, Eye, Package, Download,
    Zap, Box, Monitor, Stamp
} from 'lucide-react';
import { KSection, KSlider, KButton, KPanel } from '../../../core/ui';
import KGraphosLayers from './KGraphosLayers';
import KGraphosAlphaTab from './KGraphosAlphaTab';

export default function KGraphosUI({
    activeTab, setActiveTab,
    layers, setLayers,
    activeLayerId, setActiveLayerId,
    handleLayerAdd,
    handleLayerDelete,
    handleLayerOpacity,
    handleLayerVisibility,
    handleExport,
    activeMods, setActiveMods,
    engineRef,
    // Alpha Props
    alphas, onAlphaCommit, brush, setBrush, onBrushCommit
}: any) {
    const [genParams, setGenParams] = useState<any>({
        noiseScale: 3.0, noiseDetail: 4.0,
        patternScale: 10.0, patternMode: 0,
        blurStrength: 2.0,
        normalStrength: 1.0,
        levelsMin: 0.0, levelsMax: 1.0, levelsGamma: 1.0, levelsInvert: false,
        pixelSortThreshold: 0.5,
        edgeStrength: 1.0,
        // NEW Generators
        gradientMode: 0, gradientAngle: 0, gradientColorA: '#000000', gradientColorB: '#ffffff',
        seamlessBlend: 0.25,
        aoRadius: 5.0, aoIntensity: 2.0,
        curvatureStrength: 5.0,
        // NEW Filters
        sharpenStrength: 1.0,
        hueShift: 0.0, saturation: 1.0, lightness: 0.0,
        posterizeLevels: 4,
        embossStrength: 2.0,
        thresholdValue: 0.5
    });

    const [isPanelCollapsed, setIsPanelCollapsed] = useState(false);

    const runGen = (type: string) => {
        if (!engineRef.current || !activeLayerId) return;
        const p = genParams;
        if (type === 'NOISE') engineRef.current.applyGenerator(activeLayerId, 'NOISE', { scale: p.noiseScale, detail: p.noiseDetail, colorA: '#000000', colorB: '#ffffff' });
        if (type === 'PATTERN') engineRef.current.applyGenerator(activeLayerId, 'PATTERN', { scale: p.patternScale, mode: p.patternMode, colorA: '#000000', colorB: '#ffffff' });
        if (type === 'VORONOI') engineRef.current.applyGenerator(activeLayerId, 'VORONOI', { scale: p.noiseScale, colorA: '#000000', colorB: '#ffffff' });
        if (type === 'FBM') engineRef.current.applyGenerator(activeLayerId, 'FBM', { scale: p.noiseScale, colorA: '#000000', colorB: '#ffffff' });
        // NEW Generators
        if (type === 'GRADIENT') engineRef.current.applyGenerator(activeLayerId, 'GRADIENT', { mode: p.gradientMode, angle: p.gradientAngle, colorA: p.gradientColorA, colorB: p.gradientColorB });
        if (type === 'SEAMLESS') engineRef.current.applyGenerator(activeLayerId, 'SEAMLESS', { blend: p.seamlessBlend });
        if (type === 'AO') engineRef.current.applyGenerator(activeLayerId, 'AO', { radius: p.aoRadius, intensity: p.aoIntensity });
        if (type === 'CURVATURE') engineRef.current.applyGenerator(activeLayerId, 'CURVATURE', { strength: p.curvatureStrength });
    };

    const runFilter = (type: string) => {
        if (!engineRef.current || !activeLayerId) return;
        const p = genParams;
        if (type === 'BLUR') engineRef.current.applyFilter(activeLayerId, 'BLUR', { strength: p.blurStrength });
        if (type === 'NORMAL') engineRef.current.applyFilter(activeLayerId, 'NORMAL', { strength: p.normalStrength });
        if (type === 'LEVELS') engineRef.current.applyFilter(activeLayerId, 'LEVELS', { min: p.levelsMin, max: p.levelsMax, gamma: p.levelsGamma, invert: p.levelsInvert });
        if (type === 'PIXEL_SORT') engineRef.current.applyFilter(activeLayerId, 'PIXEL_SORT', { threshold: p.pixelSortThreshold });
        if (type === 'EDGE') engineRef.current.applyFilter(activeLayerId, 'EDGE', {});
        // NEW Filters
        if (type === 'SHARPEN') engineRef.current.applyFilter(activeLayerId, 'SHARPEN', { strength: p.sharpenStrength });
        if (type === 'HSL') engineRef.current.applyFilter(activeLayerId, 'HSL', { hue: p.hueShift, saturation: p.saturation, lightness: p.lightness });
        if (type === 'POSTERIZE') engineRef.current.applyFilter(activeLayerId, 'POSTERIZE', { levels: p.posterizeLevels });
        if (type === 'EMBOSS') engineRef.current.applyFilter(activeLayerId, 'EMBOSS', { strength: p.embossStrength });
        if (type === 'THRESHOLD') engineRef.current.applyFilter(activeLayerId, 'THRESHOLD', { threshold: p.thresholdValue });
    };

    const handleTabClick = (tabId: string) => {
        setActiveTab(tabId);
        if (isPanelCollapsed) setIsPanelCollapsed(false);
    };

    const tabs = [
        { id: 'alpha', icon: Stamp, l: 'ALPHAS', color: 'orange' },
        { id: 'gen', icon: CircuitBoard, l: 'GEN', color: 'cyan' },
        { id: 'filter', icon: Aperture, l: 'FILTER', color: 'purple' },
        { id: 'export', icon: Package, l: 'EXPORT', color: 'emerald' },
    ];

    const handleSolo = () => {
        if (!activeLayerId) return;
        const newLayers = layers.map((l: any) => ({ ...l, visible: l.id === activeLayerId }));
        setLayers(newLayers);
        engineRef.current?.compose();
    };

    return (
        <div className="flex-shrink-0 h-full border-r border-[#222]">
            <KPanel width="w-80" collapsible isCollapsed={isPanelCollapsed} onCollapseChange={setIsPanelCollapsed} collapsedContent={<div className="flex flex-col gap-6 w-full items-center">{tabs.map(t => (<button key={t.id} onClick={() => handleTabClick(t.id)} className={`p-2 rounded-lg transition-all group relative ${activeTab === t.id ? `text-${t.color}-400 bg-${t.color}-900/20` : 'text-gray-500 hover:text-white hover:bg-[#222]'}`} title={t.l}><t.icon size={20} />{activeTab === t.id && <div className={`absolute left-0 top-1/2 -translate-y-1/2 w-1 h-4 bg-${t.color}-500 rounded-r-full -ml-2`} />}</button>))}</div>}>
                <div className="flex border-b border-[#222] bg-[#0f0f0f] overflow-x-auto scrollbar-hide">
                    {tabs.map(t => (
                        <button key={t.id} onClick={() => setActiveTab(t.id)} className={`flex-1 min-w-[50px] py-4 text-[9px] font-bold flex flex-col items-center gap-1 transition-all ${activeTab === t.id ? `text-${t.color}-400 bg-[#0a0a0a] border-b-2 border-${t.color}-500` : 'text-gray-600 hover:text-gray-300 hover:bg-[#111]'}`}>
                            <t.icon size={14} /> {t.l}
                        </button>
                    ))}
                </div>

                <div className="flex-1 overflow-y-auto p-5 space-y-8 custom-scrollbar bg-[#0a0a0a]">



                    {/* ALPHA TAB */}
                    {activeTab === 'alpha' && (
                        <KGraphosAlphaTab
                            alphas={alphas}
                            onAlphaCommit={onAlphaCommit}
                            brush={brush}
                            setBrush={setBrush}
                            onBrushCommit={onBrushCommit}
                        />
                    )}

                    {/* GENERATORS TAB */}
                    {activeTab === 'gen' && (
                        <div className="space-y-6 animate-in slide-in-from-right-4">
                            <KSection title="PROCEDURAL" icon={CircuitBoard}>
                                <div className="bg-[#111] p-3 rounded border border-[#222] space-y-4">
                                    <KSlider label="NOISE SCALE" value={genParams.noiseScale} min={1.0} max={20.0} step={0.1} onChange={v => setGenParams({ ...genParams, noiseScale: v })} accentColor="rose" />
                                    <KSlider label="DETAIL" value={genParams.noiseDetail} min={1.0} max={8.0} step={1.0} onChange={v => setGenParams({ ...genParams, noiseDetail: v })} accentColor="rose" />
                                    <div className="grid grid-cols-2 gap-2 mt-2">
                                        <KButton onClick={() => runGen('NOISE')} variant="primary" className="bg-rose-600 border-rose-500">SIMPLEX</KButton>
                                        <KButton onClick={() => runGen('FBM')} variant="secondary" className="border-rose-500/50 text-rose-300">FBM CLOUD</KButton>
                                        <KButton onClick={() => runGen('VORONOI')} variant="secondary">VORONOI</KButton>
                                    </div>
                                </div>
                                <div className="bg-[#111] p-3 rounded border border-[#222] space-y-4">
                                    <KSlider label="PATTERN SCALE" value={genParams.patternScale} min={1.0} max={50.0} step={1.0} onChange={v => setGenParams({ ...genParams, patternScale: v })} accentColor="cyan" />
                                    <div className="flex bg-[#0a0a0a] p-1 rounded border border-[#222]">
                                        {['GRID', 'CHECKER', 'DOTS', 'CIRCUIT'].map((m, i) => (
                                            <button key={m} onClick={() => setGenParams({ ...genParams, patternMode: i })} className={`flex-1 py-1 text-[9px] rounded font-bold ${genParams.patternMode === i ? 'bg-cyan-900/30 text-cyan-400' : 'text-gray-500'}`}>{m}</button>
                                        ))}
                                    </div>
                                    <KButton onClick={() => runGen('PATTERN')} variant="secondary" className="w-full">GENERATE PATTERN</KButton>
                                </div>

                                {/* GRADIENT */}
                                <div className="bg-[#111] p-3 rounded border border-[#222] space-y-4">
                                    <div className="text-[9px] font-bold text-gray-500 uppercase">Gradient</div>
                                    <div className="flex bg-[#0a0a0a] p-1 rounded border border-[#222]">
                                        {['LINEAR', 'RADIAL', 'ANGULAR'].map((m, i) => (
                                            <button key={m} onClick={() => setGenParams({ ...genParams, gradientMode: i })} className={`flex-1 py-1 text-[9px] rounded font-bold ${genParams.gradientMode === i ? 'bg-purple-900/30 text-purple-400' : 'text-gray-500'}`}>{m}</button>
                                        ))}
                                    </div>
                                    <KSlider label="ANGLE" value={genParams.gradientAngle} min={0} max={360} step={1} onChange={v => setGenParams({ ...genParams, gradientAngle: v })} accentColor="purple" />
                                    <div className="flex gap-2">
                                        <input type="color" value={genParams.gradientColorA} onChange={e => setGenParams({ ...genParams, gradientColorA: e.target.value })} className="w-10 h-8 bg-transparent border border-[#333] rounded" />
                                        <input type="color" value={genParams.gradientColorB} onChange={e => setGenParams({ ...genParams, gradientColorB: e.target.value })} className="w-10 h-8 bg-transparent border border-[#333] rounded" />
                                    </div>
                                    <KButton onClick={() => runGen('GRADIENT')} variant="secondary" className="w-full border-purple-500/30 text-purple-300">GENERATE GRADIENT</KButton>
                                </div>

                                {/* UTILITY GENERATORS */}
                                <div className="bg-[#111] p-3 rounded border border-[#222] space-y-4">
                                    <div className="text-[9px] font-bold text-gray-500 uppercase">Utility</div>
                                    <KSlider label="SEAMLESS BLEND" value={genParams.seamlessBlend} min={0.1} max={0.5} step={0.05} onChange={v => setGenParams({ ...genParams, seamlessBlend: v })} accentColor="emerald" />
                                    <KButton onClick={() => runGen('SEAMLESS')} variant="secondary" className="w-full border-emerald-500/30 text-emerald-300">MAKE SEAMLESS</KButton>
                                    <div className="grid grid-cols-2 gap-2 pt-2">
                                        <div>
                                            <KSlider label="AO RADIUS" value={genParams.aoRadius} min={1} max={15} step={1} onChange={v => setGenParams({ ...genParams, aoRadius: v })} accentColor="orange" />
                                            <KSlider label="AO INTENSITY" value={genParams.aoIntensity} min={0.5} max={5} step={0.1} onChange={v => setGenParams({ ...genParams, aoIntensity: v })} accentColor="orange" />
                                            <KButton onClick={() => runGen('AO')} variant="secondary" className="w-full mt-2 border-orange-500/30 text-orange-300">HEIGHT → AO</KButton>
                                        </div>
                                        <div>
                                            <KSlider label="CURVATURE" value={genParams.curvatureStrength} min={1} max={20} step={0.5} onChange={v => setGenParams({ ...genParams, curvatureStrength: v })} accentColor="sky" />
                                            <KButton onClick={() => runGen('CURVATURE')} variant="secondary" className="w-full mt-2 border-sky-500/30 text-sky-300">CURVATURE MAP</KButton>
                                        </div>
                                    </div>
                                </div>
                            </KSection>
                        </div>
                    )}

                    {/* FILTER TAB */}
                    {activeTab === 'filter' && (
                        <div className="space-y-6 animate-in slide-in-from-right-4">
                            <KSection title="PROCESSING" icon={Aperture}>
                                {/* GLITCH */}
                                <div className="bg-[#111] p-3 rounded border border-[#222] space-y-4">
                                    <div className="text-[9px] font-bold text-gray-500 uppercase flex items-center gap-2"><Zap size={10} /> Glitch Logic</div>
                                    <KSlider label="THRESHOLD" value={genParams.pixelSortThreshold} min={0.0} max={1.0} step={0.01} onChange={v => setGenParams({ ...genParams, pixelSortThreshold: v })} accentColor="yellow" />
                                    <KButton onClick={() => runFilter('PIXEL_SORT')} variant="secondary" className="w-full border-yellow-500/30 text-yellow-200 hover:bg-yellow-900/20">PIXEL SORT</KButton>
                                </div>

                                <div className="bg-[#111] p-3 rounded border border-[#222] space-y-4">
                                    <div className="text-[9px] font-bold text-gray-500 uppercase">Levels</div>
                                    <div className="flex gap-2">
                                        <input type="number" step="0.1" value={genParams.levelsMin} onChange={e => setGenParams({ ...genParams, levelsMin: parseFloat(e.target.value) })} className="w-16 bg-[#222] border border-[#333] rounded px-2 py-1 text-[10px] text-white" />
                                        <input type="number" step="0.1" value={genParams.levelsGamma} onChange={e => setGenParams({ ...genParams, levelsGamma: parseFloat(e.target.value) })} className="w-16 bg-[#222] border border-[#333] rounded px-2 py-1 text-[10px] text-white" />
                                        <input type="number" step="0.1" value={genParams.levelsMax} onChange={e => setGenParams({ ...genParams, levelsMax: parseFloat(e.target.value) })} className="w-16 bg-[#222] border border-[#333] rounded px-2 py-1 text-[10px] text-white" />
                                    </div>
                                    <div className="flex gap-2">
                                        <KButton onClick={() => setGenParams({ ...genParams, levelsInvert: !genParams.levelsInvert })} variant="secondary" className="flex-1">{genParams.levelsInvert ? 'INVERT: ON' : 'INVERT: OFF'}</KButton>
                                        <KButton onClick={() => runFilter('LEVELS')} variant="primary" className="bg-rose-600 border-rose-500 flex-1">APPLY</KButton>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-2">
                                    <div className="bg-[#111] p-3 rounded border border-[#222] space-y-4">
                                        <KSlider label="BLUR" value={genParams.blurStrength} min={0.0} max={10.0} step={0.1} onChange={v => setGenParams({ ...genParams, blurStrength: v })} accentColor="rose" />
                                        <KButton onClick={() => runFilter('BLUR')} variant="secondary" className="w-full">BLUR</KButton>
                                    </div>
                                    <div className="bg-[#111] p-3 rounded border border-[#222] space-y-4">
                                        <KSlider label="BUMP" value={genParams.normalStrength} min={0.1} max={5.0} step={0.1} onChange={v => setGenParams({ ...genParams, normalStrength: v })} accentColor="purple" />
                                        <KButton onClick={() => runFilter('NORMAL')} variant="secondary" className="w-full">TO NORMAL</KButton>
                                    </div>
                                </div>
                                <KButton onClick={() => runFilter('EDGE')} variant="secondary" className="w-full border-white/20">EDGE DETECT</KButton>

                                {/* NEW FILTERS */}
                                <div className="grid grid-cols-2 gap-2">
                                    <div className="bg-[#111] p-3 rounded border border-[#222] space-y-4">
                                        <KSlider label="SHARPEN" value={genParams.sharpenStrength} min={0.1} max={5.0} step={0.1} onChange={v => setGenParams({ ...genParams, sharpenStrength: v })} accentColor="cyan" />
                                        <KButton onClick={() => runFilter('SHARPEN')} variant="secondary" className="w-full border-cyan-500/30 text-cyan-300">SHARPEN</KButton>
                                    </div>
                                    <div className="bg-[#111] p-3 rounded border border-[#222] space-y-4">
                                        <KSlider label="EMBOSS" value={genParams.embossStrength} min={0.5} max={5.0} step={0.1} onChange={v => setGenParams({ ...genParams, embossStrength: v })} accentColor="amber" />
                                        <KButton onClick={() => runFilter('EMBOSS')} variant="secondary" className="w-full border-amber-500/30 text-amber-300">EMBOSS</KButton>
                                    </div>
                                </div>

                                {/* HSL */}
                                <div className="bg-[#111] p-3 rounded border border-[#222] space-y-4">
                                    <div className="text-[9px] font-bold text-gray-500 uppercase">HSL Adjust</div>
                                    <KSlider label="HUE SHIFT" value={genParams.hueShift} min={-0.5} max={0.5} step={0.01} onChange={v => setGenParams({ ...genParams, hueShift: v })} accentColor="rose" />
                                    <KSlider label="SATURATION" value={genParams.saturation} min={0} max={2.0} step={0.05} onChange={v => setGenParams({ ...genParams, saturation: v })} accentColor="emerald" />
                                    <KSlider label="LIGHTNESS" value={genParams.lightness} min={-0.5} max={0.5} step={0.01} onChange={v => setGenParams({ ...genParams, lightness: v })} accentColor="sky" />
                                    <KButton onClick={() => runFilter('HSL')} variant="primary" className="w-full bg-gradient-to-r from-rose-600 to-emerald-600 border-none">APPLY HSL</KButton>
                                </div>

                                <div className="grid grid-cols-2 gap-2">
                                    <div className="bg-[#111] p-3 rounded border border-[#222] space-y-4">
                                        <KSlider label="POSTERIZE" value={genParams.posterizeLevels} min={2} max={16} step={1} onChange={v => setGenParams({ ...genParams, posterizeLevels: v })} accentColor="pink" />
                                        <KButton onClick={() => runFilter('POSTERIZE')} variant="secondary" className="w-full border-pink-500/30 text-pink-300">POSTERIZE</KButton>
                                    </div>
                                    <div className="bg-[#111] p-3 rounded border border-[#222] space-y-4">
                                        <KSlider label="THRESHOLD" value={genParams.thresholdValue} min={0} max={1.0} step={0.01} onChange={v => setGenParams({ ...genParams, thresholdValue: v })} accentColor="white" />
                                        <KButton onClick={() => runFilter('THRESHOLD')} variant="secondary" className="w-full border-white/30 text-white">THRESHOLD</KButton>
                                    </div>
                                </div>
                            </KSection>
                        </div>
                    )}

                    {/* EXPORT TAB */}
                    {activeTab === 'export' && (
                        <div className="space-y-6 animate-in slide-in-from-right-4">
                            <KSection title="OUTPUT PIPELINE" icon={Package}>
                                <div className="bg-[#111] p-4 rounded border border-[#222] space-y-4">
                                    <div className="text-[10px] text-gray-400 font-bold mb-2">FINAL COMPOSITE</div>
                                    <KButton onClick={() => handleExport('PNG')} variant="secondary" className="w-full border-[#333] hover:border-white py-4">
                                        <ImageIcon size={16} className="mr-2" /> DOWNLOAD PNG
                                    </KButton>
                                    <KButton onClick={() => handleExport('JPEG')} variant="secondary" className="w-full border-[#333] hover:border-white py-4">
                                        <Download size={16} className="mr-2" /> DOWNLOAD JPEG
                                    </KButton>
                                </div>
                                <div className="bg-[#111] p-4 rounded border border-[#222] space-y-4">
                                    <div className="text-[10px] text-gray-400 font-bold mb-2">KERNEL STORAGE</div>
                                    <KButton onClick={() => handleExport('ALPHA')} variant="primary" className="w-full bg-rose-600 border-rose-500 hover:bg-rose-500 py-4 shadow-[0_0_20px_rgba(244,63,94,0.3)]">
                                        <UploadCloud size={16} className="mr-2" /> COMMIT AS ALPHA
                                    </KButton>
                                </div>
                                <div className="bg-[#111] p-4 rounded border border-[#222] space-y-4">
                                    <div className="text-[10px] text-gray-400 font-bold mb-2">EXTERNAL APPS</div>
                                    <KButton onClick={() => handleExport('SAMPLE')} variant="secondary" className="w-full border-indigo-500/30 hover:border-indigo-400 hover:bg-indigo-900/20 text-indigo-300 py-4 shadow-[0_0_15px_rgba(99,102,241,0.15)] transition-all duration-300">
                                        <Share2 size={16} className="mr-2" /> SEND TO K-SAMPLE
                                    </KButton>
                                </div>
                            </KSection>
                        </div>
                    )}

                </div>
            </KPanel>
        </div>
    );
}
