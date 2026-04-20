import React from 'react';
import KLeftPanel from '../../../core/ui/KPanelV2/KLeftPanel';
import {
    Scale,
    Monitor,
    Sparkles,
    Wand2,
    Palette,
    Plus,
    Sun,
    Activity,
    Globe
} from 'lucide-react';
import { KHDRWidget } from '../../../core/ui/widgets/KHDRWidget';
import {
    TECTON_LANDSCAPE_RESOLUTION_OPTIONS,
    type TectonLandscapeResolution
} from './tectonLandscape';

type KTectonLeftTab = 'genesis' | 'solar' | 'landscape';

interface KTectonLeftPanelProps {
    isOpen: boolean;
    setIsOpen: (open: boolean) => void;
    activeTab: KTectonLeftTab;
    setActiveTab: (tab: KTectonLeftTab) => void;
    shellMode?: 'standalone' | 'tool-overlay';
    sizeX: number;
    setSizeX: (value: number) => void;
    sizeZ: number;
    setSizeZ: (value: number) => void;
    heightScale: number;
    setHeightScale: (value: number) => void;
    resolution: TectonLandscapeResolution;
    setResolution: (value: TectonLandscapeResolution) => void;
    seed: number;
    setSeed: (value: number) => void;
    prompt: string;
    setPrompt: (value: string) => void;
    isProcessing: boolean;
    generateTerrain: () => void;
    generateTexture: () => void;
    handleGenerateRandom: () => void;
    createLandscape: () => void;
    landscapeReady: boolean;
    landscapeLabel?: string;
    sunIntensity: number;
    setSunIntensity: (value: number) => void;
    sunAzimuth: number;
    setSunAzimuth: (value: number) => void;
    sunElevation: number;
    setSunElevation: (value: number) => void;
    scene: any;
    renderer: any;
}

