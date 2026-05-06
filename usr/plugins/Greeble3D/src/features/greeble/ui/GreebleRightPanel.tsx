import { useState } from 'react';
import { Settings, Download, Sun, MonitorPlay, Camera } from 'lucide-react';
import UniversalLayerPanel from './UniversalLayerPanel';
import KGreebleMats from '../KGreebleMats';
import KGreebleFlux from '../KGreebleFlux';
import KGreebleDeformPanel from '../KGreebleDeformPanel';

interface RightPanelProps {
    layers: any[];
    activeLayerId: string;
    setActiveLayerId: (id: string) => void;
    selectedLayerIds: Set<string>;
    setSelectedLayerIds: (ids: Set<string>) => void;
    addLayer: () => void;
    updateLayer: (id: string, updates: any) => void;
    deleteLayer: (id: string) => void;
    duplicateLayer: (id: string) => void;
    mergeLayer: (id: string) => void;
    mergeSelectedLayers: () => void;
    toggleLayerVisibility: (id: string) => void;
    setLayerSolo: (id: string) => void;
    selectLayerObject: (id: string) => void;
    materialLibrary: any[];
    commitMaterial: any;
    handleTextureUploadClick: () => void;
    handleTextureUpload: (e: any) => void;
    textureInputRef: any;
    matParams: any;
    setMatParams: (params: any) => void;
    graphicsQuality: string;
    setGraphicsQuality: (quality: any) => void;
    sunIntensity: number;
    setSunIntensity: (intensity: number) => void;
    sunAngle: number;
    setSunAngle: (angle: number) => void;
    handleSetEnvMap: (url: string) => void;
    targetEngine: string;
    setTargetEngine: (engine: string) => void;
    mergeOnExport: boolean;
    setMergeOnExport: (merge: boolean) => void;
    includeBase: boolean;
    setIncludeBase: (include: boolean) => void;
    handleExport: (mode: string, format: string) => void;
    handleHDSnapshot: () => void;
}

