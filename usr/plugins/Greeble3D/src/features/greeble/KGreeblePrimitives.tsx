import { useState } from 'react';
import {
    Box, FlaskConical, Grip, AlignVerticalDistributeCenter, Anchor, Settings, Flower, Square, Building2, MoreHorizontal, Network, GitMerge,
    Hexagon, Component, Sigma, Diamond, Cylinder, Ban, ChevronLeft, ChevronRight,
    Zap, Globe, Database, Radio, Disc, Play, Layers, Activity, Aperture, Dna, Grid, HelpCircle, Package, Upload
} from 'lucide-react';
import { SHAPES } from './KGreebleEngine';
import { PRIMITIVE_ICONS } from './primitiveIcons';

export default function KGreeblePrimitives({ activeShape, setActiveShape, userImports = [], handleGlbImport }: any) {
    const [page, setPage] = useState(0);

    const EXPERIMENTAL_SHAPES = [
        // Original Set
        { id: SHAPES.TENTACLE, icon: Grip, label: 'TENTACLE' },
        { id: SHAPES.SPINE, icon: AlignVerticalDistributeCenter, label: 'SPINE' },
        { id: SHAPES.CHAIN, icon: Anchor, label: 'CHAIN' },
        { id: SHAPES.GEAR, icon: Settings, label: 'GEAR' },
        { id: SHAPES.FLORA, icon: Flower, label: 'FLORA' },
        { id: SHAPES.RUINS, icon: Square, label: 'RUINS' },
        { id: SHAPES.CITY, icon: Building2, label: 'CITY' },
        { id: SHAPES.SWARM, icon: MoreHorizontal, label: 'SWARM' },
        { id: SHAPES.STRUCT, icon: Network, label: 'STRUCT' },
        { id: SHAPES.FRACTAL, icon: GitMerge, label: 'FRACTAL' },
        
        // New Set
        { id: SHAPES.HELIX_TUBE, icon: Dna, label: 'HELIX' },
        { id: SHAPES.VORONOI_SPHERE, icon: Globe, label: 'VORONOI' },
        { id: SHAPES.TESSELLATED_POD, icon: Hexagon, label: 'POD' },
        { id: SHAPES.HYPER_CUBE, icon: Box, label: 'HYPERCUBE' },
        { id: SHAPES.QUANTUM_GRID, icon: Grid, label: 'QUANTUM' },
        { id: SHAPES.CYBER_PYRAMID, icon: Diamond, label: 'PYRAMID' },
        { id: SHAPES.NANO_CRYSTAL, icon: Zap, label: 'CRYSTAL' },
        { id: SHAPES.VOID_STAR, icon: Ban, label: 'VOID' },
        { id: SHAPES.DATA_BLOCK, icon: Database, label: 'DATA' },
        { id: SHAPES.FLUX_CORE, icon: Disc, label: 'FLUX' },
        { id: SHAPES.PLASMA_COIL, icon: Activity, label: 'PLASMA' },
        { id: SHAPES.GLITCH_PRISM, icon: Play, label: 'GLITCH' },
        { id: SHAPES.BIO_CLUSTER, icon: Dna, label: 'BIO' },
        { id: SHAPES.NEURAL_NET, icon: Network, label: 'NEURAL' },
        { id: SHAPES.ECHO_CHAMBER, icon: Radio, label: 'ECHO' },
        { id: SHAPES.MIRROR_SHARD, icon: Layers, label: 'MIRROR' },
        { id: SHAPES.WARP_BUBBLE, icon: Aperture, label: 'WARP' },
        { id: SHAPES.TIME_CAPSULE, icon: Cylinder, label: 'CAPSULE' },
        { id: SHAPES.GRAVITY_WELL, icon: Disc, label: 'GRAVITY' },
        { id: SHAPES.DARK_MATTER, icon: Ban, label: 'MATTER' },
    ];

    const XENO_SHAPES = [
        { id: SHAPES.HYPER_EIGHT, icon: HelpCircle, label: 'HYPER-8' },
        { id: SHAPES.LORENZ_ATTRACTOR, icon: HelpCircle, label: 'LORENZ' },
        { id: SHAPES.CALABI_YAU, icon: HelpCircle, label: 'CALABI' },
        { id: SHAPES.HENNEBERG_SURFACE, icon: HelpCircle, label: 'HENNEBERG' },
        { id: SHAPES.DINI_SURFACE, icon: HelpCircle, label: 'DINI' },
        { id: SHAPES.SEIFERT_SURFACE, icon: HelpCircle, label: 'SEIFERT' },
        { id: SHAPES.BOYS_SURFACE, icon: HelpCircle, label: 'BOY' },
        { id: SHAPES.ROMAN_SURFACE, icon: HelpCircle, label: 'ROMAN' },
        { id: SHAPES.KUEN_SURFACE, icon: HelpCircle, label: 'KUEN' },
        { id: SHAPES.ENNEPER_SURFACE, icon: HelpCircle, label: 'ENNEPER' },
        { id: SHAPES.RICHMOND_SURFACE, icon: HelpCircle, label: 'RICHMOND' },
        { id: SHAPES.SCHERK_SURFACE, icon: HelpCircle, label: 'SCHERK' },
        { id: SHAPES.COSTA_SURFACE, icon: HelpCircle, label: 'COSTA' },
        { id: SHAPES.CATENOID, icon: HelpCircle, label: 'CATENOID' },
        { id: SHAPES.HELICOID, icon: HelpCircle, label: 'HELICOID' },
        { id: SHAPES.ASTROIDAL_ELLIPSOID, icon: HelpCircle, label: 'ASTROID' },
        { id: SHAPES.BOHEMIAN_DOME, icon: HelpCircle, label: 'BOHEMIAN' },
        { id: SHAPES.CLEBSCH_CUBIC, icon: HelpCircle, label: 'CLEBSCH' },
        { id: SHAPES.WATTS_CURVE, icon: HelpCircle, label: 'WATT' },
        { id: SHAPES.BLACK_HOLE, icon: HelpCircle, label: 'SINGULARITY' },
    ];

    const PAGES = [
        {
            title: "IMPORTS",
            isImports: true
        },
        {
            title: "CORE",
            sections: [
                {
                    title: "Standard & Extended",
                    icon: Box,
                    color: "text-blue-400",
                    shapes: [
                        SHAPES.CUBE, SHAPES.SPHERE, SHAPES.CYLINDER, SHAPES.CONE, SHAPES.TORUS, 
                        SHAPES.CAPSULE, SHAPES.CHAMFER_BOX, SHAPES.CHAMFER_CYL, SHAPES.OIL_TANK, 
                        SHAPES.SPINDLE, SHAPES.PRISM, SHAPES.RING, SHAPES.RING_WAVE, SHAPES.HOSE, 
                        SHAPES.GENGON, SHAPES.PYRAMID, SHAPES.CRYSTAL, SHAPES.SPIKE, SHAPES.ARC,
                        SHAPES.WALL, SHAPES.PLATFORM, SHAPES.PILLAR, SHAPES.TOWER
                    ]
                }
            ]
        },
        {
            title: "MECHANICAL",
            sections: [
                {
                    title: "Mechanical Greebles",
                    icon: Settings,
                    color: "text-orange-400",
                    shapes: [
                        SHAPES.HEX_BOLT, SHAPES.SOCKET_HEAD, SHAPES.VENT, SHAPES.GRILLE, 
                        SHAPES.PIPE, SHAPES.PIPE_ELBOW, SHAPES.PIPE_TEE, SHAPES.CORRUGATED, 
                        SHAPES.SPRING, SHAPES.SPROCKET, SHAPES.BEARING, SHAPES.HEATSINK, SHAPES.COUPLER
                    ]
                }
            ]
        },
        {
            title: "MATH & FORM",
            sections: [
                {
                    title: "Math & Topological",
                    icon: Sigma,
                    color: "text-purple-400",
                    shapes: [
                        SHAPES.TORUS_KNOT, SHAPES.GYROID, SHAPES.KLEIN, SHAPES.MOBIUS, 
                        SHAPES.SUPERELLIPSOID, SHAPES.SUPERTOROID, SHAPES.SCHWARZ_P, 
                        SHAPES.SPHERICON, SHAPES.OLOIBOID, SHAPES.GOMBOC, SHAPES.REULEAUX, 
                        SHAPES.STEREO_SPHERE
                    ]
                },
                {
                    title: "Platonic Solids",
                    icon: Diamond,
                    color: "text-pink-400",
                    shapes: [
                        SHAPES.TETRAHEDRON, SHAPES.OCTAHEDRON, SHAPES.DODECAHEDRON, 
                        SHAPES.ICOSA, SHAPES.TRUNC_ICOSA, SHAPES.RHOMBIC, SHAPES.BUCKYBALL
                    ]
                }
            ]
        },
        {
            title: "TECH & VOID",
            sections: [
                {
                    title: "Profiles (Extrusions)",
                    icon: Component,
                    color: "text-emerald-400",
                    shapes: [
                        SHAPES.PROFILE_I, SHAPES.PROFILE_H, SHAPES.PROFILE_U, SHAPES.PROFILE_T, 
                        SHAPES.PROFILE_RAIL, SHAPES.L_EXTRUSION, SHAPES.C_EXTRUSION, SHAPES.T_EXTRUSION
                    ]
                },
                {
                    title: "SDF Primitives",
                    icon: Cylinder,
                    color: "text-cyan-400",
                    shapes: [
                        SHAPES.ROUND_BOX, SHAPES.ROUND_CONE, SHAPES.CAPPED_CONE, SHAPES.VESICA, 
                        SHAPES.LINK, SHAPES.CUT_SPHERE, SHAPES.HOLLOW_SPHERE
                    ]
                },
                {
                    title: "Void / Boolean",
                    icon: Ban,
                    color: "text-red-400",
                    shapes: [
                        SHAPES.CUTTER_BOX, SHAPES.DRILL_TIP, SHAPES.KEYHOLE, SHAPES.SLOT, SHAPES.COUNTERSINK
                    ]
                }
            ]
        },
        {
            title: "EXPERIMENTAL",
            isExperimental: true
        },
        {
            title: "?",
            isXeno: true
        }
    ];

    const nextPage = () => setPage(p => (p + 1) % PAGES.length);
    const prevPage = () => setPage(p => (p - 1 + PAGES.length) % PAGES.length);

    return (
        <div className="flex flex-col">
            {/* PAGINATION HEADER */}
            <div className="flex-none flex items-center justify-between mb-4 bg-[#111] rounded border border-[#222] p-1">
                <button onClick={prevPage} className="p-1 hover:bg-[#222] rounded text-gray-500 hover:text-white transition-colors">
                    <ChevronLeft size={14} />
                </button>
                <div className="flex gap-1">
                    {PAGES.map((_, i) => (
                        <button 
                            key={i}
                            onClick={() => setPage(i)}
                            className={`w-6 h-1.5 rounded-full transition-all ${page === i ? 'bg-emerald-500' : 'bg-[#333] hover:bg-[#444]'}`}
                        />
                    ))}
                </div>
                <button onClick={nextPage} className="p-1 hover:bg-[#222] rounded text-gray-500 hover:text-white transition-colors">
                    <ChevronRight size={14} />
                </button>
            </div>
            
            <div className="flex-none text-center text-[9px] font-black uppercase tracking-[0.2em] text-gray-500 mb-4">
                {PAGES[page].title}
            </div>

            {/* PAGE CONTENT */}
            <div className="pb-8">
                {PAGES[page].isImports ? (
                    <section className="animate-in fade-in slide-in-from-right-4 duration-300">
                        <div className="text-[10px] font-bold text-cyan-500 uppercase mb-3 flex items-center gap-2 tracking-wider">
                            <Package size={12} /> Imported Models
                        </div>
                        
                        {/* Import Button - Blends in nicely */}
                        <button
                            onClick={() => {
                                const input = document.createElement('input');
                                input.type = 'file';
                                input.accept = '.glb,.gltf';
                                input.onchange = (e: any) => {
                                    const files = e.target?.files;
                                    const file = files ? files[0] : null;
                                    if (file && handleGlbImport) {
                                        handleGlbImport({ target: { files: [file] } } as any);
                                    }
                                };
                                input.click();
                            }}
                            className="w-full py-3 mb-4 bg-cyan-600/20 hover:bg-cyan-600/30 border border-cyan-600/50 hover:border-cyan-500 rounded-lg text-[10px] font-bold text-cyan-400 hover:text-cyan-300 flex items-center justify-center gap-2 tracking-wider transition-all"
                        >
                            <Upload size={14} /> IMPORT GLB/GLTF
                        </button>
                        
                        {userImports.length === 0 ? (
                            <div className="text-center py-12 text-gray-500">
                                <Package size={32} className="mx-auto mb-3 opacity-30" />
                                <p className="text-[10px] uppercase tracking-wider">No imports yet</p>
                                <p className="text-[8px] mt-2 opacity-70">Import GLB/GLTF files or browse Sketchfab</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-5 gap-2">
                                {userImports.map((item: any) => (
                                    <button
                                        key={item.id}
                                        onClick={() => setActiveShape(item.id)}
                                        className={`aspect-square rounded border flex flex-col items-center justify-center p-2 overflow-hidden group transition-all ${activeShape === item.id ? 'border-cyan-500 bg-[#1a1a1a] text-white' : 'border-[#222] bg-[#161616] text-gray-500 hover:bg-[#1a1a1a]'}`}
                                        title={item.name}
                                    >
                                        {item.thumbnail ? (
                                            <>
                                                <img 
                                                    src={item.thumbnail} 
                                                    alt={item.name}
                                                    className={`w-full h-full object-contain transition-all ${activeShape === item.id ? 'brightness-125 opacity-100' : 'opacity-70 brightness-110 group-hover:opacity-100 group-hover:brightness-125'}`}
                                                    style={{ padding: '4px' }}
                                                />
                                                <span className="text-[7px] font-bold text-center break-words w-full leading-tight opacity-80 mt-1">{item.name.toUpperCase()}</span>
                                            </>
                                        ) : (
                                            <>
                                                <Package size={16} />
                                                <span className="text-[7px] font-bold text-center break-words w-full leading-tight">{item.name.toUpperCase()}</span>
                                            </>
                                        )}
                                    </button>
                                ))}
                            </div>
                        )}
                    </section>
                ) : PAGES[page].isExperimental ? (
                    <section className="animate-in fade-in slide-in-from-right-4 duration-300">
                        <div className="text-[10px] font-bold text-emerald-500 uppercase mb-3 flex items-center gap-2 tracking-wider animate-pulse">
                            <FlaskConical size={12} /> Experimental
                        </div>
                        <div className="grid grid-cols-5 gap-2">
                            {EXPERIMENTAL_SHAPES.map(s => (
                                <button
                                    key={s.id}
                                    onClick={() => setActiveShape(s.id)}
                                    className={`aspect-square rounded border flex flex-col items-center justify-center gap-1 p-2 transition-all overflow-hidden ${activeShape === s.id ? 'border-emerald-500 bg-[#1a1a1a] text-white' : 'border-[#222] bg-[#161616] text-gray-500 hover:bg-[#1a1a1a]'}`}
                                    title={s.label}
                                >
                                    {PRIMITIVE_ICONS[s.id] ? (
                                        <>
                                            <img 
                                                src={PRIMITIVE_ICONS[s.id]} 
                                                alt={s.label}
                                                className={`w-full h-full object-contain transition-all ${activeShape === s.id ? 'brightness-125 opacity-100' : 'opacity-70 brightness-110 group-hover:opacity-100 group-hover:brightness-125'}`}
                                                style={{ padding: '4px' }}
                                            />
                                            <span className="text-[7px] font-bold text-center break-words w-full leading-tight opacity-80">{s.label}</span>
                                        </>
                                    ) : (
                                        <>
                                            <s.icon size={16} />
                                            <span className="text-[7px] font-bold text-center break-words w-full leading-tight">{s.label}</span>
                                        </>
                                    )}
                                </button>
                            ))}
                        </div>
                    </section>
                ) : PAGES[page].isXeno ? (
                    <section className="animate-in fade-in slide-in-from-right-4 duration-300">
                        <div className="text-[10px] font-bold text-pink-500 uppercase mb-3 flex items-center gap-2 tracking-wider animate-pulse">
                            <HelpCircle size={12} /> Unknown
                        </div>
                        <div className="grid grid-cols-5 gap-2">
                            {XENO_SHAPES.map(s => (
                                <button
                                    key={s.id}
                                    onClick={() => setActiveShape(s.id)}
                                    className={`aspect-square rounded border flex flex-col items-center justify-center gap-1 p-2 transition-all overflow-hidden ${activeShape === s.id ? 'border-pink-500 bg-[#1a0a1a] text-white' : 'border-[#222] bg-[#161616] text-gray-500 hover:bg-[#1a1a1a]'}`}
                                    title={s.label}
                                >
                                    {PRIMITIVE_ICONS[s.id] ? (
                                        <>
                                            <img 
                                                src={PRIMITIVE_ICONS[s.id]} 
                                                alt={s.label}
                                                className={`w-full h-full object-contain transition-all ${activeShape === s.id ? 'brightness-125 opacity-100' : 'opacity-70 brightness-110 group-hover:opacity-100 group-hover:brightness-125'}`}
                                                style={{ padding: '4px' }}
                                            />
                                            <span className="text-[7px] font-bold text-center break-words w-full leading-tight opacity-80">{s.label}</span>
                                        </>
                                    ) : (
                                        <>
                                            <HelpCircle size={16} className={activeShape === s.id ? "animate-spin" : ""} />
                                            <span className="text-[7px] font-bold text-center break-words w-full leading-tight">{s.label}</span>
                                        </>
                                    )}
                                </button>
                            ))}
                        </div>
                    </section>
                ) : (
                    PAGES[page].sections?.map((tier, i) => (
                        <section key={i} className="mb-6 animate-in fade-in slide-in-from-right-4 duration-300" style={{ animationDelay: `${i * 50}ms` }}>
                            <div className={`text-[10px] font-bold uppercase mb-3 flex items-center gap-2 tracking-wider ${tier.color || 'text-gray-500'}`}>
                                <tier.icon size={12} /> {tier.title}
                            </div>
                            <div className="grid grid-cols-5 gap-2">
                                {tier.shapes.map((s: any) => {
                                    const iconSrc = PRIMITIVE_ICONS[s];
                                    const label = s.replace(/_/g, ' ').toUpperCase();
                                    return (
                                        <button
                                            key={s}
                                            onClick={() => setActiveShape(s)}
                                            className={`aspect-square rounded border flex flex-col items-center justify-center p-2 overflow-hidden group transition-all ${activeShape === s ? 'border-emerald-500 bg-[#1a1a1a] text-white' : 'border-[#222] bg-[#161616] text-gray-500 hover:bg-[#1a1a1a]'}`}
                                            title={label}
                                        >
                                            {iconSrc ? (
                                                <>
                                                    <img 
                                                        src={iconSrc} 
                                                        alt={label}
                                                        className={`w-full h-full object-contain transition-all ${activeShape === s ? 'brightness-125 opacity-100' : 'opacity-70 brightness-110 group-hover:opacity-100 group-hover:brightness-125'}`}
                                                        style={{ padding: '4px' }}
                                                    />
                                                    <span className="text-[7px] font-bold text-center break-words w-full leading-tight opacity-80 mt-1">{label}</span>
                                                </>
                                            ) : (
                                                <div className="text-[7px] uppercase font-bold text-center break-words w-full opacity-70 group-hover:opacity-100">{label}</div>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        </section>
                    ))
                )}
            </div>
        </div>
    );
}