export default function KTectonLeftPanel({
    isOpen,
    setIsOpen,
    activeTab,
    setActiveTab,
    shellMode = 'standalone',
    sizeX,
    setSizeX,
    sizeZ,
    setSizeZ,
    heightScale,
    setHeightScale,
    resolution,
    setResolution,
    seed,
    setSeed,
    prompt,
    setPrompt,
    isProcessing,
    generateTerrain,
    generateTexture,
    handleGenerateRandom,
    createLandscape,
    landscapeReady,
    landscapeLabel,
    sunIntensity,
    setSunIntensity,
    sunAzimuth,
    setSunAzimuth,
    sunElevation,
    setSunElevation,
    scene,
    renderer
}: KTectonLeftPanelProps) {
    const isToolOverlay = shellMode === 'tool-overlay';

    const actions = isToolOverlay
        ? [{
            id: 'landscape',
            label: 'LANDSCAPE',
            icon: Globe,
            onClick: () => {
                setActiveTab('landscape');
                if (!isOpen) setIsOpen(true);
            }
        }]
        : [
            {
                id: 'genesis',
                label: 'GENESIS',
                icon: Globe,
                onClick: () => {
                    setActiveTab('genesis');
                    if (!isOpen) setIsOpen(true);
                }
            },
            {
                id: 'solar',
                label: 'SOLAR',
                icon: Sun,
                onClick: () => {
                    setActiveTab('solar');
                    if (!isOpen) setIsOpen(true);
                }
            }
        ];

    const renderLandscapePanel = () => (
        <div className="space-y-5 animate-in fade-in slide-in-from-left-4 duration-300">
            <div className="rounded-xl border border-emerald-500/20 bg-[linear-gradient(180deg,rgba(16,185,129,0.12),rgba(5,5,5,0.92))] p-4">
                <div className="text-[10px] font-bold uppercase tracking-[0.35em] text-emerald-300">Create Landscape</div>
                <div className="mt-2 text-[18px] font-semibold text-white">Shared viewport terrain</div>
                <div className="mt-2 text-[11px] leading-relaxed text-gray-400">
                    UE5-style landscape creation for the universal viewport. Tecton now authors the active terrain
                    directly inside the shared scene host.
                </div>
                <div className="mt-3 rounded-lg border border-[#1f2937] bg-black/30 px-3 py-2 text-[10px] uppercase tracking-[0.25em] text-gray-300">
                    {landscapeReady ? `Viewport Subject: ${landscapeLabel ?? 'Landscape'}` : 'Viewport Subject: Pending Landscape'}
                </div>
            </div>

            <div className="space-y-4 rounded-lg border border-[#1a1a1a] bg-[#0a0a0a] p-4">
                <div className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Landscape Bounds</div>

                <div>
                    <div className="mb-2 flex justify-between text-[10px] font-medium text-gray-500">
                        Width (X) <span className="font-mono text-emerald-400">{sizeX}m</span>
                    </div>
                    <input
                        type="range"
                        min="1024"
                        max="16384"
                        step="1024"
                        value={sizeX}
                        onChange={(event) => setSizeX(Number(event.target.value))}
                        className="h-1 w-full cursor-pointer appearance-none rounded bg-[#222] accent-emerald-500"
                    />
                </div>

                <div>
                    <div className="mb-2 flex justify-between text-[10px] font-medium text-gray-500">
                        Depth (Z) <span className="font-mono text-emerald-400">{sizeZ}m</span>
                    </div>
                    <input
                        type="range"
                        min="1024"
                        max="16384"
                        step="1024"
                        value={sizeZ}
                        onChange={(event) => setSizeZ(Number(event.target.value))}
                        className="h-1 w-full cursor-pointer appearance-none rounded bg-[#222] accent-emerald-500"
                    />
                </div>

                <div>
                    <div className="mb-2 flex justify-between text-[10px] font-medium text-gray-500">
                        Elevation (Y) <span className="font-mono text-lime-400">{heightScale.toFixed(0)}m</span>
                    </div>
                    <input
                        type="range"
                        min="100"
                        max="25000"
                        step="100"
                        value={heightScale}
                        onChange={(event) => setHeightScale(Number(event.target.value))}
                        className="h-1 w-full cursor-pointer appearance-none rounded bg-[#222] accent-lime-400"
                    />
                </div>
            </div>

            <div className="space-y-3">
                <div className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Landscape Grid</div>
                <div className="grid grid-cols-3 gap-1 rounded border border-[#1a1a1a] bg-[#0a0a0a] p-1">
                    {TECTON_LANDSCAPE_RESOLUTION_OPTIONS.map((option) => (
                        <button
                            key={option}
                            onClick={() => setResolution(option)}
                            className={`rounded py-2 text-[10px] font-bold font-mono transition-all ${
                                resolution === option ? 'bg-emerald-600 text-white shadow-lg' : 'text-gray-500 hover:text-gray-300'
                            }`}
                        >
                            {option}
                        </button>
                    ))}
                </div>
            </div>

            <div className="space-y-3 border-t border-[#1a1a1a] pt-4">
                <div className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Landscape Seed</div>
                <div className="flex gap-2">
                    <input
                        type="number"
                        value={seed}
                        onChange={(event) => setSeed(Number(event.target.value))}
                        className="w-full rounded border border-[#222] bg-[#0a0a0a] px-3 py-2 text-[11px] text-gray-200 outline-none transition-colors focus:border-emerald-500/50"
                    />
                    <button
                        onClick={() => setSeed(Math.floor(Math.random() * 100000))}
                        className="rounded border border-[#222] bg-[#111] px-3 py-2 text-[10px] font-bold text-gray-300 transition-all hover:border-emerald-500 hover:text-emerald-400"
                    >
                        RANDOM
                    </button>
                </div>
            </div>

            <button
                onClick={createLandscape}
                className="w-full rounded-lg border border-emerald-500/50 bg-emerald-500/10 py-3 text-[10px] font-bold tracking-[0.3em] text-emerald-300 transition-all hover:bg-emerald-500 hover:text-black"
            >
                {landscapeReady ? 'REBUILD LANDSCAPE' : 'CREATE LANDSCAPE'}
            </button>
        </div>
    );

    return (
        <KLeftPanel
            isCollapsed={!isOpen}
            onCollapseChange={(collapsed) => setIsOpen(!collapsed)}
            actions={actions}
            currentActionId={isToolOverlay ? 'landscape' : activeTab}
        >
            <div className="space-y-6 p-4">
                {!isToolOverlay && (
                    <div className="mb-4 flex border-b border-[#222]">
                        {actions.map((action) => (
                            <button
                                key={action.id}
                                onClick={() => setActiveTab(action.id as KTectonLeftTab)}
                                className={`relative flex-1 py-2 text-[10px] font-bold uppercase tracking-wider transition-all ${
                                    activeTab === action.id ? 'text-white' : 'text-gray-500 hover:text-gray-300'
                                }`}
                            >
                                {action.label}
                                {activeTab === action.id && (
                                    <div className="absolute bottom-0 left-0 h-0.5 w-full bg-emerald-500 shadow-[0_0_8px_#10b981]" />
                                )}
                            </button>
                        ))}
                    </div>
                )}

                {isToolOverlay && renderLandscapePanel()}

                {!isToolOverlay && activeTab === 'genesis' && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-left-4 duration-300">
                        <div className="space-y-4 rounded-lg border border-[#1a1a1a] bg-[#0a0a0a] p-4">
                            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-gray-400">
                                <Scale size={12} /> World Dimensions
                            </div>

                            <div>
                                <div className="mb-2 flex justify-between text-[10px] font-medium text-gray-500">
                                    Width (X) <span className="font-mono text-emerald-400">{sizeX}m</span>
                                </div>
                                <input type="range" min="1024" max="16384" step="1024" value={sizeX} onChange={(event) => setSizeX(Number(event.target.value))} className="h-1 w-full cursor-pointer appearance-none rounded bg-[#222] accent-emerald-500" />
                            </div>
                            <div>
                                <div className="mb-2 flex justify-between text-[10px] font-medium text-gray-500">
                                    Depth (Z) <span className="font-mono text-emerald-400">{sizeZ}m</span>
                                </div>
                                <input type="range" min="1024" max="16384" step="1024" value={sizeZ} onChange={(event) => setSizeZ(Number(event.target.value))} className="h-1 w-full cursor-pointer appearance-none rounded bg-[#222] accent-emerald-500" />
                            </div>
                            <div>
                                <div className="mb-2 flex justify-between text-[10px] font-medium text-gray-500">
                                    Amplitude (Y) <span className="font-mono text-emerald-400">{heightScale.toFixed(0)}m</span>
                                </div>
                                <input type="range" min="100" max="25000" step="100" value={heightScale} onChange={(event) => setHeightScale(Number(event.target.value))} className="h-1 w-full cursor-pointer appearance-none rounded bg-[#222] accent-lime-400" />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-gray-400">
                                <Monitor size={12} /> Grid Density
                            </div>
                            <div className="grid grid-cols-3 gap-1 rounded border border-[#1a1a1a] bg-[#0a0a0a] p-1">
                                {TECTON_LANDSCAPE_RESOLUTION_OPTIONS.map((option) => (
                                    <button
                                        key={option}
                                        onClick={() => setResolution(option)}
                                        className={`rounded py-2 text-[10px] font-bold font-mono transition-all ${
                                            resolution === option ? 'bg-emerald-600 text-white shadow-lg' : 'text-gray-500 hover:text-gray-300'
                                        }`}
                                    >
                                        {option}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="space-y-3 border-t border-[#1a1a1a] pt-4">
                            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-gray-400">
                                <Sparkles size={12} /> Neural Forge
                            </div>
                            <div className="rounded border border-[#1a1a1a] bg-[#0a0a0a] p-3 transition-colors focus-within:border-emerald-500/50">
                                <textarea
                                    value={prompt}
                                    onChange={(event) => setPrompt(event.target.value)}
                                    className="h-16 w-full resize-none bg-transparent text-[11px] leading-relaxed text-gray-300 outline-none placeholder-gray-700"
                                    placeholder="Describe terrain (e.g., Eroded limestone canyon)..."
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <button onClick={generateTerrain} disabled={isProcessing} className="flex items-center justify-center gap-2 rounded border border-[#222] bg-[#111] py-3 text-[10px] font-bold text-gray-400 transition-all hover:border-emerald-500 hover:text-emerald-400">
                                    {isProcessing ? <Activity size={12} className="animate-spin" /> : <Wand2 size={12} />} GENERATE HEIGHT
                                </button>
                                <button onClick={generateTexture} disabled={isProcessing} className="flex items-center justify-center gap-2 rounded border border-[#222] bg-[#111] py-3 text-[10px] font-bold text-gray-400 transition-all hover:border-lime-500 hover:text-lime-400">
                                    {isProcessing ? <Activity size={12} className="animate-spin" /> : <Palette size={12} />} GENERATE ALBEDO
                                </button>
                            </div>
                        </div>

                        <div className="space-y-2 border-t border-[#1a1a1a] pt-4">
                            <button onClick={handleGenerateRandom} className="flex w-full items-center justify-center gap-2 rounded border border-[#222] bg-[#111] py-3 text-[10px] font-bold text-gray-300 transition-all hover:border-gray-600 hover:bg-[#161616]">
                                <Plus size={12} /> INJECT PERLIN NOISE
                            </button>
                        </div>
                    </div>
                )}

                {!isToolOverlay && activeTab === 'solar' && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-left-4 duration-300">
                        <div className="space-y-2 border-b border-[#222] pb-4">
                            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-gray-400">
                                <Sun size={12} /> Environment HDR
                            </div>
                            <KHDRWidget
                                scene={scene}
                                renderer={renderer}
                                defaultEnabled={true}
                            />
                        </div>

                        <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-gray-400">
                            <Sun size={12} /> Solar Position
                        </div>

                        <div className="space-y-6 rounded border border-[#1a1a1a] bg-[#0a0a0a] p-4">
                            <div className="space-y-2">
                                <div className="flex justify-between text-[10px] font-medium text-gray-500">
                                    Intensity <span className="font-mono text-emerald-400">{sunIntensity}</span>
                                </div>
                                <input type="range" min="0" max="5" step="0.1" value={sunIntensity} onChange={(event) => setSunIntensity(Number(event.target.value))} className="h-1 w-full cursor-pointer appearance-none rounded-lg bg-[#222] accent-emerald-500" />
                            </div>

                            <div className="space-y-2">
                                <div className="flex justify-between text-[10px] font-medium text-gray-500">
                                    Azimuth <span className="font-mono text-emerald-400">{sunAzimuth}°</span>
                                </div>
                                <input type="range" min="0" max="360" value={sunAzimuth} onChange={(event) => setSunAzimuth(Number(event.target.value))} className="h-1 w-full cursor-pointer appearance-none rounded-lg bg-[#222] accent-emerald-500" />
                            </div>

                            <div className="space-y-2">
                                <div className="flex justify-between text-[10px] font-medium text-gray-500">
                                    Elevation <span className="font-mono text-emerald-400">{sunElevation}°</span>
                                </div>
                                <input type="range" min="0" max="90" value={sunElevation} onChange={(event) => setSunElevation(Number(event.target.value))} className="h-1 w-full cursor-pointer appearance-none rounded-lg bg-[#222] accent-emerald-500" />
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </KLeftPanel>
    );
}