export function GreebleRightPanel(props: RightPanelProps) {
    const [activeTab, setActiveTab] = useState('layers');

    return (
        <div className="h-full flex flex-col overflow-hidden">
            {/* Tab Selector */}
            <div className="flex-none p-2 bg-[#0a0a0a] border-b border-[#222]">
                <div className="flex gap-1 bg-[#050505] p-1 rounded-lg border border-[#1a1a1a]">
                    <button 
                        onClick={() => setActiveTab('layers')} 
                        className={`flex-1 py-2 rounded-md text-[9px] font-bold transition-all ${
                            activeTab === 'layers' ? 'bg-yellow-600 text-white shadow-lg shadow-yellow-900/50' : 'text-gray-500 hover:bg-[#1a1a1a] hover:text-gray-300'
                        }`}
                    >
                        LAYERS
                    </button>
                    <button 
                        onClick={() => setActiveTab('deform')} 
                        className={`flex-1 py-2 rounded-md text-[9px] font-bold transition-all ${
                            activeTab === 'deform' ? 'bg-orange-600 text-white shadow-lg shadow-orange-900/50' : 'text-gray-500 hover:bg-[#1a1a1a] hover:text-gray-300'
                        }`}
                    >
                        DEFORM
                    </button>
                    <button 
                        onClick={() => setActiveTab('mats')} 
                        className={`flex-1 py-2 rounded-md text-[9px] font-bold transition-all ${
                            activeTab === 'mats' ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/50' : 'text-gray-500 hover:bg-[#1a1a1a] hover:text-gray-300'
                        }`}
                    >
                        MATS
                    </button>
                    <button 
                        onClick={() => setActiveTab('flux')} 
                        className={`flex-1 py-2 rounded-md text-[9px] font-bold transition-all ${
                            activeTab === 'flux' ? 'bg-red-600 text-white shadow-lg shadow-red-900/50' : 'text-gray-500 hover:bg-[#1a1a1a] hover:text-gray-300'
                        }`}
                    >
                        FLUX
                    </button>
                    <button 
                        onClick={() => setActiveTab('scene')} 
                        className={`flex-1 py-2 rounded-md text-[9px] font-bold transition-all ${
                            activeTab === 'scene' ? 'bg-purple-600 text-white shadow-lg shadow-purple-900/50' : 'text-gray-500 hover:bg-[#1a1a1a] hover:text-gray-300'
                        }`}
                    >
                        SCENE
                    </button>
                    <button 
                        onClick={() => setActiveTab('export')} 
                        className={`flex-1 py-2 rounded-md text-[9px] font-bold transition-all ${
                            activeTab === 'export' ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/50' : 'text-gray-500 hover:bg-[#1a1a1a] hover:text-gray-300'
                        }`}
                    >
                        EXPORT
                    </button>
                </div>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden custom-scrollbar">
                {activeTab === 'layers' && (
                    <UniversalLayerPanel
                        layers={props.layers}
                        activeLayerId={props.activeLayerId}
                        onSelect={(id, opts) => {
                            props.selectLayerObject(id);
                            // Only set as active layer if NOT multi-selecting
                            if (!opts?.ctrl && !opts?.shift) {
                                props.setActiveLayerId(id);
                            }
                        }}
                        onToggleVisibility={props.toggleLayerVisibility}
                        onDelete={props.deleteLayer}
                        onAdd={props.addLayer}
                        onDuplicate={props.duplicateLayer}
                        onMergeLayer={props.mergeLayer}
                        onMergeSelected={props.mergeSelectedLayers}
                        selectedLayerIds={props.selectedLayerIds}
                        onSelectionChange={props.setSelectedLayerIds}
                        onRename={(id, name) => props.updateLayer(id, { name })}
                        onLock={(id) => props.updateLayer(id, { locked: !props.layers.find((l:any) => l.id === id)?.locked })}
                        onSolo={props.setLayerSolo}
                        features={{
                            add: true,
                            delete: true,
                            visibility: true,
                            rename: true,
                            lock: true,
                            solo: true,
                            duplicate: true,
                            contextMenu: true,
                            colorLabels: true,
                            mergeSelected: true,
                            reorder: true
                        }}
                        accentColor="orange"
                        title="STRATA"
                    />
                )}

                {activeTab === 'deform' && (
                    <div className="p-4">
                        <KGreebleDeformPanel
                            deformParams={props.layers.find((l: any) => l.id === props.activeLayerId)?.deform || {}}
                            setDeformParams={(params: any) => props.updateLayer(props.activeLayerId, { deform: params })}
                            activeLayerName={props.layers.find((l: any) => l.id === props.activeLayerId)?.name || "Layer"}
                        />
                    </div>
                )}

                {activeTab === 'mats' && (
                    <KGreebleMats
                        materialLibrary={props.materialLibrary}
                        commitMaterial={props.commitMaterial}
                        handleTextureUploadClick={props.handleTextureUploadClick}
                        handleTextureUpload={props.handleTextureUpload}
                        textureInputRef={props.textureInputRef}
                        matParams={props.matParams}
                        setMatParams={props.setMatParams}
                        layers={props.layers}
                        activeLayerId={props.activeLayerId}
                    />
                )}

                {activeTab === 'flux' && (
                    <KGreebleFlux
                        activeLayerId={props.activeLayerId}
                        layers={props.layers}
                        updateLayer={props.updateLayer}
                    />
                )}

                {activeTab === 'scene' && (
                    <div className="p-4 space-y-4">
                        <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2 mb-2">
                            <Sun size={12} /> Global Environment
                        </div>

                        {/* Graphics Quality */}
                        <div className="bg-[#161616] p-4 rounded-xl border border-gray-800 space-y-3">
                            <div className="text-[10px] font-bold text-gray-400 uppercase mb-2 flex items-center gap-2 tracking-wider">
                                <MonitorPlay size={12} /> Graphics Quality
                            </div>
                            <div className="grid grid-cols-5 gap-1">
                                {['low', 'medium', 'high', 'extreme', 'rt'].map(q => (
                                    <button 
                                        key={q} 
                                        onClick={() => props.setGraphicsQuality(q)}
                                        className={`py-2 rounded text-[8px] font-bold uppercase transition-all ${
                                            props.graphicsQuality === q ? 'bg-white text-black' : 'bg-[#0a0a0a] text-gray-500 hover:text-gray-300'
                                        } ${q === 'rt' ? 'text-purple-500 hover:text-purple-400' : ''}`}
                                    >
                                        {q}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Lighting Controls */}
                        <div className="bg-[#161616] p-4 rounded-xl border border-yellow-900/30 space-y-3">
                            <div className="text-[10px] font-bold text-yellow-500 uppercase mb-2 flex items-center gap-2 tracking-wider">
                                <Sun size={12} /> Lighting
                            </div>
                            <div>
                                <div className="flex justify-between text-[10px] text-gray-400 mb-1 font-bold">
                                    SUN INTENSITY <span className="text-yellow-400">{props.sunIntensity.toFixed(1)}</span>
                                </div>
                                <input 
                                    type="range" 
                                    min="0" 
                                    max="5" 
                                    step="0.1" 
                                    value={props.sunIntensity} 
                                    onChange={e => props.setSunIntensity(parseFloat(e.target.value))} 
                                    className="w-full h-1 bg-[#0a0a0a] rounded-lg appearance-none accent-yellow-400" 
                                />
                            </div>
                            <div>
                                <div className="flex justify-between text-[10px] text-gray-400 mb-1 font-bold">
                                    SOLAR ANGLE <span className="text-orange-400">{props.sunAngle}°</span>
                                </div>
                                <input 
                                    type="range" 
                                    min="0" 
                                    max="360" 
                                    step="1" 
                                    value={props.sunAngle} 
                                    onChange={e => props.setSunAngle(parseFloat(e.target.value))} 
                                    className="w-full h-1 bg-[#0a0a0a] rounded-lg appearance-none accent-orange-400" 
                                />
                            </div>
                        </div>

                        {/* HDR Skybox Generator - DISABLED */}
                        {/* <div className="bg-[#161616] p-4 rounded-xl border border-blue-900/30 space-y-3">
                            <div className="text-[10px] font-bold text-blue-500 uppercase mb-2 flex items-center gap-2 tracking-wider">
                                <Cloud size={12} /> Auto-HDR Skybox
                            </div>
                            <KAutopbrHDR onApply={props.handleSetEnvMap} allowExport={false} />
                        </div> */}
                    </div>
                )}

                {activeTab === 'export' && (
                    <div className="p-4 space-y-4">
                        <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2 mb-2">
                            <Settings size={12} /> Export Configuration
                        </div>

                        {/* Snapshot Button */}
                        <div className="p-2 border border-[#222] bg-[#161616] rounded-lg flex items-center justify-between">
                            <div className="text-[9px] font-bold text-gray-500 flex items-center gap-2">
                                <Camera size={10} /> CAPTURE SCENE
                            </div>
                            <button 
                                onClick={props.handleHDSnapshot}
                                className="w-8 h-8 bg-[#222] hover:bg-[#333] border border-[#333] hover:border-gray-500 rounded flex items-center justify-center text-white transition-all shadow-lg group"
                                title="Take HD Snapshot"
                            >
                                <div className="w-2 h-2 bg-red-500 rounded-full group-hover:bg-red-400 absolute mb-3 mr-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                                <Camera size={14} className="text-gray-400 group-hover:text-white" />
                            </button>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[9px] font-bold text-gray-500">TARGET ENGINE</label>
                            <div className="flex bg-[#161616] p-1 rounded border border-[#222]">
                                {['GENERIC', 'UNREAL', 'UNITY'].map(t => (
                                    <button 
                                        key={t} 
                                        onClick={() => props.setTargetEngine(t)} 
                                        className={`flex-1 py-1.5 rounded text-[8px] font-bold transition-all ${
                                            props.targetEngine === t ? 'bg-gray-700 text-white' : 'text-gray-500 hover:text-gray-300'
                                        }`}
                                    >
                                        {t}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="space-y-2">
                            <div className="flex items-center justify-between p-2 bg-[#161616] rounded border border-[#222]">
                                <span className="text-[9px] font-bold text-gray-400">WELD GEOMETRY</span>
                                <button 
                                    onClick={() => props.setMergeOnExport(!props.mergeOnExport)} 
                                    className={`w-8 h-4 rounded-full transition-colors ${
                                        props.mergeOnExport ? 'bg-emerald-600' : 'bg-gray-700'
                                    } relative`}
                                >
                                    <div 
                                        className="absolute top-0.5 w-3 h-3 bg-white rounded-full transition-transform" 
                                        style={{ left: props.mergeOnExport ? 'auto' : '2px', right: props.mergeOnExport ? '2px' : 'auto' }} 
                                    />
                                </button>
                            </div>
                            <div className="flex items-center justify-between p-2 bg-[#161616] rounded border border-[#222]">
                                <span className="text-[9px] font-bold text-gray-400">INCLUDE BASE MESH</span>
                                <button 
                                    onClick={() => props.setIncludeBase(!props.includeBase)} 
                                    className={`w-8 h-4 rounded-full transition-colors ${
                                        props.includeBase ? 'bg-emerald-600' : 'bg-gray-700'
                                    } relative`}
                                >
                                    <div 
                                        className="absolute top-0.5 w-3 h-3 bg-white rounded-full transition-transform" 
                                        style={{ left: props.includeBase ? 'auto' : '2px', right: props.includeBase ? '2px' : 'auto' }} 
                                    />
                                </button>
                            </div>
                        </div>

                        <div className="pt-4 border-t border-[#222]">
                            <div className="grid grid-cols-2 gap-2">
                                <button 
                                    onClick={() => props.handleExport('download', 'glb')} 
                                    className="bg-[#161616] hover:bg-[#222] text-gray-400 border border-[#222] py-3 rounded font-bold text-[10px] flex items-center justify-center gap-2 tracking-widest hover:text-white transition-colors shadow-lg"
                                >
                                    <Download size={14} /> .GLB
                                </button>
                                <button 
                                    onClick={() => props.handleExport('download', 'obj')} 
                                    className="bg-[#161616] hover:bg-[#222] text-gray-400 border border-[#222] py-3 rounded font-bold text-[10px] flex items-center justify-center gap-2 tracking-widest hover:text-white transition-colors shadow-lg"
                                >
                                    <Download size={14} /> .OBJ
                                </button>
                            </div>
                            <div className="mt-2 text-[8px] text-gray-600 text-center italic">
                                Exports current scene state. Animation included in GLB if present.
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
