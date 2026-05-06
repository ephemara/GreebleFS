import React from 'react';
import { Plus, MousePointer2, Film, Move, RefreshCcw, Maximize, Eye, EyeOff } from 'lucide-react';
import KGreeblePrimitives from '../KGreeblePrimitives';

interface LeftPanelProps {
    mode: string;
    setMode: (mode: any) => void;
    buildTab: string;
    setBuildTab: (tab: any) => void;
    activeShape: string;
    setActiveShape: (shape: string) => void;
    gizmoMode: string;
    setGizmoMode: (mode: any) => void;
    gizmoVisible?: boolean;
    setGizmoVisible?: (visible: boolean) => void;
    transformSpace: string;
    setTransformSpace: (space: any) => void;
    snapEnabled: boolean;
    setSnapEnabled: (enabled: boolean) => void;
    selectedObjectUUID: string | null;
    transformData: any;
    updateTransformFromUI: (key: string, value: number) => void;
    greebleParams: any;
    setGreebleParams: (params: any) => void;
    primitiveParams: any;
    setPrimitiveParams: (params: any) => void;
    titanParams: any;
    setTitanParams: (params: any) => void;
    userImports: any[];
    loadFromStorage: (item: any) => void;
    handleGlbImport?: (e: any) => void;
    sharedState: any;
}

