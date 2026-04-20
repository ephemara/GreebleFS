
import React from 'react';
import { useKernelApp } from './hooks/useKernelApp';
import { useAppSettings } from './hooks/useAppSettings';
import { ALL_MODULES, WORKFLOW, CATEGORY_CONFIG } from './config/appConfig';
import BootSequence from './components/BootSequence';
import ProjectSelector from './components/ProjectSelector';
import AssetBrowser from './components/AssetBrowser';
import {
    Hexagon, HardDrive, Activity, Skull, X, Check, Settings,
    Power, Key, Gauge, Save, FolderOpen, Maximize, Minus, Square
} from 'lucide-react';

import { getCurrentWindow } from '@tauri-apps/api/window';
import { getZenAppDefinition, resolveViewportHostModuleId, useZenGlobalControls } from './core/zen';
import { useZenWorkspaceStore } from './core/zen/store';

// Import large UI components inline for now (can be extracted later)
// SettingsModal and AssetBrowser are very large - keeping them here for now
// but the structure is now modular and ready for further extraction

export default function App() {
    const kernel = useKernelApp();
    const settings = useAppSettings();
    const activateZenModule = useZenWorkspaceStore((state) => state.activateModule);
    const zenWorkspace = useZenWorkspaceStore((state) => state.document);
    const advanceSequencer = useZenWorkspaceStore((state) => state.advanceSequencer);

    useZenGlobalControls();

    React.useEffect(() => {
        activateZenModule(settings.activeModuleId as any);
    }, [activateZenModule, settings.activeModuleId]);

    React.useEffect(() => {
        let frameId = 0;
        let lastTick = performance.now();

        const tick = (now: number) => {
            const deltaSeconds = (now - lastTick) / 1000;
            lastTick = now;
            advanceSequencer(deltaSeconds);
            frameId = requestAnimationFrame(tick);
        };

        frameId = requestAnimationFrame(tick);

        return () => {
            cancelAnimationFrame(frameId);
        };
    }, [advanceSequencer]);

    if (settings.bootSequence) {
        return <BootSequence />;
    }

    const BridgeProps = {
        activeEntityDocument: zenWorkspace.entities.find((entity) => entity.id === zenWorkspace.activeEntityId) ?? null,
        activeLayerDocument: zenWorkspace.layers.find((layer) => layer.id === zenWorkspace.activeLayerId) ?? null,
        activeMaterialDocument: zenWorkspace.materials.find((material) => material.id === zenWorkspace.activeMaterialId)
            ?? kernel.kernelMaterials.find((material) => material.id === zenWorkspace.activeMaterialId)
            ?? null,
        sharedState: {
            artifact: kernel.getActiveArtifactBlob(),
            activeArtifactId: zenWorkspace.activeAssetId ?? kernel.activeArtifactId,
            activeEntityId: zenWorkspace.activeEntityId,
            activeLayerId: zenWorkspace.activeLayerId,
            activeMaterialId: zenWorkspace.activeMaterialId,
            activeEntity: zenWorkspace.entities.find((entity) => entity.id === zenWorkspace.activeEntityId) ?? null,
            activeLayer: zenWorkspace.layers.find((layer) => layer.id === zenWorkspace.activeLayerId) ?? null,
            activeMaterial: zenWorkspace.materials.find((material) => material.id === zenWorkspace.activeMaterialId)
                ?? kernel.kernelMaterials.find((material) => material.id === zenWorkspace.activeMaterialId)
                ?? null,
            materials: kernel.kernelMaterials,
            alphas: kernel.kernelAlphas,
            status: kernel.kernelStatus,
            storage: kernel.kernelArtifacts
        },
        onCommit: kernel.handleCommitToKernel,
        onMaterialCommit: kernel.handleMaterialCommit,
        onAlphaCommit: kernel.handleAlphaCommit,
        performance: settings.perfSettings,
        tempImage: kernel.tempImage,
        setTempImage: kernel.setTempImage,
        switchModule: settings.switchModule,
        zenWorkspace: kernel.zenWorkspace
    };

    const handleNewProject = () => {
        kernel.handleNewProject();
        settings.setShowProjectSelector(false);
    };

    const handleLoadProject = async (file: File) => {
        settings.setIsProjectLoading(true);
        const success = await kernel.handleLoadProject(file);
        settings.setIsProjectLoading(false);
        if (success) {
            settings.setShowProjectSelector(false);
        }
    };

    const categorizedArtifacts = () => {
        const groups: Record<string, typeof kernel.kernelArtifacts> = {};
        kernel.kernelArtifacts.forEach(art => {
            const cat = CATEGORY_CONFIG[art.source] ? art.source : 'IMPORT';
            if (!groups[cat]) groups[cat] = [];
            groups[cat].push(art);
        });
        return groups;
    };

    const isTransparentMode = false;

    return (
        // Main app container - background handled by individual components
        <div className="w-full h-full min-w-0 min-h-0 text-[#e0e0e0] font-mono overflow-hidden flex flex-col relative" style={{ backgroundColor: isTransparentMode ? 'transparent' : '#050505' }}>

            <ProjectSelector
                isOpen={settings.showProjectSelector}
                isProjectLoading={settings.isProjectLoading}
                onNewProject={handleNewProject}
                onLoadProject={handleLoadProject}
            />

            {/* K-OS HYPERVISOR BAR */}
            <header className={`h-24 ${isTransparentMode ? 'bg-[#0a0a0a]' : 'bg-[#0a0a0a]/80'} backdrop-blur-xl border-b border-[#222] flex items-center justify-center relative z-[50] select-none shadow-2xl overflow-hidden`}>

                {/* DRAG HANDLE OVERLAY - Full header size, lowest z-index */}
                <div
                    onMouseDown={() => getCurrentWindow().startDragging()}
                    className="absolute inset-0 z-0 cursor-move"
                />

                {/* BACKGROUND FLARE */}
                <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#333] to-transparent opacity-50 pointer-events-none" />
                <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-[#00ffcc]/20 to-transparent opacity-30" />

                {/* ANCHORED LEFT: LOGO */}
                <div
                    className="absolute left-6 flex items-center gap-3 text-white font-bold tracking-widest cursor-pointer hover:opacity-80 transition-opacity group"
                    onClick={() => settings.setIsSettingsOpen(true)}
                >
                    <div className="absolute inset-0 bg-[#00ffcc]/20 blur-xl opacity-0 group-hover:opacity-100 transition-opacity" />
                    <Hexagon size={28} className="text-[#00ffcc] fill-[#00ffcc]/10 relative z-10" />
                    <span className="text-xl relative z-10">K_OS</span>
                </div>

                {/* CENTERED WORKFLOW CONTAINER */}
                <div className="relative z-10 flex flex-1 min-w-0 items-center justify-center px-[112px]">
                <div className="flex max-w-full min-w-0 items-center gap-4 overflow-x-auto px-4 no-scrollbar">

                    {/* LEFT GROUP: CREATION */}
                    <div className="flex items-center gap-1 p-1.5 bg-[#0f0f0f]/50 rounded-full border border-[#222]">
                        {/* MODELING (Index 0) */}
                        <div className="flex items-center px-4 py-1.5 border-r border-[#222]/50 last:border-0">
                            <span className={`text-[10px] font-black uppercase writing-vertical-lr opacity-30 mr-3 tracking-tighter ${WORKFLOW[0].color}`}>MOD</span>
                            <div className="flex gap-1.5">
                                {WORKFLOW[0].modules.map(mod => (
                                    <button
                                        key={mod.id}
                                        onClick={() => settings.switchModule(mod.id)}
                                        className={`
                                         relative px-4 py-2 rounded text-xs font-bold transition-all duration-300
                                         ${settings.activeModuleId === mod.id
                                                ? `bg-[#222] text-white shadow-[0_0_15px_rgba(255,255,255,0.05)] ring-1 ring-inset ${WORKFLOW[0].color.replace('text', 'ring')}`
                                                : 'text-gray-600 hover:text-white hover:bg-[#222]'}
                                     `}
                                        style={settings.activeModuleId === mod.id ? { color: 'white' } : {}}
                                    >
                                        <span className={settings.activeModuleId === mod.id ? WORKFLOW[0].color : ''}>
                                            {mod.name.replace('K-', '')}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* UV (Index 1) */}
                        <div className="flex items-center px-4 py-1.5 border-r border-[#222]/50 last:border-0">
                            <span className={`text-[10px] font-black uppercase writing-vertical-lr opacity-30 mr-3 tracking-tighter ${WORKFLOW[1].color}`}>UV</span>
                            <div className="flex gap-1.5">
                                {WORKFLOW[1].modules.map(mod => (
                                    <button
                                        key={mod.id}
                                        onClick={() => settings.switchModule(mod.id)}
                                        className={`
                                         relative px-4 py-2 rounded text-xs font-bold transition-all duration-300
                                         ${settings.activeModuleId === mod.id
                                                ? `bg-[#222] text-white shadow-[0_0_15px_rgba(255,255,255,0.05)] ring-1 ring-inset ${WORKFLOW[1].color.replace('text', 'ring')}`
                                                : 'text-gray-600 hover:text-white hover:bg-[#222]'}
                                     `}
                                    >
                                        <span className={settings.activeModuleId === mod.id ? WORKFLOW[1].color : ''}>
                                            {mod.name.replace('K-', '')}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* SURFACE (Index 2) */}
                        <div className="flex items-center px-4 py-1.5">
                            <span className={`text-[10px] font-black uppercase writing-vertical-lr opacity-30 mr-3 tracking-tighter ${WORKFLOW[2].color}`}>SUR</span>
                            <div className="flex gap-1.5">
                                {WORKFLOW[2].modules.map(mod => (
                                    <button
                                        key={mod.id}
                                        onClick={() => settings.switchModule(mod.id)}
                                        className={`
                                         relative px-4 py-2 rounded text-xs font-bold transition-all duration-300
                                         ${settings.activeModuleId === mod.id
                                                ? `bg-[#222] text-white shadow-[0_0_15px_rgba(255,255,255,0.05)] ring-1 ring-inset ${WORKFLOW[2].color.replace('text', 'ring')}`
                                                : 'text-gray-600 hover:text-white hover:bg-[#222]'}
                                     `}
                                    >
                                        <span className={settings.activeModuleId === mod.id ? WORKFLOW[2].color : ''}>
                                            {mod.name.replace('K-', '')}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* VIEWPORT MODE */}
                    <div className="relative z-10 flex items-center gap-1 p-1 bg-[#111] rounded-full border border-[#333]">
                        <div className="px-4 py-2 rounded-full text-[10px] font-bold bg-[#00ffcc] text-black shadow-[0_0_15px_rgba(0,255,204,0.3)]">
                            UNIFIED
                        </div>
                    </div>

                    {/* HERO STORAGE */}
                    <div className="relative z-10 group">
                        <div className="absolute inset-0 bg-[#00ffcc]/5 rounded-full blur-xl opacity-0 group-hover:opacity-100 transition-duration-500" />

                        <button
                            onClick={kernel.openAssetBrowser}
                            className={`
                                relative flex items-center gap-5 px-10 py-4 rounded-full border transition-all duration-500
                                ${kernel.isAssetBrowserOpen
                                    ? 'bg-[#000] border-[#00ffcc] shadow-[0_0_40px_rgba(0,255,204,0.2)]'
                                    : 'bg-[#0a0a0a] border-[#333] hover:border-[#555]'}
                            `}
                        >
                            <HardDrive size={20} className={`text-[#00ffcc] transition-transform duration-300 ${kernel.isAssetBrowserOpen ? 'scale-110' : 'group-hover:scale-110'}`} />

                            <div className="flex flex-col items-start leading-none">
                                <span className="text-[11px] text-gray-500 font-bold tracking-widest mb-1">KERNEL STORAGE</span>
                                <div className="flex items-center gap-2">
                                    <span className={`text-sm font-black tracking-wider ${kernel.isAssetBrowserOpen ? 'text-white' : 'text-gray-400'}`}>
                                        ACCESS DATA
                                    </span>
                                    <span className="text-[10px] px-2 rounded bg-[#222] text-[#00ffcc] font-mono">
                                        {kernel.kernelArtifacts.length}
                                    </span>
                                </div>
                            </div>

                            {/* Status Dot */}
                            <div className={`w-2.5 h-2.5 rounded-full ${kernel.kernelStatus === 'READY' ? 'bg-[#00ffcc] shadow-[0_0_12px_#00ffcc]' : 'bg-yellow-500'} animate-pulse`} />
                        </button>
                    </div>

                    {/* RIGHT GROUP: SIMULATION */}
                    <div className="flex items-center gap-1 p-1.5 bg-[#0f0f0f]/50 rounded-full border border-[#222]">

                        {/* ANIM (Index 3) */}
                        <div className="flex items-center px-4 py-1.5 border-r border-[#222]/50 last:border-0">
                            <span className={`text-[10px] font-black uppercase writing-vertical-lr opacity-30 mr-3 tracking-tighter ${WORKFLOW[3].color}`}>ANIM</span>
                            <div className="flex gap-1.5">
                                {WORKFLOW[3].modules.map(mod => (
                                    <button
                                        key={mod.id}
                                        onClick={() => settings.switchModule(mod.id)}
                                        className={`
                                         relative px-4 py-2 rounded text-xs font-bold transition-all duration-300
                                         ${settings.activeModuleId === mod.id
                                                ? `bg-[#222] text-white shadow-[0_0_15px_rgba(255,255,255,0.05)] ring-1 ring-inset ${WORKFLOW[3].color.replace('text', 'ring')}`
                                                : 'text-gray-600 hover:text-white hover:bg-[#222]'}
                                     `}
                                    >
                                        <span className={settings.activeModuleId === mod.id ? WORKFLOW[3].color : ''}>
                                            {mod.name.replace('K-', '')}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* SIM (Index 5) */}
                        <div className="flex items-center px-4 py-1.5 border-r border-[#222]/50 last:border-0">
                            <span className={`text-[10px] font-black uppercase writing-vertical-lr opacity-30 mr-3 tracking-tighter ${WORKFLOW[5].color}`}>SIM</span>
                            <div className="flex gap-1.5">
                                {WORKFLOW[5].modules.map(mod => (
                                    <button
                                        key={mod.id}
                                        onClick={() => settings.switchModule(mod.id)}
                                        className={`
                                         relative px-4 py-2 rounded text-xs font-bold transition-all duration-300
                                         ${settings.activeModuleId === mod.id
                                                ? `bg-[#222] text-white shadow-[0_0_15px_rgba(255,255,255,0.05)] ring-1 ring-inset ${WORKFLOW[5].color.replace('text', 'ring')}`
                                                : 'text-gray-600 hover:text-white hover:bg-[#222]'}
                                     `}
                                    >
                                        <span className={settings.activeModuleId === mod.id ? WORKFLOW[5].color : ''}>
                                            {mod.name.replace('K-', '')}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* RENDER (Index 4) */}
                        <div className="flex items-center px-4 py-1.5 border-r border-[#222]/50 last:border-0">
                            <span className={`text-[10px] font-black uppercase writing-vertical-lr opacity-30 mr-3 tracking-tighter ${WORKFLOW[4].color}`}>RNDR</span>
                            <div className="flex gap-1.5">
                                {WORKFLOW[4].modules.map(mod => (
                                    <button
                                        key={mod.id}
                                        onClick={() => settings.switchModule(mod.id)}
                                        className={`
                                         relative px-4 py-2 rounded text-xs font-bold transition-all duration-300
                                         ${settings.activeModuleId === mod.id
                                                ? `bg-[#222] text-white shadow-[0_0_15px_rgba(255,255,255,0.05)] ring-1 ring-inset ${WORKFLOW[4].color.replace('text', 'ring')}`
                                                : 'text-gray-600 hover:text-white hover:bg-[#222]'}
                                     `}
                                    >
                                        <span className={settings.activeModuleId === mod.id ? WORKFLOW[4].color : ''}>
                                            {mod.name.replace('K-', '')}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {WORKFLOW[6] && (
                            <div className="flex items-center px-4 py-1.5">
                                <span className={`text-[10px] font-black uppercase writing-vertical-lr opacity-30 mr-3 tracking-tighter ${WORKFLOW[6].color}`}>DEV</span>
                                <div className="flex gap-1.5">
                                    {WORKFLOW[6].modules.map(mod => (
                                        <button
                                            key={mod.id}
                                            onClick={() => settings.switchModule(mod.id)}
                                            className={`
                                             relative px-4 py-2 rounded text-xs font-bold transition-all duration-300
                                             ${settings.activeModuleId === mod.id
                                                    ? `bg-[#222] text-white shadow-[0_0_15px_rgba(255,255,255,0.05)] ring-1 ring-inset ${WORKFLOW[6].color.replace('text', 'ring')}`
                                                    : 'text-gray-600 hover:text-white hover:bg-[#222]'}
                                         `}
                                        >
                                            <span className={settings.activeModuleId === mod.id ? WORKFLOW[6].color : ''}>
                                                {mod.name.replace('K-', '')}
                                            </span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
                </div>

                {/* ANCHORED RIGHT: KILL SWITCH */}
                {settings.persistenceEnabled && settings.visitedModules.size > 1 && (
                    <button
                        onClick={(e) => { e.stopPropagation(); settings.handleKillTasks(e as any); }}
                        className="absolute right-6 p-2.5 rounded-full bg-red-500/10 text-red-500 border border-red-500/30 hover:bg-red-500 hover:text-black transition-all animate-in fade-in zoom-in duration-300"
                        title="Kill Background Processes"
                    >
                        <Skull size={18} />
                    </button>
                )}
                {/* WINDOW CONTROLS - Top Right */}
                <div className="absolute right-0 top-0 h-full flex items-center z-[100] pr-4">
                    <div className="flex items-center gap-1 h-10">
                        <button onClick={() => getCurrentWindow().minimize()} className="p-2 hover:bg-white/10 rounded text-gray-400 hover:text-white transition-colors">
                            <Minus size={16} />
                        </button>
                        <button onClick={() => getCurrentWindow().toggleMaximize()} className="p-2 hover:bg-white/10 rounded text-gray-400 hover:text-white transition-colors">
                            <Square size={14} />
                        </button>
                        <button onClick={() => getCurrentWindow().close()} className="p-2 hover:bg-red-500 rounded text-gray-400 hover:text-white transition-colors">
                            <X size={16} />
                        </button>
                    </div>
                </div>
            </header>

            {/* SETTINGS MODAL - Keeping inline for now due to size */}
            {settings.isSettingsOpen && (
                <div className="absolute inset-0 z-[100] bg-black/60 backdrop-blur-xl flex items-center justify-center animate-in fade-in duration-200">
                    <div className="w-[550px] bg-[#0a0a0a] border border-[#333] rounded-2xl shadow-2xl overflow-hidden relative">
                        <button onClick={() => settings.setIsSettingsOpen(false)} className="absolute top-4 right-4 text-gray-500 hover:text-white"><X size={20} /></button>

                        <div className="p-6 border-b border-[#222] bg-gradient-to-r from-[#0a0a0a] to-[#111]">
                            <div className="flex items-center gap-3 mb-2">
                                <div className="p-2 rounded-lg bg-[#00ffcc]/10 border border-[#00ffcc]/30">
                                    <Settings size={24} className="text-[#00ffcc]" />
                                </div>
                                <div>
                                    <h2 className="text-xl font-black text-white tracking-widest">KIPP ENGINE CONFIG</h2>
                                    <p className="text-[10px] text-gray-500 font-mono">v9.0.2 // SECURE HYPERVISOR</p>
                                </div>
                            </div>
                        </div>

                        <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
                            {/* API CONFIG */}
                            <div className="flex items-center justify-between p-4 bg-[#111] rounded-xl border border-[#222]">
                                <div className="flex items-center gap-4">
                                    <div className={`p-3 rounded-full ${settings.hasApiKey ? 'bg-purple-500/20 text-purple-400' : 'bg-gray-800 text-gray-500'}`}>
                                        <Key size={20} />
                                    </div>
                                    <div>
                                        <div className="text-sm font-bold text-gray-200">API UPLINK</div>
                                        <div className="text-[10px] text-gray-500 mt-0.5">{settings.hasApiKey ? "SECURE CONNECTION ACTIVE" : "DISCONNECTED"}</div>
                                    </div>
                                </div>
                                <button
                                    onClick={settings.handleConnectApi}
                                    className={`px-4 py-2 rounded text-[10px] font-bold border transition-all ${settings.hasApiKey ? 'bg-purple-900/20 border-purple-500 text-purple-400' : 'bg-gray-800 border-gray-600 text-gray-400 hover:text-white'}`}
                                >
                                    {settings.hasApiKey ? "CONNECTED" : "CONNECT KEY"}
                                </button>
                            </div>

                            {/* PERFORMANCE TUNING */}
                            <div className="p-4 bg-[#111] rounded-xl border border-[#222] space-y-4">
                                <div className="flex items-center gap-4 border-b border-[#222] pb-3 mb-2">
                                    <div className={`p-3 rounded-full bg-blue-500/20 text-blue-400`}>
                                        <Gauge size={20} />
                                    </div>
                                    <div>
                                        <div className="text-sm font-bold text-gray-200">HYPERVISOR PERFORMANCE</div>
                                        <div className="text-[10px] text-gray-500 mt-0.5">Optimize engine throughput vs fidelity</div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-3 gap-2">
                                    {['ECO', 'BALANCED', 'ULTRA'].map((m) => (
                                        <button
                                            key={m}
                                            onClick={() => settings.applyPerfPreset(m as any)}
                                            className={`py-2 text-[10px] font-bold border rounded transition-all ${settings.perfSettings.mode === m ? 'bg-blue-600 text-white border-blue-500' : 'bg-[#1a1a1a] border-[#333] text-gray-500 hover:text-white'}`}
                                        >
                                            {m}
                                        </button>
                                    ))}
                                </div>

                                <div className="space-y-3">
                                    <div className="space-y-1">
                                        <div className="flex justify-between text-[10px] text-gray-400 font-bold">
                                            <span>RESOLUTION SCALE</span>
                                            <span className="text-blue-400">{settings.perfSettings.resolution.toFixed(2)}x</span>
                                        </div>
                                        <input
                                            type="range" min="0.25" max="2.0" step="0.25"
                                            value={settings.perfSettings.resolution}
                                            onChange={(e) => settings.setPerfSettings({ ...settings.perfSettings, resolution: parseFloat(e.target.value), mode: 'CUSTOM' })}
                                            className="w-full h-1 bg-[#222] rounded-lg appearance-none accent-blue-500"
                                        />
                                    </div>

                                    <div className="grid grid-cols-2 gap-2">
                                        <button onClick={() => settings.setPerfSettings({ ...settings.perfSettings, shadows: !settings.perfSettings.shadows, mode: 'CUSTOM' })} className={`py-2 px-3 rounded text-[9px] font-bold border flex justify-between items-center transition-all ${settings.perfSettings.shadows ? 'bg-blue-900/20 border-blue-500 text-blue-400' : 'bg-[#1a1a1a] border-[#333] text-gray-500'}`}>
                                            SHADOWS {settings.perfSettings.shadows ? <Check size={12} /> : <X size={12} />}
                                        </button>
                                        <button onClick={() => settings.setPerfSettings({ ...settings.perfSettings, postFX: !settings.perfSettings.postFX, mode: 'CUSTOM' })} className={`py-2 px-3 rounded text-[9px] font-bold border flex justify-between items-center transition-all ${settings.perfSettings.postFX ? 'bg-blue-900/20 border-blue-500 text-blue-400' : 'bg-[#1a1a1a] border-[#333] text-gray-500'}`}>
                                            POST-FX {settings.perfSettings.postFX ? <Check size={12} /> : <X size={12} />}
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center justify-between p-4 bg-[#111] rounded-xl border border-[#222]">
                                <div className="flex items-center gap-4">
                                    <div className={`p-3 rounded-full ${settings.persistenceEnabled ? 'bg-green-500/20 text-green-400' : 'bg-gray-800 text-gray-500'}`}>
                                        <Power size={20} />
                                    </div>
                                    <div>
                                        <div className="text-sm font-bold text-gray-200">PERSISTENCE STATE</div>
                                        <div className="text-[10px] text-gray-500 mt-0.5">Keep modules active in background. (High Memory)</div>
                                    </div>
                                </div>
                                <button
                                    onClick={() => settings.setPersistenceEnabled(!settings.persistenceEnabled)}
                                    className={`w-12 h-6 rounded-full p-1 transition-all ${settings.persistenceEnabled ? 'bg-[#00ffcc]' : 'bg-[#333]'}`}
                                >
                                    <div className={`w-4 h-4 bg-black rounded-full shadow transition-transform ${settings.persistenceEnabled ? 'translate-x-6' : 'translate-x-0'}`} />
                                </button>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <button
                                    onClick={kernel.handleSaveProject}
                                    className="p-3 bg-[#111] hover:bg-[#222] rounded-lg border border-[#222] flex items-center justify-center gap-2 transition-all hover:border-[#00ffcc]/50 group"
                                >
                                    <Save size={16} className="text-gray-400 group-hover:text-[#00ffcc]" />
                                    <span className="text-xs font-bold text-gray-300 group-hover:text-white">SAVE PROJECT</span>
                                </button>

                                <button
                                    onClick={() => { settings.setShowProjectSelector(true); settings.setIsSettingsOpen(false); }}
                                    className="p-3 bg-[#111] hover:bg-[#222] rounded-lg border border-[#222] flex items-center justify-center gap-2 transition-all hover:border-purple-500/50 group"
                                >
                                    <FolderOpen size={16} className="text-gray-400 group-hover:text-purple-400" />
                                    <span className="text-xs font-bold text-gray-300 group-hover:text-white">SWITCH PROJECT</span>
                                </button>
                            </div>

                            <div className="text-[9px] text-gray-600 text-center font-mono pt-4 border-t border-[#222]">
                                kipp engine // 0.5 alpha
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <AssetBrowser
                isOpen={kernel.isAssetBrowserOpen}
                browserTab={kernel.browserTab}
                artifacts={kernel.kernelArtifacts}
                materials={kernel.kernelMaterials}
                alphas={kernel.kernelAlphas}
                selectedArtifactIds={kernel.selectedArtifactIds}
                activeArtifactId={kernel.activeArtifactId}
                previewArtifactId={kernel.previewArtifactId}
                isImporting={kernel.isImporting}
                isMerging={kernel.isMerging}
                openFolders={kernel.openFolders}
                onClose={() => kernel.setIsAssetBrowserOpen(false)}
                onTabChange={kernel.setBrowserTab}
                onToggleFolder={(cat) => kernel.setOpenFolders(prev => ({ ...prev, [cat]: !prev[cat] }))}
                onArtifactClick={kernel.setPreviewArtifactId}
                onArtifactSelect={kernel.toggleArtifactSelection}
                onArtifactWeld={kernel.toggleArtifactWeld}
                onArtifactDownload={kernel.handleDownloadArtifact}
                onArtifactDelete={kernel.handleDeleteArtifact}
                onMountArtifact={kernel.setActiveArtifactId}
                onUnmountArtifact={() => kernel.setActiveArtifactId(null)}
                onDeselectAll={() => kernel.setSelectedArtifactIds([])}
                onMerge={kernel.handleMergeArtifacts}
                onImport={kernel.processFileImport}
                onAlphaImport={kernel.processAlphaImport}
                onMaterialDelete={kernel.handleDeleteMaterial}
                onAlphaDelete={kernel.handleDeleteAlpha}
            />

            {/* ACTIVE LOGIC LAYER */}
            <main className="flex-1 relative bg-transparent overflow-hidden">
                {ALL_MODULES.map(mod => {
                    const activeModuleId = settings.activeModuleId as any;
                    const activeModuleDefinition = getZenAppDefinition(activeModuleId);
                    const usesUniversalViewportShell = Boolean(activeModuleDefinition?.usesUniversalViewport);
                    const viewportOwnerId = (usesUniversalViewportShell
                        ? resolveViewportHostModuleId(activeModuleId)
                        : zenWorkspace.activeViewportModuleId) as any;
                    const isActive = mod.id === activeModuleId;
                    const isViewportOwner = usesUniversalViewportShell && mod.id === viewportOwnerId;
                    let shouldRender = false;
                    let isVisible = false;
                    let zenShellMode: 'standalone' | 'viewport-host' | 'tool-overlay' = 'standalone';

                    if (usesUniversalViewportShell) {
                        shouldRender = isActive || isViewportOwner;
                        isVisible = shouldRender;

                        if (isViewportOwner && !isActive) {
                            zenShellMode = 'viewport-host';
                        }

                        if (isActive && !isViewportOwner) {
                            zenShellMode = 'tool-overlay';
                        }
                    } else {
                        if (!settings.persistenceEnabled) {
                            shouldRender = isActive;
                            isVisible = true;
                        } else {
                            shouldRender = settings.visitedModules.has(mod.id);
                            isVisible = isActive;
                        }
                    }

                    if (!shouldRender) return null;

                    // Cast component to ElementType to avoid JSX type error with strict TS
                    const Component = mod.component as React.ElementType;

                    return (
                        <div
                            key={mod.id}
                            className="absolute inset-0 w-full h-full"
                            style={{
                                display: isVisible ? 'block' : 'none',
                                zIndex: zenShellMode === 'tool-overlay' ? 20 : 10
                            }}
                        >
                            <Component
                                {...BridgeProps}
                                performance={settings.perfSettings}
                                zenShellMode={zenShellMode}
                                zenViewportOwnerId={viewportOwnerId}
                            />
                        </div>
                    );
                })}
            </main>

            {/* GLOBAL CONTENT BROWSER */}
            <GlobalContentBrowserBridge kernel={kernel} settings={settings} />
        </div>
    );
}

// Extract bridge to keep main App clean/performant
import KContentBrowser from './core/ui/KContentBrowser/KContentBrowser';
import { useContentBrowser } from './core/ui/KContentBrowser/useContentBrowser';

function GlobalContentBrowserBridge({ kernel, settings }: { kernel: any, settings: any }) {
    const { isOpen, close, toggle } = useContentBrowser();

    const handleOpenInApp = (appId: string, item: any) => {
        // Switch Module
        settings.switchModule(appId);

        // TODO: Signal the app to load this item?
        // For now, user can drag-drop once in the app, or we can add a 'pendingLoad' state later.

        close();
    };

    const handleDelete = (item: any) => {
        if (item.type === 'MESH') kernel.handleDeleteArtifact(item.id);
        else if (item.type === 'MAT') kernel.handleDeleteMaterial(item.id);
        else if (item.type === 'ALPHA') kernel.handleDeleteAlpha(item.id);
    };

    return (
        <KContentBrowser
            isOpen={isOpen}
            onClose={close}
            onDropAsset={(item: any) => {
                console.log("Double Clicked Asset:", item);
            }}
            onImport={kernel.processFileImport}
            artifacts={kernel.kernelArtifacts}
            materials={kernel.kernelMaterials}
            alphas={kernel.kernelAlphas}
            onOpenInApp={handleOpenInApp}
            onDelete={handleDelete}
        />
    );
}
