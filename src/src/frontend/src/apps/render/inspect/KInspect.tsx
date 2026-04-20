
import React, { useState, useEffect, useRef } from 'react';
import * as THREE from 'three';
import { 
  Scan, Activity, Aperture, Sliders, Workflow, 
  Database, Box, CheckCircle2, UploadCloud, FileOutput,
  Maximize, AlertTriangle, X, Image as ImageIcon, Waves
} from 'lucide-react';
import { HighFidelityRenderer, RenderSettings } from '../../../core/render/HighFidelityRenderer';
import { ExchangeSystem, EXPORT_PRESETS } from '../../../core/io/ExchangeSystem';

const MAP_SLOTS = [
    { key: 'map', label: 'ALBEDO', icon: <ImageIcon size={10}/>, srgb: true },
    { key: 'normalMap', label: 'NORMAL', icon: <Activity size={10}/>, srgb: false },
    { key: 'roughnessMap', label: 'ROUGH', icon: <Waves size={10}/>, srgb: false },
    { key: 'metalnessMap', label: 'METAL', icon: <Box size={10}/>, srgb: false },
    { key: 'emissiveMap', label: 'EMIT', icon: <Aperture size={10}/>, srgb: true },
];

export default function KInspect({ sharedState }: any) {
    // UI State
    const [activeTab, setActiveTab] = useState('inspector');
    const [loading, setLoading] = useState(false);
    const [dragging, setDragging] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [status, setStatus] = useState("IDLE");
    
    // Model Data
    const [modelStats, setModelStats] = useState<any>(null);
    const [hierarchy, setHierarchy] = useState<any[]>([]);
    const [materials, setMaterials] = useState<any[]>([]);
    const [selectedUuid, setSelectedUuid] = useState<string | null>(null);

    // Export State
    const [targetPreset, setTargetPreset] = useState('GENERIC');
    const [targetFormat, setTargetFormat] = useState('GLB');
    const [isExporting, setIsExporting] = useState(false);

    // Render Settings
    const [settings, setSettings] = useState<RenderSettings>({
        exposure: 1.0,
        bloomStrength: 0.4,
        bloomRadius: 0.5,
        bloomThreshold: 0.85,
        rayTracing: false,
        autoRotate: false,
        wireframe: false,
        grid: true,
        clayMode: false
    });

    const mountRef = useRef<HTMLCanvasElement>(null);
    const engineRef = useRef<HighFidelityRenderer | null>(null);
    const textureLoader = useRef(new THREE.TextureLoader());

    // --- INITIALIZATION ---
    useEffect(() => {
        if (!mountRef.current) return;
        
        // 1. Ignite Engine
        const engine = new HighFidelityRenderer(mountRef.current);
        engineRef.current = engine;

        // 2. Initial Settings Apply
        engine.updateSettings(settings);

        // 3. Handle Resize
        const handleResize = () => engine.resize();
        window.addEventListener('resize', handleResize);
        
        // Force resize shortly after mount to catch layout shifts
        setTimeout(() => engine.resize(), 100);

        // 4. Load Kernel Artifact if present
        if (sharedState?.artifact) {
            // Small delay to ensure engine is ready
            setTimeout(() => {
                processFile(new File([sharedState.artifact], "Kernel_Artifact.glb"));
            }, 200);
        }

        return () => {
            window.removeEventListener('resize', handleResize);
            engine.dispose();
        };
    }, []);

    // --- SYNC SETTINGS ---
    useEffect(() => {
        if (engineRef.current) engineRef.current.updateSettings(settings);
    }, [settings]);

    // --- CORE LOGIC ---
    const processFile = async (file: File) => {
        setLoading(true);
        setStatus(`LOADING ${file.name.toUpperCase()}...`);
        
        try {
            const rawGroup = await ExchangeSystem.import(file);
            // Normalize Geometry (Center & Scale)
            const { object, meta } = ExchangeSystem.normalize(rawGroup);
            // Sanitize Materials (Standard Material Upgrade)
            ExchangeSystem.sanitizeMaterials(object);
            
            const engine = engineRef.current;
            if (engine) {
                engine.modelGroup.clear();
                engine.modelGroup.add(object);
                
                // Analyze
                scanScene(object);
                setModelStats({
                    name: file.name,
                    polyCount: meta.polyCount || 0, // Normalize calculates this? Or we calc here.
                    originalScale: meta.originalSize
                });
            }
            setStatus("ASSET MOUNTED");
        } catch (e: any) {
            console.error(e);
            setError(e.message);
            setStatus("LOAD FAILED");
        } finally {
            setLoading(false);
        }
    };

    const scanScene = (root: THREE.Object3D) => {
        const mats: any = {};
        const hier: any[] = [];
        let polys = 0;

        const processNode = (node: any, depth: number) => {
            if (node.isMesh) {
                polys += node.geometry.index ? node.geometry.index.count/3 : node.geometry.attributes.position.count/3;
            }
            hier.push({
                uuid: node.uuid,
                name: node.name || `Object_${node.id}`,
                type: node.type,
                depth: depth,
                visible: node.visible
            });
            if (node.children) node.children.forEach((c: any) => processNode(c, depth + 1));
        };
        processNode(root, 0);
        setHierarchy(hier);
        setModelStats(prev => ({...prev, polyCount: Math.floor(polys)}));

        root.traverse((c: any) => {
            if (c.isMesh && c.material) {
                const ms = Array.isArray(c.material) ? c.material : [c.material];
                ms.forEach((m: any) => {
                    if (!mats[m.uuid]) {
                        mats[m.uuid] = m;
                        m.userData.previews = {};
                        // Cache color for reset?
                        // Generate thumbnails
                    }
                });
            }
        });
        setMaterials(Object.values(mats));
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setDragging(false);
        if (e.dataTransfer.files[0]) processFile(e.dataTransfer.files[0]);
    };

    const handleUniversalExport = async () => {
        const engine = engineRef.current;
        if (!engine || engine.modelGroup.children.length === 0) return;
        
        setIsExporting(true);
        setStatus("PACKING ASSET...");
        
        try {
            const blob = await ExchangeSystem.export(engine.modelGroup.children[0], targetPreset, targetFormat);
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${modelStats?.name || 'Asset'}_[${targetPreset}].${targetFormat.toLowerCase()}`;
            a.click();
            setStatus("EXPORT COMPLETE");
        } catch (e: any) {
            setError("EXPORT FAILED: " + e.message);
        } finally {
            setIsExporting(false);
        }
    };

    const updateMaterialValue = (uuid: string, prop: string, val: number) => {
        const mat = materials.find(m => m.uuid === uuid);
        if (mat) {
            mat[prop] = val;
            mat.needsUpdate = true;
            setMaterials([...materials]); // Trigger re-render
        }
    };

    return (
        <div className="flex h-full w-full bg-[#050505] text-gray-300 font-mono" onDrop={handleDrop} onDragOver={e=>e.preventDefault()} onDragEnter={()=>setDragging(true)} onDragLeave={()=>setDragging(false)}>
            
            {/* LEFT PANEL */}
            <div className="w-80 bg-[#0a0a0a] border-r border-[#1a1a1a] flex flex-col z-20 shadow-2xl">
                <div className="p-4 border-b border-[#222] bg-[#111]">
                    <h1 className="font-bold text-xl tracking-tighter text-white flex items-center gap-2"><Scan size={18} className="text-[#00ffcc]"/> K-INSPECT</h1>
                </div>
                
                <div className="flex border-b border-[#222]">
                    {['inspector', 'materials', 'export'].map(tab => (
                        <button key={tab} onClick={()=>setActiveTab(tab)} className={`flex-1 py-3 text-[10px] font-bold uppercase ${activeTab===tab?'text-[#00ffcc] border-b-2 border-[#00ffcc] bg-[#1a1a1a]':'text-gray-500'}`}>
                            {tab}
                        </button>
                    ))}
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar">
                    {/* INSPECTOR TAB */}
                    {activeTab === 'inspector' && (
                        <div className="space-y-6 animate-in slide-in-from-left-4">
                            <div className="bg-[#111] p-3 rounded border border-[#222] space-y-2">
                                <div className="text-[9px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2"><Activity size={10}/> Metrics</div>
                                {modelStats ? (
                                    <>
                                        <div className="flex justify-between text-[10px] text-gray-400"><span>Name</span><span className="text-white truncate max-w-[120px]">{modelStats.name}</span></div>
                                        <div className="flex justify-between text-[10px] text-gray-400"><span>Polys</span><span className="text-orange-400 font-mono">{modelStats.polyCount?.toLocaleString()}</span></div>
                                    </>
                                ) : <div className="text-[10px] text-gray-600 italic">No model loaded</div>}
                            </div>

                            <div className="space-y-3">
                                <div className="text-[9px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2"><Aperture size={10}/> Lens</div>
                                <div><div className="flex justify-between text-[10px] text-gray-400 mb-1">Exposure</div><input type="range" min="0" max="3" step="0.1" value={settings.exposure} onChange={e=>setSettings({...settings, exposure:parseFloat(e.target.value)})} className="w-full h-1 bg-[#222] rounded accent-[#00ffcc]"/></div>
                                <div><div className="flex justify-between text-[10px] text-gray-400 mb-1">Bloom</div><input type="range" min="0" max="2" step="0.1" value={settings.bloomStrength} onChange={e=>setSettings({...settings, bloomStrength:parseFloat(e.target.value)})} className="w-full h-1 bg-[#222] rounded accent-[#00ffcc]"/></div>
                                <button onClick={()=>setSettings({...settings, rayTracing:!settings.rayTracing})} className={`w-full py-2 border rounded text-[9px] font-bold flex items-center justify-center gap-2 transition-all ${settings.rayTracing ? 'bg-purple-600 text-white border-purple-500' : 'border-[#222] text-gray-500'}`}>
                                    <Activity size={12} className={settings.rayTracing ? "animate-pulse" : ""} /> RAY TRACING
                                </button>
                            </div>
                        </div>
                    )}

                    {/* MATERIALS TAB */}
                    {activeTab === 'materials' && (
                        <div className="space-y-4 animate-in slide-in-from-left-4">
                            <div className="text-[9px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2"><CheckCircle2 size={10}/> Material Slots</div>
                            <div className="space-y-4">
                                {materials.map((mat, i) => (
                                    <div key={mat.uuid} className="bg-[#111] border border-[#222] rounded p-3">
                                        <div className="flex items-center gap-2 mb-2 pb-2 border-b border-[#222]">
                                            <div className="w-3 h-3 rounded-full border border-[#444]" style={{background: `#${mat.color.getHexString()}`}} />
                                            <span className="text-[10px] font-bold text-white flex-1 truncate">{mat.name || `Material_${i}`}</span>
                                        </div>
                                        <div className="space-y-1">
                                            <div className="flex justify-between text-[8px] text-gray-500"><span>ROUGHNESS</span><span>{mat.roughness.toFixed(2)}</span></div>
                                            <input type="range" min="0" max="1" step="0.01" value={mat.roughness} onChange={(e)=>updateMaterialValue(mat.uuid, 'roughness', parseFloat(e.target.value))} className="w-full h-1 bg-[#222] rounded accent-[#00ffcc]"/>
                                            <div className="flex justify-between text-[8px] text-gray-500"><span>METALNESS</span><span>{mat.metalness.toFixed(2)}</span></div>
                                            <input type="range" min="0" max="1" step="0.01" value={mat.metalness} onChange={(e)=>updateMaterialValue(mat.uuid, 'metalness', parseFloat(e.target.value))} className="w-full h-1 bg-[#222] rounded accent-[#00ffcc]"/>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* EXPORT TAB */}
                    {activeTab === 'export' && (
                        <div className="space-y-6 animate-in slide-in-from-left-4">
                            <div className="bg-[#111] p-3 rounded border border-[#222] space-y-3">
                                <div className="text-[9px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2"><Sliders size={10}/> Target Preset</div>
                                <div className="grid grid-cols-2 gap-2">
                                    {Object.entries(EXPORT_PRESETS).map(([k, v]: any) => (
                                        <button key={k} onClick={()=>setTargetPreset(k)} className={`p-2 rounded border text-left transition-all ${targetPreset===k?'bg-[#00ffcc]/20 border-[#00ffcc] text-[#00ffcc]':'bg-[#0a0a0a] border-[#222] text-gray-500 hover:border-gray-500'}`}>
                                            <div className="flex items-center gap-2 mb-1"><v.icon size={12}/><span className="text-[9px] font-bold">{k}</span></div>
                                            <div className="text-[7px] opacity-70 leading-tight">{v.desc}</div>
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div className="space-y-2">
                                <div className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">Format</div>
                                <div className="flex bg-[#111] rounded border border-[#222] p-1">
                                    {['GLB', 'OBJ', 'USDZ', 'STL', 'PLY'].map(f => (
                                        <button key={f} onClick={()=>setTargetFormat(f)} className={`flex-1 py-1.5 rounded text-[8px] font-bold ${targetFormat===f?'bg-[#00ffcc] text-black':'text-gray-500 hover:text-white'}`}>{f}</button>
                                    ))}
                                </div>
                            </div>
                            <button onClick={handleUniversalExport} disabled={isExporting} className="w-full py-3 bg-[#00ffcc] hover:bg-[#00eebb] text-black font-bold text-[10px] tracking-widest rounded shadow-[0_0_15px_rgba(0,255,204,0.3)] flex items-center justify-center gap-2 disabled:opacity-50 transition-all">
                                {isExporting ? <UploadCloud size={14} className="animate-bounce"/> : <FileOutput size={14}/>}
                                {isExporting ? 'PROCESSING...' : 'EXPORT ASSET'}
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* MAIN VIEWPORT */}
            <div className="flex-1 relative bg-[#050505]">
                {/* CANVAS */}
                <canvas ref={mountRef} className="w-full h-full block outline-none" />
                
                {/* TOP HEADER */}
                <div className="absolute top-4 left-4 z-10 pointer-events-none">
                    <div className="text-[#00ffcc] font-bold text-xs tracking-widest border-l-2 border-[#00ffcc] pl-2 flex items-center gap-2 bg-black/50 p-1 rounded-r">
                        <Maximize size={12}/> KIPP INSPECT <span className="text-gray-500 text-[9px]">{status}</span>
                    </div>
                </div>

                {/* LOADING */}
                {loading && (
                    <div className="absolute inset-0 bg-black/80 z-50 flex items-center justify-center">
                        <div className="text-center">
                            <div className="w-8 h-8 border-2 border-[#00ffcc] border-t-transparent rounded-full animate-spin mx-auto mb-2"/>
                            <div className="text-[#00ffcc] text-[10px] font-bold tracking-widest animate-pulse">PROCESSING DATA STREAM...</div>
                        </div>
                    </div>
                )}

                {/* DRAG OVERLAY */}
                {dragging && (
                    <div className="absolute inset-0 bg-[#00ffcc]/10 border-4 border-[#00ffcc] border-dashed z-50 flex items-center justify-center backdrop-blur-sm pointer-events-none">
                        <div className="text-[#00ffcc] font-bold text-xl tracking-widest flex flex-col items-center gap-2">
                            <UploadCloud size={48} className="animate-bounce"/>
                            DROP ASSET TO LOAD
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