export function GreebleLeftPanel(props: LeftPanelProps) {
    // Use local state as fallback if not provided via props
    const [localGizmoVisible, setLocalGizmoVisible] = React.useState(true);
    const gizmoVisible = props.gizmoVisible ?? localGizmoVisible;
    const setGizmoVisible = props.setGizmoVisible ?? setLocalGizmoVisible;
    
    return (
        <div className="h-full flex flex-col overflow-hidden">
            {/* Mode Selector */}
            <div className="flex-none p-2 bg-[#0a0a0a] border-b border-[#222]">
                <div className="flex gap-1 bg-[#050505] p-1 rounded-lg border border-[#1a1a1a]">
                    <button 
                        onClick={() => props.setMode('build')} 
                        className={`flex-1 py-2 rounded-md text-[10px] font-bold flex items-center justify-center gap-1.5 transition-all ${
                            props.mode === 'build' ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/50' : 'text-gray-500 hover:bg-[#1a1a1a] hover:text-gray-300'
                        }`}
                    >
                        <Plus size={12} /> BUILD
                    </button>
                    <button 
                        onClick={() => props.setMode('edit')} 
                        className={`flex-1 py-2 rounded-md text-[10px] font-bold flex items-center justify-center gap-1.5 transition-all ${
                            props.mode === 'edit' ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/50' : 'text-gray-500 hover:bg-[#1a1a1a] hover:text-gray-300'
                        }`}
                    >
                        <MousePointer2 size={12} /> EDIT
                    </button>
                    <button 
                        onClick={() => props.setMode('animate')} 
                        className={`flex-1 py-2 rounded-md text-[10px] font-bold flex items-center justify-center gap-1.5 transition-all ${
                            props.mode === 'animate' ? 'bg-pink-600 text-white shadow-lg shadow-pink-900/50' : 'text-gray-500 hover:bg-[#1a1a1a] hover:text-gray-300'
                        }`}
                    >
                        <Film size={12} /> ANIM
                    </button>
                </div>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden custom-scrollbar p-4 pb-32 space-y-6">
                {props.mode === 'build' && (
                    <>
                        {/* Build Sub-Tabs */}
                        <div className="flex-none bg-[#050505] p-1 rounded-lg border border-[#1a1a1a] gap-1 grid grid-cols-2">
                            {/* <button 
                                onClick={() => props.setBuildTab('GREEBLE')} 
                                className={`py-2 rounded-md text-[9px] font-bold transition-all ${
                                    props.buildTab === 'GREEBLE' ? 'bg-emerald-600 text-white shadow-md' : 'text-gray-500 hover:bg-[#1a1a1a] hover:text-gray-300'
                                }`}
                            >
                                GREEBLE
                            </button> */}
                        </div>

                        {/* Build Content - Pure primitives, no tabs needed */}
                        {/* {props.buildTab === 'GREEBLE' && (
                            <KGreebleGenerator 
                                activeShape={props.activeShape}
                                setActiveShape={props.setActiveShape}
                                greebleParams={props.greebleParams}
                                setGreebleParams={props.setGreebleParams}
                            />
                        )} */}

                        <KGreeblePrimitives
                            activeShape={props.activeShape}
                            setActiveShape={props.setActiveShape}
                            primitiveParams={props.primitiveParams}
                            setPrimitiveParams={props.setPrimitiveParams}
                            userImports={props.userImports}
                            handleGlbImport={props.handleGlbImport}
                        />

                        {/* {props.buildTab === 'XENO' && (
                            <KGreebleXeno
                                titanParams={props.titanParams}
                                setTitanParams={props.setTitanParams}
                                activateTool={() => props.setActiveShape('XENO_TITAN')}
                                isActive={props.activeShape === 'XENO_TITAN'}
                            />
                        )} */}
                    </>
                )}

                {props.mode === 'edit' && (
                    <section className="space-y-4">
                        <div className="text-[10px] font-bold text-blue-500 uppercase mb-3 flex items-center gap-2 tracking-wider">
                            <Move size={12} /> Transform Matrix
                        </div>

                        {/* Gizmo Mode Selector */}
                        <div className="bg-[#0b0b0b] rounded-xl border border-white/10 overflow-hidden">
                            <div className="p-3 border-b border-white/10 bg-[#070707]">
                                <div className="flex items-center gap-0.5 rounded-lg bg-black/50 border border-white/10 p-0.5">
                                    <button
                                        onClick={() => props.setGizmoMode('translate')}
                                        className={`h-7 px-2 rounded-md text-[9px] font-black tracking-wide flex items-center gap-1.5 transition-all ${
                                            props.gizmoMode === 'translate' ? 'bg-white/10 text-white' : 'text-gray-400 hover:text-white'
                                        }`}
                                    >
                                        <Move size={12} /> MOVE
                                    </button>
                                    <button
                                        onClick={() => props.setGizmoMode('rotate')}
                                        className={`h-7 px-2 rounded-md text-[9px] font-black tracking-wide flex items-center gap-1.5 transition-all ${
                                            props.gizmoMode === 'rotate' ? 'bg-white/10 text-white' : 'text-gray-400 hover:text-white'
                                        }`}
                                    >
                                        <RefreshCcw size={12} /> ROT
                                    </button>
                                    <button
                                        onClick={() => props.setGizmoMode('scale')}
                                        className={`h-7 px-2 rounded-md text-[9px] font-black tracking-wide flex items-center gap-1.5 transition-all ${
                                            props.gizmoMode === 'scale' ? 'bg-white/10 text-white' : 'text-gray-400 hover:text-white'
                                        }`}
                                    >
                                        <Maximize size={12} /> SCALE
                                    </button>
                                </div>
                                <div className="flex items-center gap-2 mt-2">
                                    <button
                                        onClick={() => setGizmoVisible(!gizmoVisible)}
                                        className={`h-7 px-3 text-[9px] font-black tracking-widest border border-white/10 rounded transition-all flex items-center gap-1.5 ${
                                            gizmoVisible ? 'text-emerald-200 bg-emerald-500/10' : 'bg-black/40 text-gray-400 hover:text-white'
                                        }`}
                                    >
                                        {gizmoVisible ? <Eye size={12} /> : <EyeOff size={12} />}
                                        GIZMO
                                    </button>
                                    <button
                                        onClick={() => props.setTransformSpace(props.transformSpace === 'world' ? 'local' : 'world')}
                                        className="h-7 px-3 text-[9px] font-black tracking-widest border border-white/10 bg-black/40 rounded text-gray-400 hover:text-white transition-all"
                                    >
                                        {props.transformSpace.toUpperCase()}
                                    </button>
                                    <button
                                        onClick={() => props.setSnapEnabled(!props.snapEnabled)}
                                        className={`h-7 px-3 text-[9px] font-black tracking-widest border border-white/10 rounded transition-all ${
                                            props.snapEnabled ? 'text-cyan-200 bg-cyan-500/10' : 'bg-black/40 text-gray-400 hover:text-white'
                                        }`}
                                    >
                                        SNAP: {props.snapEnabled ? 'ON' : 'OFF'}
                                    </button>
                                </div>
                            </div>

                            <div className="p-4">
                                {!props.selectedObjectUUID ? (
                                    <div className="p-6 text-center text-[11px] font-bold text-gray-500 border border-dashed border-white/10 rounded-xl bg-black/20">
                                        Select an object to transform.
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {props.gizmoMode === 'translate' && ['X', 'Y', 'Z'].map(axis => (
                                            <div key={`pos${axis}`} className="grid grid-cols-[64px_1fr_auto] items-center gap-3">
                                                <div className={`text-[10px] font-black tracking-wider ${
                                                    axis === 'X' ? 'text-red-400' : axis === 'Y' ? 'text-green-400' : 'text-blue-400'
                                                }`}>
                                                    POS {axis}
                                                </div>
                                                <input 
                                                    type="range" 
                                                    min="-100" 
                                                    max="100" 
                                                    step="0.1" 
                                                    value={props.transformData[`pos${axis}`]} 
                                                    onChange={(e) => props.updateTransformFromUI(`pos${axis}`, parseFloat(e.target.value))} 
                                                    className="w-full h-1 bg-[#0a0a0a] rounded-lg appearance-none accent-white" 
                                                />
                                                <input 
                                                    type="number" 
                                                    value={props.transformData[`pos${axis}`].toFixed(2)} 
                                                    onChange={(e) => props.updateTransformFromUI(`pos${axis}`, parseFloat(e.target.value))} 
                                                    className={`w-[72px] h-8 rounded-md border border-white/10 bg-[#070707] px-2 text-[11px] font-black tracking-wide outline-none ${
                                                        axis === 'X' ? 'text-red-200' : axis === 'Y' ? 'text-green-200' : 'text-blue-200'
                                                    }`} 
                                                />
                                            </div>
                                        ))}
                                        {props.gizmoMode === 'rotate' && ['X', 'Y', 'Z'].map(axis => (
                                            <div key={`rot${axis}`} className="grid grid-cols-[64px_1fr_auto] items-center gap-3">
                                                <div className="text-[10px] font-black tracking-wider text-emerald-400">ROT {axis}</div>
                                                <input 
                                                    type="range" 
                                                    min="0" 
                                                    max="360" 
                                                    step="1" 
                                                    value={((props.transformData[`rot${axis}`] * 180) / Math.PI)} 
                                                    onChange={(e) => props.updateTransformFromUI(`rot${axis}`, (parseFloat(e.target.value) * Math.PI) / 180)} 
                                                    className="w-full h-1 bg-[#0a0a0a] rounded-lg appearance-none accent-emerald-400" 
                                                />
                                                <input 
                                                    type="number" 
                                                    value={((props.transformData[`rot${axis}`] * 180) / Math.PI).toFixed(0)} 
                                                    onChange={(e) => props.updateTransformFromUI(`rot${axis}`, (parseFloat(e.target.value) * Math.PI) / 180)} 
                                                    className="w-[72px] h-8 rounded-md border border-white/10 bg-[#070707] px-2 text-[11px] font-black tracking-wide text-emerald-200 outline-none" 
                                                />
                                            </div>
                                        ))}
                                        {props.gizmoMode === 'scale' && ['X', 'Y', 'Z'].map(axis => (
                                            <div key={`scale${axis}`} className="grid grid-cols-[64px_1fr_auto] items-center gap-3">
                                                <div className="text-[10px] font-black tracking-wider text-purple-400">SCL {axis}</div>
                                                <input 
                                                    type="range" 
                                                    min="0.01" 
                                                    max="10" 
                                                    step="0.01" 
                                                    value={props.transformData[`scale${axis}`]} 
                                                    onChange={(e) => props.updateTransformFromUI(`scale${axis}`, parseFloat(e.target.value))} 
                                                    className="w-full h-1 bg-[#0a0a0a] rounded-lg appearance-none accent-purple-400" 
                                                />
                                                <input 
                                                    type="number" 
                                                    value={props.transformData[`scale${axis}`].toFixed(3)} 
                                                    onChange={(e) => props.updateTransformFromUI(`scale${axis}`, parseFloat(e.target.value))} 
                                                    className="w-[72px] h-8 rounded-md border border-white/10 bg-[#070707] px-2 text-[11px] font-black tracking-wide text-purple-200 outline-none" 
                                                />
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </section>
                )}

                {props.mode === 'animate' && (
                    <div className="p-4 border border-pink-900/30 bg-pink-900/10 rounded-lg text-center space-y-4">
                        <Film size={24} className="mx-auto text-pink-500 mb-2" />
                        <div className="text-[10px] text-pink-400 font-bold">ANIMATION MODE ACTIVE</div>
                        <div className="text-[9px] text-gray-500 mt-1">Use the floating timeline below to sequence motion.</div>
                    </div>
                )}
            </div>
        </div>
    );
}
