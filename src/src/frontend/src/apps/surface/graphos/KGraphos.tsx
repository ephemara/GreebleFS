
import React, { useState, useEffect, useRef, useCallback } from 'react';
import * as THREE from 'three';
import { Activity, Scaling, Move, Box } from 'lucide-react';
import { initGraphosEngine } from './KGraphosEngine';
import KGraphosUI from './KGraphosUI';
import KGraphosTopBar from './KGraphosTopBar';
import KGraphosCursor from './KGraphosCursor';
import KGraphosBrushMenu from './KGraphosBrushMenu';
import KGraphosSpaceMenu from './KGraphosSpaceMenu';
import KGraphosLayerMenu from './KGraphosLayerMenu';
import KGraphosRightDock from './KGraphosRightDock';
import KGraphosMaterialMenu from './KGraphosMaterialMenu';
import KSculptAlphaMenu from '../../sculpting/sculpt/KSculptAlphaMenu';
import KGraphosSequencer from './KGraphosSequencer';
import { useGraphosInput } from './useGraphosInput';
import { Keyframe, KeyframeTransform, getInterpolatedTransform, EasingType } from './easings';
import { useZenControlBindings, useZenModuleBridge, useZenWorkspaceStore } from '../../../core/zen';

const lerp = (start: number, end: number, t: number) => start * (1 - t) + end * t;
const toGraphosLayerId = (layerId: string) => `graphos:layer:${layerId}`;

export default function KGraphos({
    sharedState,
    onCommit,
    onAlphaCommit,
    onMaterialCommit,
    zenShellMode = 'standalone',
    ...props
}: any) {
    const { publishLayers, publishState, publishSelection } = useZenModuleBridge('graphos');
    const setActiveMaterialId = useZenWorkspaceStore((state) => state.setActiveMaterialId);
    const isToolOverlay = zenShellMode === 'tool-overlay';
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const viewportRef = useRef<HTMLDivElement>(null);
    const engineRef = useRef<any>(null);

    const [isEngineReady, setIsEngineReady] = useState(false);
    const [activeTab, setActiveTab] = useState('layers');
    const [activeLayerId, setActiveLayerId] = useState<string | null>(null);
    const [layers, setLayers] = useState<any[]>([]);
    const [isHoveringCanvas, setIsHoveringCanvas] = useState(false);
    const [isHoveringViewport, setIsHoveringViewport] = useState(false); // Track viewport (canvas area) hover
    const [isSpaceHeld, setIsSpaceHeld] = useState(false); // Space key state for cursor visibility
    const [canvasConfig, setCanvasConfig] = useState({ width: 2048, height: 2048 });
    const [gpuMode, setGpuMode] = useState(true);
    const [is3DMode, setIs3DMode] = useState(false);

    // Sequencer State
    const [sequencerOpen, setSequencerOpen] = useState(false);
    const [currentFrame, setCurrentFrame] = useState(0);
    const [totalFrames, setTotalFrames] = useState(60);
    const [isPlaying, setIsPlaying] = useState(false);
    const [fps, setFps] = useState(30);

    const targetZoom = useRef(1.0);
    const currentZoom = useRef(1.0);
    const targetPan = useRef(new THREE.Vector2(0, 0));
    const zoomWorldPoint = useRef<THREE.Vector2 | null>(null); // World point to keep under cursor during zoom
    const zoomScreenPoint = useRef<THREE.Vector2 | null>(null); // Screen point of cursor during zoom
    const isZooming = useRef(false); // Track if zoom animation is active
    const [displayZoom, setDisplayZoom] = useState(1.0);

    const [materialMode, setMaterialMode] = useState(false);
    const [activeMaterial, setActiveMaterial] = useState<any>(null);
    const [materialChannels, setMaterialChannels] = useState({
        albedo: true,
        normal: false,
        roughness: false,
        metalness: false,
        emission: false
    });

    const DEFAULT_BRUSHES = [
        { id: 'INK', label: 'INK', icon: 'PenTool', hardness: 1.0, flow: 1.0, opacity: 1.0 },
        { id: 'SOFT', label: 'SOFT', icon: 'Brush', hardness: 0.0, flow: 0.5, opacity: 0.8 },
        { id: 'CHISEL', label: 'CHISEL', icon: 'Square', hardness: 1.0, flow: 0.8, opacity: 1.0 },
        { id: 'SKETCH', label: 'SKETCH', icon: 'Highlighter', hardness: 0.5, flow: 0.2, opacity: 0.6 },
        { id: 'WASH', label: 'WASH', icon: 'Droplet', hardness: 0.2, flow: 0.1, opacity: 0.4 },
        { id: 'ERASE', label: 'ERASE', icon: 'Eraser', hardness: 0.8, flow: 1.0, opacity: 1.0 },
        { id: 'SCATTER', label: 'CHAOS', icon: 'Shuffle', hardness: 0.5, flow: 0.5, opacity: 0.8 },
        { id: 'FILL', label: 'FILL', icon: 'PaintBucket', hardness: 1.0, flow: 1.0, opacity: 1.0 }
    ];

    const [savedBrushes, setSavedBrushes] = useState(DEFAULT_BRUSHES);

    const handleBrushCommit = (newBrush: any) => {
        setSavedBrushes(prev => [...prev, newBrush]);
    };

    const [brush, setBrush] = useState({
        size: 50,
        opacity: 1.0,
        flow: 1.0, // Deprecated, kept for compatibility but hidden
        hardness: 0.5,
        color: '#000000',
        alphaMap: null,
        isSeamless: false,
        spacing: 0.1,
        erase: false,
        tool: 'INK',
        angle: 0.0,
        // HYPER EDITION PARAMS
        jitterPos: 0.0,
        jitterSize: 0.0,
        jitterAngle: 0.0,
        jitterHue: 0.0,
        symmetry: 'NONE' // NONE, X, Y, RADIAL
    });

    const [showBrushMenuState, setShowBrushMenuState] = useState({ show: false, x: 0, y: 0 });
    const [showSpaceMenuState, setShowSpaceMenuState] = useState({ show: false, x: 0, y: 0 });
    const [showLayerMenuState, setShowLayerMenuState] = useState({ show: false, x: 0, y: 0 });
    const [showAlphaMenuState, setShowAlphaMenuState] = useState({ show: false, x: 0, y: 0 });
    const [showMaterialMenuState, setShowMaterialMenuState] = useState({ show: false, x: 0, y: 0 });

    // SIMULATION STATE
    const [activeSims, setActiveSims] = useState<Record<string, boolean>>({
        drip: false, bleed: false, liquify: false, gravity: false, rivulet: false, growth: false,
        wind: false, magnetic: false, datamosh: false, nebula: false, thermal: false, sort: false, life: false,
        vortex: false, erosion: false
    });

    const [simParams, setSimParams] = useState({
        speed: 1.0,
        chaos: 0.5,
        decay: 0.95,
        scale: 1.0
    });

    const simStateRef = useRef({ activeSims, simParams, activeLayerId, gpuMode });
    useEffect(() => { simStateRef.current = { activeSims, simParams, activeLayerId, gpuMode }; }, [activeSims, simParams, activeLayerId, gpuMode]);

    useEffect(() => {
        if (activeMaterial) {
            const loader = new THREE.TextureLoader();
            const load = (url: string) => new Promise<THREE.Texture | null>(r => { if (!url) r(null); else loader.load(url, (t) => { t.colorSpace = THREE.SRGBColorSpace; r(t); }); });
            Promise.all([load(activeMaterial.base), load(activeMaterial.normal), load(activeMaterial.roughness), load(activeMaterial.metallic), load(activeMaterial.emissive)]).then(([alb, nrm, rgh, met, ems]) => {
                if (engineRef.current) engineRef.current.loadedTextures = { albedo: alb, normal: nrm, roughness: rgh, metalness: met, emission: ems };
            });
        } else if (engineRef.current) { engineRef.current.loadedTextures = null; }
    }, [activeMaterial]);

    useEffect(() => {
        if (!canvasRef.current) return;
        const engine = initGraphosEngine(canvasRef.current, canvasConfig);
        engineRef.current = engine;
        const id = `layer_bg_${Date.now()}`;
        engine.addLayer(id, 'Background', [1, 1, 1, 1]);
        setLayers([{ id, name: 'Background', visible: true, opacity: 1.0, keyframes: [], transform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 } }]);
        setActiveLayerId(id);
        setIsEngineReady(true);
        setTimeout(() => { if (engineRef.current) { engineRef.current.fitToScreen(); targetZoom.current = engineRef.current.zoom; currentZoom.current = engineRef.current.zoom; engineRef.current.render(); } }, 100);

        let frameId: number;
        const animate = () => {
            frameId = requestAnimationFrame(animate);
            const r = engineRef.current;
            const state = simStateRef.current;
            if (r) {
                if (!r.is3D) {
                    const diffZoom = targetZoom.current - currentZoom.current;
                    const diffPanX = targetPan.current.x - r.pan.x;
                    const diffPanY = targetPan.current.y - r.pan.y;

                    if (Math.abs(diffZoom) > 0.0001 || Math.abs(diffPanX) > 0.1 || Math.abs(diffPanY) > 0.1) {
                        isZooming.current = true;
                        currentZoom.current = lerp(currentZoom.current, targetZoom.current, 0.15);
                        r.pan.x = lerp(r.pan.x, targetPan.current.x, 0.15);
                        r.pan.y = lerp(r.pan.y, targetPan.current.y, 0.15);

                        r.setTransform(currentZoom.current, r.pan);

                        // Update display zoom every frame for smooth cursor scaling
                        setDisplayZoom(currentZoom.current);

                        // Clear zoom tracking when animation completes
                        if (Math.abs(diffZoom) < 0.001 && Math.abs(diffPanX) < 0.1 && Math.abs(diffPanY) < 0.1) {
                            zoomWorldPoint.current = null;
                            zoomScreenPoint.current = null;
                            isZooming.current = false;
                        }
                    } else {
                        isZooming.current = false;
                    }
                } else { if (r.controls) r.controls.update(); }

                if (state.gpuMode && state.activeLayerId) {
                    const layer = r.getLayer(state.activeLayerId);
                    if (layer) {
                        let needsUpdate = false;
                        // CORE
                        if (state.activeSims.drip) { r.runSim(state.activeLayerId, 'DRIP', state.simParams); needsUpdate = true; }
                        if (state.activeSims.bleed) { r.runSim(state.activeLayerId, 'BLEED', state.simParams); needsUpdate = true; }
                        // Run Liquify if active OR if in Material Mode (for viscous fluid feel)
                        if (state.activeSims.liquify || materialMode) { r.runSim(state.activeLayerId, 'LIQUIFY', state.simParams); needsUpdate = true; }
                        if (state.activeSims.rivulet) { r.runSim(state.activeLayerId, 'RIVULET', state.simParams); needsUpdate = true; }
                        if (state.activeSims.growth) { r.runSim(state.activeLayerId, 'GROWTH', state.simParams); needsUpdate = true; }

                        // ADVANCED
                        if (state.activeSims.wind) { r.runSim(state.activeLayerId, 'WIND', state.simParams); needsUpdate = true; }
                        if (state.activeSims.magnetic) { r.runSim(state.activeLayerId, 'MAGNETIC', state.simParams); needsUpdate = true; }
                        if (state.activeSims.datamosh) { r.runSim(state.activeLayerId, 'DATAMOSH', state.simParams); needsUpdate = true; }
                        if (state.activeSims.nebula) { r.runSim(state.activeLayerId, 'NEBULA', state.simParams); needsUpdate = true; }
                        if (state.activeSims.thermal) { r.runSim(state.activeLayerId, 'THERMAL', state.simParams); needsUpdate = true; }
                        if (state.activeSims.sort) { r.runSim(state.activeLayerId, 'SORT', state.simParams); needsUpdate = true; }
                        if (state.activeSims.life) { r.runSim(state.activeLayerId, 'LIFE', state.simParams); needsUpdate = true; }
                        if (state.activeSims.vortex) { r.runSim(state.activeLayerId, 'VORTEX', state.simParams); needsUpdate = true; }

                        if (needsUpdate) r.needsUpdate = true;
                    }
                }

                // Compose if needed (throttled to frame rate)
                if (r.needsUpdate) {
                    r.compose();
                    r.needsUpdate = false;
                }

                r.render();
            }
        };
        animate();

        const handleResize = () => { if (engineRef.current) { engineRef.current.fitToScreen(); targetZoom.current = engineRef.current.zoom; } };
        window.addEventListener('resize', handleResize);
        return () => { cancelAnimationFrame(frameId); window.removeEventListener('resize', handleResize); if (engine) engine.dispose(); };
    }, []);

    const handleCanvasResize = (size: number) => {
        if (engineRef.current) { engineRef.current.resize(size, size); setCanvasConfig({ width: size, height: size }); }
    };

    // Playback: Update layer transforms based on keyframe interpolation
    useEffect(() => {
        if (!isPlaying) return;

        console.log('[Playback] Frame:', currentFrame);

        // Update all layer transforms based on current frame
        setLayers(prev => prev.map(layer => {
            if (!layer.keyframes || layer.keyframes.length === 0) return layer;
            const interpolated = getInterpolatedTransform(layer.keyframes, currentFrame);
            console.log('[Playback] Layer', layer.name, 'keyframes:', layer.keyframes.length, 'interpolated:', interpolated);
            return { ...layer, transform: interpolated };
        }));
    }, [isPlaying, currentFrame]);

    useEffect(() => {
        if (engineRef.current) {
            engineRef.current.handlePaint = (uv: THREE.Vector2, pressure: number) => {
                const r = engineRef.current;
                const layerId = activeLayerId;
                if (!r || !layerId) return;
                const layer = r.getLayer(layerId);
                if (!layer || !layer.visible) return;

                // Initialize lastPaintPos if null
                if (!r.lastPaintPos) r.lastPaintPos = uv.clone();

                // Calculate Distance & Steps
                const dist = uv.distanceTo(r.lastPaintPos);
                const brushSizeUV = brush.size / canvasConfig.width; // Approx UV size
                const spacingUV = Math.max(0.0001, brushSizeUV * brush.spacing);

                const steps = Math.ceil(dist / spacingUV);

                // Interpolate Points
                const interpolatedPoints: THREE.Vector2[] = [];
                for (let i = 1; i <= steps; i++) {
                    const t = i / steps;
                    interpolatedPoints.push(new THREE.Vector2().lerpVectors(r.lastPaintPos, uv, t));
                }
                // If no movement (click), paint at least once
                if (steps === 0) interpolatedPoints.push(uv.clone());

                // Update Velocity for Sims
                let delta = new THREE.Vector2(0, 0);
                delta.subVectors(uv, r.lastPaintPos).multiplyScalar(50.0);
                r.currentVelocity = delta;

                // Apply velocity if Liquify is active OR if in Material Mode (for viscous feel)
                if (gpuMode && (activeSims.liquify || materialMode)) {
                    r.paintEngine.splatVelocity(layer, uv, delta, brush.size * pressure);
                }

                r.lastPaintPos = uv.clone();

                // Process Each Interpolated Point
                interpolatedPoints.forEach(pointUV => {
                    const points = [{ uv: pointUV, size: brush.size, angle: 0, color: brush.color }];

                    // 1. Jitter
                    if (brush.jitterPos > 0 || brush.jitterSize > 0 || brush.jitterAngle > 0 || brush.jitterHue > 0) {
                        const p = points[0];
                        if (brush.jitterPos > 0) { p.uv.x += (Math.random() - 0.5) * 0.1 * brush.jitterPos; p.uv.y += (Math.random() - 0.5) * 0.1 * brush.jitterPos; }
                        if (brush.jitterSize > 0) { p.size *= (1.0 + (Math.random() - 0.5) * brush.jitterSize); }
                        if (brush.jitterAngle > 0) { p.angle += (Math.random() - 0.5) * Math.PI * brush.jitterAngle; }
                    }

                    // 2. Symmetry
                    if (brush.symmetry === 'X') points.push({ ...points[0], uv: new THREE.Vector2(1.0 - points[0].uv.x, points[0].uv.y) });
                    else if (brush.symmetry === 'Y') points.push({ ...points[0], uv: new THREE.Vector2(points[0].uv.x, 1.0 - points[0].uv.y) });
                    else if (brush.symmetry === 'RADIAL') {
                        const count = 6;
                        const center = new THREE.Vector2(0.5, 0.5);
                        const baseUV = points[0].uv.clone().sub(center);
                        for (let i = 1; i < count; i++) {
                            const angle = (Math.PI * 2 * i) / count;
                            const rotated = new THREE.Vector2(
                                baseUV.x * Math.cos(angle) - baseUV.y * Math.sin(angle),
                                baseUV.x * Math.sin(angle) + baseUV.y * Math.cos(angle)
                            ).add(center);
                            points.push({ ...points[0], uv: rotated });
                        }
                    }

                    const channels = materialMode
                        ? materialChannels
                        : { albedo: true, normal: false, roughness: false, metalness: false, emission: false };

                    points.forEach(p => {
                        const dynamicBrush = { ...brush, size: p.size, color: p.color, flow: 1.0 }; // Force Flow 1.0
                        if (brush.erase) dynamicBrush.opacity = 1.0; // Eraser usually needs full strength or handled via opacity
                        r.paintEngine.paint(p.uv, dynamicBrush, layer, channels, r.quadMesh, materialMode ? r.loadedTextures : null);
                    });
                });

                // Flag for composition in next frame
                r.needsUpdate = true;
            };
        }
    }, [brush, activeLayerId, gpuMode, activeSims, materialMode, materialChannels, canvasConfig]);

    useGraphosInput(canvasRef, viewportRef, engineRef, targetZoom, targetPan, zoomWorldPoint, zoomScreenPoint, setIsSpaceHeld);

    const getCanvasMenuAnchor = useCallback(() => {
        const rect = canvasRef.current?.getBoundingClientRect();
        if (!rect) {
            return null;
        }

        return {
            x: rect.left + rect.width / 2,
            y: rect.top + rect.height / 2
        };
    }, []);

    useZenControlBindings('graphos', ({ actionId, phase, sourceModuleId }) => {
        if (sourceModuleId !== 'graphos' || phase !== 'down') {
            return false;
        }

        const anchor = getCanvasMenuAnchor();

        switch (actionId) {
            case 'menu.brush.toggle':
                if (anchor) {
                    setShowBrushMenuState((prev) => ({ show: !prev.show, x: anchor.x, y: anchor.y }));
                    return true;
                }
                return false;
            case 'graphos.menu.layer.toggle':
                if (anchor) {
                    setShowLayerMenuState((prev) => ({ show: !prev.show, x: anchor.x, y: anchor.y }));
                    return true;
                }
                return false;
            case 'graphos.menu.material.toggle':
                if (anchor) {
                    setShowMaterialMenuState((prev) => ({ show: !prev.show, x: anchor.x, y: anchor.y }));
                    return true;
                }
                return false;
            case 'menu.alpha.toggle':
                if (anchor) {
                    setShowAlphaMenuState((prev) => ({ show: !prev.show, x: anchor.x, y: anchor.y }));
                    return true;
                }
                return false;
            case 'menu.quick.toggle':
                if (!lockedMenus.has('space') && anchor) {
                    setShowSpaceMenuState((prev) => ({ show: !prev.show, x: anchor.x, y: anchor.y }));
                    return true;
                }
                return false;
            case 'layer.prev': {
                const currentIndex = layers.findIndex((layer) => layer.id === activeLayerId);
                if (currentIndex >= 0 && currentIndex < layers.length - 1) {
                    setActiveLayerId(layers[currentIndex + 1].id);
                    return true;
                }
                return false;
            }
            case 'layer.next': {
                const currentIndex = layers.findIndex((layer) => layer.id === activeLayerId);
                if (currentIndex > 0) {
                    setActiveLayerId(layers[currentIndex - 1].id);
                    return true;
                }
                return false;
            }
            case 'graphos.sim.wind.toggle': {
                const activeSimulationKeys = Object.keys(activeSims).filter((key) => activeSims[key]);
                if (activeSimulationKeys.length > 0) {
                    setActiveSims((previous) => {
                        const nextState = { ...previous };
                        activeSimulationKeys.forEach((key) => {
                            nextState[key] = false;
                        });
                        return nextState;
                    });
                } else {
                    setActiveSims((previous) => ({ ...previous, wind: true }));
                }
                return true;
            }
            case 'canvas.frame':
            case 'camera.focus':
                if (engineRef.current) {
                    engineRef.current.fitToScreen();
                    targetZoom.current = engineRef.current.zoom;
                    currentZoom.current = engineRef.current.zoom;
                    targetPan.current.set(engineRef.current.pan.x, engineRef.current.pan.y);
                    zoomWorldPoint.current = null;
                    zoomScreenPoint.current = null;
                    return true;
                }
                return false;
            default:
                return false;
        }
    });

    const handleLayerAdd = useCallback(() => {
        if (!engineRef.current || !isEngineReady) return;
        const id = `layer_${Date.now()}`;
        engineRef.current.addLayer(id, `Layer ${layers.length + 1}`, [0, 0, 0, 0]);
        setLayers(prev => [...prev, {
            id,
            name: `Layer ${prev.length + 1}`,
            visible: true,
            opacity: 1.0,
            keyframes: [],
            transform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 }
        }]);
        setActiveLayerId(id);
    }, [isEngineReady, layers.length]);

    // Keyframe Management
    const addKeyframe = useCallback((layerId: string, frame: number) => {
        setLayers(prev => prev.map(layer => {
            if (layer.id !== layerId) return layer;
            // Check if keyframe exists at this frame
            const existing = layer.keyframes.find((k: Keyframe) => k.frame === frame);
            if (existing) {
                // Update existing keyframe with current transform
                return {
                    ...layer,
                    keyframes: layer.keyframes.map((k: Keyframe) =>
                        k.frame === frame ? { ...k, transform: { ...layer.transform } } : k
                    )
                };
            }
            // Add new keyframe
            const newKeyframe: Keyframe = {
                frame,
                transform: { ...layer.transform },
                easing: 'easeOut' as EasingType
            };
            return {
                ...layer,
                keyframes: [...layer.keyframes, newKeyframe].sort((a: Keyframe, b: Keyframe) => a.frame - b.frame)
            };
        }));
    }, []);

    const deleteKeyframe = useCallback((layerId: string, frame: number) => {
        setLayers(prev => prev.map(layer => {
            if (layer.id !== layerId) return layer;
            return {
                ...layer,
                keyframes: layer.keyframes.filter((k: Keyframe) => k.frame !== frame)
            };
        }));
    }, []);

    const updateLayerTransform = useCallback((layerId: string, transform: Partial<KeyframeTransform>) => {
        setLayers(prev => prev.map(layer => {
            if (layer.id !== layerId) return layer;
            return {
                ...layer,
                transform: { ...layer.transform, ...transform }
            };
        }));
    }, []);

    const handleLayerDelete = useCallback((id: string) => {
        if (!engineRef.current) return;
        engineRef.current.deleteLayer(id);
        setLayers(prev => {
            const next = prev.filter(l => l.id !== id);
            if (activeLayerId === id) setActiveLayerId(next.length > 0 ? next[next.length - 1].id : null);
            return next;
        });
    }, [activeLayerId]);

    const handleLayerVisibility = useCallback((id: string, solo: boolean) => {
        if (!engineRef.current) return;
        if (solo) {
            setLayers(prev => prev.map(l => {
                const isTarget = l.id === id;
                const engineLayer = engineRef.current.getLayer(l.id);
                if (engineLayer) engineLayer.visible = isTarget;
                return { ...l, visible: isTarget };
            }));
        } else {
            const layer = engineRef.current.getLayer(id);
            if (layer) {
                layer.visible = !layer.visible;
                setLayers(prev => prev.map(l => l.id === id ? { ...l, visible: layer.visible } : l));
            }
        }
        engineRef.current.compose();
    }, []);

    const handleLayerOpacity = useCallback((id: string, opacity: number) => {
        if (!engineRef.current) return;
        const layer = engineRef.current.getLayer(id);
        if (layer) {
            layer.opacity = opacity;
            setLayers(prev => prev.map(l => l.id === id ? { ...l, opacity } : l));
            engineRef.current.compose();
        }
    }, []);

    const handleExport = (type: 'PNG' | 'JPEG' | 'ALPHA' | 'SAMPLE') => {
        if (!engineRef.current) return;
        engineRef.current.exportImage((blob: Blob) => {
            if (type === 'ALPHA' && onAlphaCommit) {
                onAlphaCommit({ name: `Graphos_Alpha_${Date.now()}`, url: URL.createObjectURL(blob) });
            } else if (type === 'SAMPLE') {
                // Send to K-Sample (AutoPBR)
                const url = URL.createObjectURL(blob);
                if ((props as any).setTempImage) (props as any).setTempImage(url);
                if ((props as any).switchModule) (props as any).switchModule('autopbr');
            } else {
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a'); a.href = url; a.download = `Graphos_${Date.now()}.${type === 'JPEG' ? 'jpg' : 'png'}`; a.click();
            }
        }, type === 'JPEG' ? 'JPEG' : 'PNG');
    };

    const toggle3DMode = () => {
        if (engineRef.current) {
            const nextState = !is3DMode;
            setIs3DMode(nextState);
            engineRef.current.is3D = nextState;
            engineRef.current.toggle3D(nextState);
            if (nextState && engineRef.current.controls) engineRef.current.controls.enabled = true;
            else targetZoom.current = currentZoom.current;
        }
    };

    const [lockedMenus, setLockedMenus] = useState<Set<string>>(new Set());

    const toggleMenuLock = (menuId: string) => {
        setLockedMenus(prev => {
            const next = new Set(prev);
            if (next.has(menuId)) next.delete(menuId);
            else next.add(menuId);
            return next;
        });
    };

    useEffect(() => {
        publishLayers(layers.map((layer, index) => ({
            id: toGraphosLayerId(layer.id),
            name: layer.name,
            order: index,
            visible: layer.visible !== false,
            tags: ['graphos', 'canvas-layer']
        })));
    }, [layers, publishLayers]);

    useEffect(() => {
        publishState({
            activeTab,
            gpuMode,
            is3DMode,
            materialMode,
            activeLayerId: activeLayerId ? toGraphosLayerId(activeLayerId) : null,
            canvasWidth: canvasConfig.width,
            canvasHeight: canvasConfig.height,
            sequencerOpen,
            isPlaying,
            fps
        });
    }, [
        activeLayerId,
        activeTab,
        canvasConfig.height,
        canvasConfig.width,
        fps,
        gpuMode,
        is3DMode,
        isPlaying,
        materialMode,
        publishState,
        sequencerOpen
    ]);

    useEffect(() => {
        if (isToolOverlay) {
            return;
        }

        publishSelection({
            activeAssetId: sharedState?.activeArtifactId ?? null,
            activeEntityId: null,
            activeLayerId: activeLayerId ? toGraphosLayerId(activeLayerId) : null
        });
    }, [activeLayerId, isToolOverlay, publishSelection, sharedState?.activeArtifactId]);

    useEffect(() => {
        setActiveMaterialId(activeMaterial?.id ?? null);
    }, [activeMaterial?.id, setActiveMaterialId]);

    // CONTEXT MENU HANDLER
    const handleContextMenu = (e: React.MouseEvent) => {
        e.preventDefault();
        setShowBrushMenuState(prev => ({ show: !prev.show, x: e.clientX, y: e.clientY }));

        // Don't close others if they are locked
        if (!lockedMenus.has('alpha')) setShowAlphaMenuState(prev => ({ ...prev, show: false }));
        if (!lockedMenus.has('space')) setShowSpaceMenuState(prev => ({ ...prev, show: false }));
        if (!lockedMenus.has('material')) setShowMaterialMenuState(prev => ({ ...prev, show: false }));
    };

    return (
        <div
            className={`w-full h-full flex flex-col overflow-hidden ${isToolOverlay ? 'bg-transparent pointer-events-none' : 'bg-[#000]'}`}
            style={{ userSelect: 'none', touchAction: 'none', position: 'relative' }}
        >
            <KGraphosCursor brush={brush} zoomRef={currentZoom} viewportRef={viewportRef} show={(isHoveringViewport || isZooming.current) && !is3DMode && !isSpaceHeld} />

            {/* RADIAL MENUS */}
            <div className={isToolOverlay ? 'pointer-events-auto' : ''}>
                <KGraphosBrushMenu
                    visible={showBrushMenuState.show}
                    position={{ x: showBrushMenuState.x, y: showBrushMenuState.y }}
                    brush={brush}
                    setBrush={setBrush}
                    brushes={savedBrushes}
                    onSelect={() => setShowBrushMenuState({ ...showBrushMenuState, show: false })}
                    isLocked={lockedMenus.has('brush')}
                    onToggleLock={() => toggleMenuLock('brush')}
                />
            </div>
            <div className={isToolOverlay ? 'pointer-events-auto' : ''}>
                <KSculptAlphaMenu
                    visible={showAlphaMenuState.show}
                    position={{ x: showAlphaMenuState.x, y: showAlphaMenuState.y }}
                    alphas={sharedState?.alphas || []}
                    activeAlpha={brush.alphaMap}
                    onSelect={(alpha: any) => {
                        if (!alpha) {
                            setBrush(prev => ({ ...prev, alphaMap: null }));
                        } else {
                            const loader = new THREE.TextureLoader();
                            loader.load(alpha.url, (tex) => {
                                setBrush(prev => ({ ...prev, alphaMap: tex }));
                            });
                        }
                        setShowAlphaMenuState({ ...showAlphaMenuState, show: false });
                    }}
                />
            </div>
            <div className={isToolOverlay ? 'pointer-events-auto' : ''}>
                <KGraphosSpaceMenu
                    visible={showSpaceMenuState.show}
                    position={{ x: showSpaceMenuState.x, y: showSpaceMenuState.y }}
                    activeSims={activeSims}
                    toggleSim={(id: string) => setActiveSims(prev => {
                        return { ...prev, [id]: !prev[id] };
                    })}
                    simParams={simParams}
                    setSimParams={setSimParams}
                    onReset={() => { if (activeLayerId && engineRef.current) { const l = engineRef.current.getLayer(activeLayerId); if (l) engineRef.current.paintEngine.clearLayer(l); engineRef.current.compose(); } }}
                    gpuMode={gpuMode}
                    setGpuMode={setGpuMode}
                    isLocked={lockedMenus.has('space')}
                    onToggleLock={() => toggleMenuLock('space')}
                />
            </div>

            <div className={isToolOverlay ? 'pointer-events-auto' : ''}>
                <KGraphosLayerMenu
                    visible={showLayerMenuState.show}
                    position={{ x: showLayerMenuState.x, y: showLayerMenuState.y }}
                    layers={layers}
                    activeLayerId={activeLayerId}
                    setActiveLayerId={setActiveLayerId}
                    onAdd={handleLayerAdd}
                    onDelete={handleLayerDelete}
                    onToggleVisibility={handleLayerVisibility}
                    onOpacityChange={handleLayerOpacity}
                    onSelect={() => setShowLayerMenuState({ ...showLayerMenuState, show: false })}
                />
            </div>

            <div className={isToolOverlay ? 'pointer-events-auto' : ''}>
                <KGraphosMaterialMenu
                    visible={showMaterialMenuState.show}
                    position={{ x: showMaterialMenuState.x, y: showMaterialMenuState.y }}
                    projectMaterials={sharedState?.materials || []}
                    activeMaterial={activeMaterial}
                    setActiveMaterial={setActiveMaterial}
                    setMaterialMode={setMaterialMode}
                    onSelect={() => setShowMaterialMenuState({ ...showMaterialMenuState, show: false })}
                />
            </div>

            <div className={isToolOverlay ? 'pointer-events-auto' : ''}>
                <KGraphosTopBar brush={brush} setBrush={setBrush} activeTab={activeTab} setActiveTab={setActiveTab} activeMods={activeSims} setActiveMods={setActiveSims} canvasConfig={canvasConfig} gpuMode={gpuMode} setGpuMode={setGpuMode} is3DMode={is3DMode} toggle3DMode={toggle3DMode} onResize={handleCanvasResize} isToolOverlay={isToolOverlay} />
            </div>
            <div className="flex flex-1 overflow-hidden">
                <div className={isToolOverlay ? 'pointer-events-auto' : ''}>
                    <KGraphosUI
                        activeTab={activeTab}
                        setActiveTab={setActiveTab}
                        layers={layers}
                        setLayers={setLayers}
                        activeLayerId={activeLayerId}
                        setActiveLayerId={setActiveLayerId}
                        handleLayerAdd={handleLayerAdd}
                        handleLayerDelete={handleLayerDelete}
                        handleLayerVisibility={handleLayerVisibility}
                        handleLayerOpacity={handleLayerOpacity}
                        handleExport={handleExport}
                        activeMods={activeSims}
                        setActiveMods={setActiveSims}
                        engineRef={engineRef}
                        // Alpha Props
                        alphas={sharedState?.alphas || []}
                        onAlphaCommit={onAlphaCommit}
                        brush={brush}
                        setBrush={setBrush}
                        onBrushCommit={handleBrushCommit}
                    />
                </div>
                <div className={`flex-1 relative flex flex-col overflow-hidden ${isToolOverlay ? 'bg-transparent' : 'bg-[#050505]'}`} style={{ minWidth: 0 }}>
                    <div
                        ref={viewportRef}
                        className={`flex-1 relative overflow-hidden flex items-center justify-center ${isToolOverlay ? 'bg-transparent pointer-events-auto' : 'bg-[#080808]'} ${isHoveringViewport && !is3DMode ? 'cursor-none' : ''}`}
                        onPointerEnter={() => setIsHoveringViewport(true)}
                        onPointerLeave={() => setIsHoveringViewport(false)}
                    >
                        {(() => {
                            // Compute animated transform for active layer
                            const activeLayer = layers.find(l => l.id === activeLayerId);
                            const animTransform = (isPlaying && activeLayer?.transform)
                                ? `translate(${activeLayer.transform.x}px, ${activeLayer.transform.y}px) scale(${activeLayer.transform.scaleX}, ${activeLayer.transform.scaleY}) rotate(${activeLayer.transform.rotation}deg)`
                                : undefined;

                            if (animTransform) console.log('[CSS] transform:', animTransform);

                            return (
                                <div
                                    className={`relative shadow-[0_0_100px_rgba(0,0,0,0.8)] ${isToolOverlay ? 'ring-1 ring-white/10 bg-black/5' : ''}`}
                                    style={!is3DMode ? {
                                        width: canvasConfig.width,
                                        height: canvasConfig.height,
                                        transformOrigin: 'center center',
                                        transform: animTransform,
                                        transition: 'transform 33ms linear'
                                    } : { width: '100%', height: '100%' }}
                                >
                                    {!is3DMode && <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: `linear-gradient(45deg, #151515 25%, #1a1a1a 25%), linear-gradient(-45deg, #151515 25%, #1a1a1a 25%), linear-gradient(45deg, #1a1a1a 75%, #151515 75%), linear-gradient(-45deg, #1a1a1a 75%, #151515 75%)`, backgroundSize: '20px 20px', backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0px' }} />}
                                    <canvas
                                        ref={canvasRef}
                                        className="absolute inset-0 touch-none shadow-2xl"
                                        style={{ cursor: 'none' }}
                                        onPointerEnter={() => setIsHoveringCanvas(true)}
                                        onPointerLeave={() => setIsHoveringCanvas(false)}
                                        onContextMenu={handleContextMenu}
                                    />
                                </div>
                            );
                        })()}
                    </div>
                    <div className={`h-8 border-t border-[#222] flex items-center justify-between px-4 text-[9px] z-10 ${isToolOverlay ? 'bg-[#0a0a0a]/85 backdrop-blur-md pointer-events-auto' : 'bg-[#0a0a0a]'}`}>
                        <div className="flex items-center gap-4 text-gray-500 font-bold"><span className="flex items-center gap-2"><Scaling size={10} /> {(displayZoom * 100)?.toFixed(0)}%</span><span className="flex items-center gap-2"><Move size={10} /> {engineRef.current?.pan?.x.toFixed(0) || 0}, {engineRef.current?.pan?.y.toFixed(0) || 0}</span></div>
                        <div className="flex items-center gap-2 text-rose-500 font-bold">{is3DMode && <span className="text-blue-400 mr-2 flex items-center gap-1"><Box size={10} /> 3D MODE</span>}{gpuMode ? <Activity size={10} className="animate-pulse" /> : <div className="w-2 h-2 rounded-full bg-gray-700" />}{gpuMode ? "PHYSICS KERNEL ACTIVE" : "STANDARD RENDERER"}</div>
                    </div>
                    <div className={isToolOverlay ? 'pointer-events-auto' : ''}>
                        <KGraphosSequencer
                            layers={layers}
                            activeLayerId={activeLayerId}
                            setActiveLayerId={setActiveLayerId}
                            currentFrame={currentFrame}
                            setCurrentFrame={setCurrentFrame}
                            totalFrames={totalFrames}
                            setTotalFrames={setTotalFrames}
                            isPlaying={isPlaying}
                            setIsPlaying={setIsPlaying}
                            fps={fps}
                            setFps={setFps}
                            isOpen={sequencerOpen}
                            setIsOpen={setSequencerOpen}
                            onAddKeyframe={addKeyframe}
                            onDeleteKeyframe={deleteKeyframe}
                            onUpdateTransform={updateLayerTransform}
                        />
                    </div>
                </div>
                <div className={isToolOverlay ? 'pointer-events-auto' : ''}>
                    <KGraphosRightDock
                        brush={brush}
                        setBrush={setBrush}
                        projectMaterials={sharedState?.materials || []}
                        activeMaterial={activeMaterial}
                        setActiveMaterial={setActiveMaterial}
                        materialMode={materialMode}
                        setMaterialMode={setMaterialMode}
                        materialChannels={materialChannels}
                        setMaterialChannels={setMaterialChannels}
                        engineRef={engineRef}
                        onMaterialCommit={onMaterialCommit}
                        // Layer Props
                        layers={layers}
                        activeLayerId={activeLayerId}
                        setActiveLayerId={setActiveLayerId}
                        onLayerAdd={handleLayerAdd}
                        onLayerDelete={handleLayerDelete}
                        onLayerVisibility={handleLayerVisibility}
                        onLayerOpacity={handleLayerOpacity}
                    />
                </div>
            </div>
        </div>
    );
}
