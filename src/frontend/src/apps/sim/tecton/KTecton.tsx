
import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { GoogleGenAI } from "@google/genai";
import { Activity, Share2, Film, LocateFixed, Flame } from 'lucide-react';
import { useZenModuleBridge, useZenWorkspaceStore } from '../../../core/zen';
import { initTectonEngine } from './KTectonEngine';
import { loadScript, downloadBlob } from './KTectonutils';
import KTectonTopBar from './KTectonTopBar';
import KTectonLeftPanel from './KTectonLeftPanel';
import KTectonRightPanel from './KTectonRightPanel';
import KTectonSequencer from './KTectonSequencer';
import KTectonSpaceMenu from './KTectonSpaceMenu';
import { TectonSculptor } from './KTectonsculpting';
import { useKTectonInteraction } from './KTectonmouseandcamera';
import { generateTerrainData } from './KTectonheightmapgen';
import { calculateSunDirection } from './KTectonlighting';
import {
    coerceTectonLandscapeConfig,
    TECTON_LANDSCAPE_DEFAULTS,
    TECTON_LANDSCAPE_LAYER_ID,
    TECTON_LANDSCAPE_LAYER_NAME,
    type TectonLandscapeResolution
} from './tectonLandscape';

const apiKey = process.env.API_KEY;

export default function KTecton({ sharedState, onCommit, zenShellMode = 'standalone' }: any) {
    const { publishState, publishSelection } = useZenModuleBridge('tecton');
    const tectonModuleState = useZenWorkspaceStore((state) => state.document.moduleState.tecton);
    const activeWorkspaceAssetId = useZenWorkspaceStore((state) => state.document.activeAssetId);
    const isViewportHost = zenShellMode === 'viewport-host';
    const isToolOverlay = zenShellMode === 'tool-overlay';
    const resolvedLandscapeConfig = useMemo(
        () => coerceTectonLandscapeConfig(tectonModuleState),
        [tectonModuleState]
    );
    const activeKernelArtifactRecord = sharedState?.storage?.find(
        (item: any) => item.id === activeWorkspaceAssetId
    ) ?? null;
    const preserveActiveArtifact = Boolean(activeWorkspaceAssetId)
        && activeKernelArtifactRecord?.source === 'K-TECTON';

    // --- STATE ---
    const [status, setStatus] = useState("TECTON NEON V16");

    // UI Panels
    const [leftPanelOpen, setLeftPanelOpen] = useState(true);
    const [rightPanelOpen, setRightPanelOpen] = useState(true);
    const [activeLeftTab, setActiveLeftTab] = useState<'genesis' | 'solar' | 'landscape'>('genesis');
    const [activeRightTab, setActiveRightTab] = useState<'sculpt'>('sculpt');

    const [showSequencer, setShowSequencer] = useState(false);
    const [isEngineReady, setIsEngineReady] = useState(false);


    // Simulation Params
    const [resolution, setResolution] = useState<TectonLandscapeResolution>(TECTON_LANDSCAPE_DEFAULTS.resolution);

    // MASSIVE SCALE UPDATE
    const [sizeX, setSizeX] = useState(TECTON_LANDSCAPE_DEFAULTS.sizeX);
    const [sizeZ, setSizeZ] = useState(TECTON_LANDSCAPE_DEFAULTS.sizeZ);
    const [heightScale, setHeightScale] = useState(TECTON_LANDSCAPE_DEFAULTS.heightScale);

    // Visual Aids
    const [showRefSphere, setShowRefSphere] = useState(false);

    const [activeEffect, setActiveEffect] = useState<number>(0);
    const [simSpeed, setSimSpeed] = useState(1.0);
    const [viewMode, setViewMode] = useState(0);

    // Sculpting
    const [brushSize, setBrushSize] = useState(0.15);
    const [brushStrength, setBrushStrength] = useState(0.5);
    const [sculptMode, setSculptMode] = useState(0);

    // Generation
    const [prompt, setPrompt] = useState("LIDAR scan of Mount Rainier");
    const [seed, setSeed] = useState(TECTON_LANDSCAPE_DEFAULTS.seed);
    const [isProcessing, setIsProcessing] = useState(false);

    // Lighting
    const [sunAzimuth, setSunAzimuth] = useState(220);
    const [sunElevation, setSunElevation] = useState(30);
    const [sunIntensity, setSunIntensity] = useState(2.0);

    // SEQUENCER STATE
    const [isRecording, setIsRecording] = useState(false);
    const [isSimActive, setIsSimActive] = useState(false);
    const [playhead, setPlayhead] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);
    const [overwriteMode, setOverwriteMode] = useState(false);
    const [timeDilation, setTimeDilation] = useState(1.0);
    const [maxFrames, setMaxFrames] = useState(500);
    const [history, setHistory] = useState<number[]>([]);

    // ASTEROID STATE
    const [asteroidParams, setAsteroidParams] = useState({ radius: 0.3, strength: 5.0 });

    // SPACE MENU STATE
    const [spaceMenuOpen, setSpaceMenuOpen] = useState(false);
    const [spaceMenuPos, setSpaceMenuPos] = useState({ x: 0, y: 0 });
    const mouseScreenRef = useRef({ x: 0, y: 0 });

    // REFS
    const mountRef = useRef<HTMLDivElement>(null);
    const timelineRef = useRef<HTMLCanvasElement>(null);
    const sculptEngineRef = useRef<TectonSculptor | null>(null);

    // Render Loop State
    const simRef = useRef({
        activeEffect: 0,
        isRecording: false,
        isPlaying: false,
        isSimActive: false
    });

    const engineRef = useRef<any>({
        scene: null, camera: null, renderer: null,
        mesh: null, material: null,
        simScene: null, simCamera: null, simMaterial: null,
        fluidSim: null,
        targetA: null, targetB: null, initTex: null,
        raycaster: null, mouse: null,
        THREE: null,
        frameId: 0,
        historyBuffers: [],
        frameStats: [],
        updateGeometry: null,
        toggleRefSphere: null
    });

    const landscapeReady = sharedState?.activeLayerId === TECTON_LANDSCAPE_LAYER_ID
        || sharedState?.activeLayer?.name === TECTON_LANDSCAPE_LAYER_NAME;
    const landscapeLabel = sharedState?.activeLayer?.name ?? TECTON_LANDSCAPE_LAYER_NAME;

    useEffect(() => {
        setSizeX(resolvedLandscapeConfig.sizeX);
        setSizeZ(resolvedLandscapeConfig.sizeZ);
        setHeightScale(resolvedLandscapeConfig.heightScale);
        setResolution(resolvedLandscapeConfig.resolution);
        setSeed(resolvedLandscapeConfig.seed);
    }, [
        resolvedLandscapeConfig.heightScale,
        resolvedLandscapeConfig.resolution,
        resolvedLandscapeConfig.seed,
        resolvedLandscapeConfig.sizeX,
        resolvedLandscapeConfig.sizeZ
    ]);

    useEffect(() => {
        if (isToolOverlay && activeLeftTab !== 'landscape') {
            setActiveLeftTab('landscape');
        }

        if (!isToolOverlay && activeLeftTab === 'landscape') {
            setActiveLeftTab('genesis');
        }
    }, [activeLeftTab, isToolOverlay]);

    useEffect(() => {
        if (!isToolOverlay || tectonModuleState?.revision !== undefined) {
            return;
        }

        publishState({
            ...TECTON_LANDSCAPE_DEFAULTS,
            status: 'TECTON LANDSCAPE READY'
        });
    }, [isToolOverlay, publishState, tectonModuleState?.revision]);

    useEffect(() => {
        publishState({
            status,
            shellMode: zenShellMode
        });
    }, [publishState, status, zenShellMode]);

    // --- KEYBOARD & MOUSE LISTENERS (SPACE MENU) ---
    useEffect(() => {
        if (isToolOverlay || isViewportHost) {
            return;
        }

        const handleMouseMove = (e: MouseEvent) => {
            mouseScreenRef.current = { x: e.clientX, y: e.clientY };
        };

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.code === 'Space' && !e.repeat && !e.ctrlKey && !e.altKey && !e.shiftKey) {
                if (document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
                    setSpaceMenuPos(mouseScreenRef.current);
                    setSpaceMenuOpen(true);
                }
            }
        };

        const handleKeyUp = (e: KeyboardEvent) => {
            if (e.code === 'Space') {
                setSpaceMenuOpen(false);
            }
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
        };
    }, [isToolOverlay, isViewportHost]);

    // --- ENGINE INITIALIZATION ---
    useEffect(() => {
        if (isToolOverlay || isViewportHost) {
            return;
        }

        let isAborted = false;

        const launch = async () => {
            if (!mountRef.current) return;

            // Pre-cleanup if re-initializing rapidly
            if (engineRef.current.renderer) {
                cancelAnimationFrame(engineRef.current.frameId);
                engineRef.current.renderer.dispose();
                if (mountRef.current) mountRef.current.innerHTML = '';
            }

            const engine = await initTectonEngine(mountRef.current, resolution, sizeX, sizeZ);

            if (isAborted) {
                // If we were cancelled during await, clean up immediately
                engine.renderer.dispose();
                return;
            }

            engineRef.current = { ...engineRef.current, ...engine };
            sculptEngineRef.current = new TectonSculptor(engine.renderer);
            setIsEngineReady(true);

            // Initial View Mode Set
            if (engine.setRenderMode) engine.setRenderMode(viewMode);

            const animate = () => {
                const r = engineRef.current;
                // If aborted (during component unmount but loop still running), stop.
                if (isAborted) return;

                r.frameId = requestAnimationFrame(animate);
                if (!r.renderer) return;

                // UPDATE LIGHTS
                if (r.dirLight) {
                    const dir = calculateSunDirection(sunAzimuth, sunElevation);
                    const dist = 10000;
                    r.dirLight.position.set(dir.x * dist, dir.y * dist, dir.z * dist);
                    r.dirLight.intensity = sunIntensity;
                }

                if (!simRef.current.isPlaying) {
                    const shouldSimulate = simRef.current.isRecording || simRef.current.isSimActive;

                    // FLUID SIMULATION STEP
                    if (shouldSimulate && r.fluidSim) {
                        if (simRef.current.activeEffect === 6) {
                            const uv = new THREE.Vector2(Math.random(), Math.random());
                            const force = new THREE.Vector2((Math.random() - 0.5) * 5, (Math.random() - 0.5) * 5);
                            r.fluidSim.splat(uv, force, new THREE.Vector3(1, 0.2, 0), 0.05);
                        }
                        r.fluidSim.update(0.016, 0.98);
                        r.simMaterial.uniforms.velocityMap.value = r.fluidSim.velocity.read.texture;
                    }

                    r.simMaterial.uniforms.blending.value = false;
                    r.simMaterial.uniforms.time.value += 0.01;
                    r.simMaterial.uniforms.isSimulating.value = shouldSimulate;
                    r.simMaterial.uniforms.activeEffect.value = simRef.current.activeEffect;

                    // Ping-Pong Targets
                    const source = r.targetA;
                    const dest = r.targetB;

                    if (r.simMaterial.uniforms.doReset.value) {
                        r.historyBuffers.forEach((b: any) => b.dispose());
                        r.historyBuffers = [];
                        r.frameStats = [];
                        setHistory([]);
                        setPlayhead(0);
                    }

                    r.simMaterial.uniforms.heightMap.value = source.texture;
                    r.renderer.setRenderTarget(dest);
                    r.renderer.render(r.simScene, r.simCamera);
                    r.renderer.setRenderTarget(null);

                    r.targetA = dest;
                    r.targetB = source;

                    if (r.simMaterial.uniforms.doReset.value) r.simMaterial.uniforms.doReset.value = false;

                    if (simRef.current.isRecording) {
                        const snap = new THREE.WebGLRenderTarget(resolution, resolution, {
                            minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter,
                            type: THREE.FloatType, format: THREE.RGBAFormat
                        });

                        r.simMaterial.uniforms.heightMap.value = r.targetA.texture;
                        r.renderer.setRenderTarget(snap);
                        r.renderer.render(r.simScene, r.simCamera);
                        r.renderer.setRenderTarget(null);

                        r.historyBuffers.push(snap);
                        r.frameStats.push(simRef.current.activeEffect > 0 ? simRef.current.activeEffect / 5.0 : 0.05);

                        if (r.historyBuffers.length > maxFrames) {
                            const old = r.historyBuffers.shift();
                            old.dispose();
                            r.frameStats.shift();
                        }

                        if (r.historyBuffers.length % 5 === 0) {
                            setPlayhead(r.historyBuffers.length);
                            setHistory(new Array(r.historyBuffers.length).fill(0));
                            drawTimeline();
                        }
                    }

                    // UPDATE RENDER MATERIALS
                    // Update Custom Shader
                    if (r.customMaterial) {
                        r.customMaterial.uniforms.heightMap.value = r.targetA.texture;
                    }

                    // Update PBR Material (Standard)
                    if (r.standardMaterial) {
                        r.standardMaterial.displacementMap = r.targetA.texture;
                        // For correct shadow casting self-shadowing needs displacement in depth material too
                        if (r.mesh && r.mesh.customDepthMaterial) {
                            r.mesh.customDepthMaterial.displacementMap = r.targetA.texture;
                        }
                    }
                }

                if (r.controls) r.controls.update();
                r.renderer.render(r.scene, r.camera);
            };
            animate();
        };
        launch();

        const handleResize = () => {
            if (!mountRef.current || !engineRef.current.camera || !engineRef.current.renderer) return;
            const w = mountRef.current.clientWidth;
            const h = mountRef.current.clientHeight;
            engineRef.current.camera.aspect = w / h;
            engineRef.current.camera.updateProjectionMatrix();
            engineRef.current.renderer.setSize(w, h);
        };
        window.addEventListener('resize', handleResize);

        return () => {
            isAborted = true; // Signal abort
            window.removeEventListener('resize', handleResize);
            if (engineRef.current.renderer) {
                engineRef.current.renderer.dispose();
                cancelAnimationFrame(engineRef.current.frameId);
            }
            if (engineRef.current.fluidSim) engineRef.current.fluidSim.dispose();
        };
    }, [isToolOverlay, isViewportHost, resolution]);

    // Handle View Mode Switching
    useEffect(() => {
        if (engineRef.current && engineRef.current.setRenderMode) {
            engineRef.current.setRenderMode(viewMode);
        }
    }, [viewMode]);

    // Handle Height Scale Update
    useEffect(() => {
        if (engineRef.current) {
            const r = engineRef.current;
            if (r.customMaterial) r.customMaterial.uniforms.heightScale.value = heightScale;
            if (r.standardMaterial) {
                r.standardMaterial.displacementScale = heightScale;
                if (r.mesh?.customDepthMaterial) r.mesh.customDepthMaterial.displacementScale = heightScale;
            }
        }
    }, [heightScale]);

    // Handle Geometry Resize Dynamic
    useEffect(() => {
        if (engineRef.current.updateGeometry) {
            engineRef.current.updateGeometry(sizeX, sizeZ, resolution);
        }
    }, [sizeX, sizeZ, resolution]);

    // Handle Ref Sphere
    useEffect(() => {
        if (engineRef.current.toggleRefSphere) {
            engineRef.current.toggleRefSphere(showRefSphere);
        }
    }, [showRefSphere]);

    // Sync Playhead
    useEffect(() => {
        let interval: any;
        if (isPlaying && history.length > 0) {
            interval = setInterval(() => {
                setPlayhead(p => {
                    if (p >= history.length - 1) return 0;
                    return p + 1;
                });
            }, 32 / timeDilation);
        }
        return () => clearInterval(interval);
    }, [isPlaying, history.length, timeDilation]);

    useEffect(() => {
        const r = engineRef.current;
        if ((isPlaying || (!isRecording && !isSimActive)) && r.historyBuffers.length > 0) {
            const idx = Math.floor(playhead);
            const buf = r.historyBuffers[idx];
            if (buf) {
                // Update Custom Shader
                if (r.customMaterial) r.customMaterial.uniforms.heightMap.value = buf.texture;

                // Update PBR Material (Standard)
                if (r.standardMaterial) {
                    r.standardMaterial.displacementMap = buf.texture;
                    if (r.mesh?.customDepthMaterial) r.mesh.customDepthMaterial.displacementMap = buf.texture;
                }

                // Update Sim State
                r.simMaterial.uniforms.heightMap.value = buf.texture;
                r.renderer.setRenderTarget(r.targetA);
                r.renderer.render(r.simScene, r.simCamera);
                r.renderer.setRenderTarget(null);
            }
        }
    }, [playhead, isPlaying, isRecording, isSimActive]);

    useEffect(() => {
        simRef.current.activeEffect = activeEffect;
        simRef.current.isRecording = isRecording;
        simRef.current.isPlaying = isPlaying;
        simRef.current.isSimActive = isSimActive;
    }, [activeEffect, isRecording, isPlaying, isSimActive]);

    useEffect(() => {
        if (engineRef.current.simMaterial) {
            engineRef.current.simMaterial.uniforms.simSpeed.value = simSpeed;
        }
        if (engineRef.current.material) {
            engineRef.current.material.uniforms.heightScale.value = heightScale;
            engineRef.current.material.uniforms.viewMode.value = viewMode;
            engineRef.current.material.uniforms.sunIntensity.value = sunIntensity;
            const dir = calculateSunDirection(sunAzimuth, sunElevation);
            engineRef.current.material.uniforms.sunDir.value.copy(dir);
        }
    }, [simSpeed, heightScale, viewMode, sunAzimuth, sunElevation, sunIntensity]);

    const drawTimeline = () => {
        const cvs = timelineRef.current;
        if (!cvs) return;
        const ctx = cvs.getContext('2d');
        if (!ctx) return;
        const w = cvs.width;
        const h = cvs.height;
        const stats = engineRef.current.frameStats || [];

        ctx.clearRect(0, 0, w, h);
        ctx.fillStyle = '#050505';
        ctx.fillRect(0, 0, w, h);

        if (stats.length === 0) return;

        ctx.beginPath();
        ctx.moveTo(0, h);
        for (let i = 0; i < stats.length; i++) {
            const val = stats[i];
            const xPos = (i / maxFrames) * w;
            const barH = val * h * 0.9;
            ctx.lineTo(xPos, h - barH);
        }
        ctx.lineTo((stats.length / maxFrames) * w, h);

        const grad = ctx.createLinearGradient(0, 0, 0, h);
        grad.addColorStop(0, '#10b981');
        grad.addColorStop(1, '#00ffcc');

        ctx.fillStyle = grad;
        ctx.globalAlpha = 0.4;
        ctx.fill();
        ctx.strokeStyle = '#00ffcc';
        ctx.lineWidth = 2;
        ctx.globalAlpha = 1.0;
        ctx.stroke();
    };

    const resetSimulationWithData = (data: Float32Array) => {
        const r = engineRef.current;
        const THREE = r.THREE;

        const newTex = new THREE.DataTexture(data, resolution, resolution, THREE.RGBAFormat, THREE.FloatType);
        newTex.needsUpdate = true;

        r.simMaterial.uniforms.heightMap.value = newTex;
        r.renderer.setRenderTarget(r.targetA);
        r.renderer.render(r.simScene, r.simCamera);
        r.renderer.setRenderTarget(null);

        r.historyBuffers.forEach((b: any) => b.dispose());
        r.historyBuffers = [];
        r.frameStats = [];
        setHistory([]);
        setPlayhead(0);
    };

    const handleCreateLandscape = () => {
        const nextLandscapeConfig = coerceTectonLandscapeConfig({
            sizeX,
            sizeZ,
            heightScale,
            resolution,
            seed,
            revision: resolvedLandscapeConfig.revision + 1
        });

        publishState({ ...nextLandscapeConfig });
        publishSelection({
            activeAssetId: preserveActiveArtifact ? activeWorkspaceAssetId ?? null : null,
            activeEntityId: preserveActiveArtifact ? sharedState?.activeEntityId ?? null : null,
            activeLayerId: TECTON_LANDSCAPE_LAYER_ID
        });
        setStatus(landscapeReady ? 'LANDSCAPE REBUILT' : 'LANDSCAPE CREATED');
    };

    const handleGenerateRandom = () => {
        const data = generateTerrainData(resolution, resolution, Math.random() * 10000);
        resetSimulationWithData(data);
        setStatus("NOISE GENERATED");
    };

    const handleReset = () => {
        if (engineRef.current.simMaterial) {
            engineRef.current.simMaterial.uniforms.doReset.value = true;
            setStatus("SIMULATION RESET");
        }
    };

    const generateTerrain = async () => {
        setIsProcessing(true); setStatus("FORGING HEIGHTMAP...");
        try {
            const ai = new GoogleGenAI({ apiKey });
            const response = await ai.models.generateImages({
                model: 'imagen-4.0-generate-001',
                prompt: `Top down orthographic heightmap of ${prompt}. 16-bit greyscale DEM style. High contrast. No labels.`,
                config: { numberOfImages: 1, aspectRatio: '1:1', outputMimeType: 'image/png' }
            });
            if (response.generatedImages?.[0]?.image?.imageBytes) {
                const img = new Image();
                img.src = `data:image/png;base64,${response.generatedImages[0].image.imageBytes}`;
                img.onload = () => {
                    const cvs = document.createElement('canvas'); cvs.width = resolution; cvs.height = resolution;
                    const ctx = cvs.getContext('2d');
                    if (ctx) {
                        ctx.drawImage(img, 0, 0, resolution, resolution);
                        const iData = ctx.getImageData(0, 0, resolution, resolution).data;
                        const fData = new Float32Array(resolution * resolution * 4);
                        for (let i = 0; i < resolution * resolution; i++) {
                            fData[i * 4] = iData[i * 4] / 255.0;
                            fData[i * 4 + 1] = 0;
                            fData[i * 4 + 2] = 0;
                            fData[i * 4 + 3] = 1;
                        }
                        resetSimulationWithData(fData);
                        setStatus("AI HEIGHTMAP INJECTED");
                    }
                };
            }
        } catch (e) { setStatus("AI ERROR"); console.error(e); }
        finally { setIsProcessing(false); }
    };

    const handleAsteroid = () => {
        const r = engineRef.current;
        if (!r.targetA || !sculptEngineRef.current) return;

        // Random Impact Zone
        const uv = new THREE.Vector2(0.2 + Math.random() * 0.6, 0.2 + Math.random() * 0.6);

        // Apply MAX DESTRUCTION
        sculptEngineRef.current.applyBrush(r.targetA, r.targetB, uv, {
            radius: asteroidParams.radius,
            strength: asteroidParams.strength,
            mode: 6 // CRATER
        });

        // Swap to show
        const temp = r.targetA;
        r.targetA = r.targetB;
        r.targetB = temp;

        setStatus("☄️ IMPACT DETECTED ☄️");

        // screenshake fake
        const originalY = r.camera.position.y;

        // Simple cam shake effect
        let shake = 20;
        const shakeInt = setInterval(() => {
            r.camera.position.x += (Math.random() - 0.5) * shake;
            r.camera.position.z += (Math.random() - 0.5) * shake;
            shake *= 0.9;
            if (shake < 1) {
                clearInterval(shakeInt);
                // Reset cam to center-ish (OrbitControls usually handles this but we just shook the camera object)
                // Actually OrbitControls might fight this. 
                // A safer bet is just setting status.
            }
        }, 16);
    };

    const generateTexture = async () => {
        setIsProcessing(true); setStatus("PAINTING TEXTURE...");
        try {
            const ai = new GoogleGenAI({ apiKey });
            const response = await ai.models.generateImages({
                model: 'imagen-4.0-generate-001',
                prompt: `Top down satellite texture of ${prompt}. Photorealistic, game asset, consistent lighting.`,
                config: { numberOfImages: 1, aspectRatio: '1:1', outputMimeType: 'image/jpeg' }
            });
            if (response.generatedImages?.[0]?.image?.imageBytes) {
                const tex = new engineRef.current.THREE.TextureLoader().load(`data:image/jpeg;base64,${response.generatedImages[0].image.imageBytes}`);
                tex.colorSpace = THREE.SRGBColorSpace;

                // Update Material(s)
                const r = engineRef.current;
                if (r.customMaterial) {
                    r.customMaterial.uniforms.albedoMap.value = tex;
                    r.customMaterial.uniforms.useAlbedoMap.value = true;
                }
                if (r.standardMaterial) {
                    r.standardMaterial.map = tex;
                    r.standardMaterial.needsUpdate = true;
                }

                setStatus("AI TEXTURE APPLIED");
            }
        } catch (e) { setStatus("AI ERROR"); }
        finally { setIsProcessing(false); }
    };

    const handleHeightmapUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (evt) => {
            const img = new Image(); img.src = evt.target?.result as string;
            img.onload = () => {
                const cvs = document.createElement('canvas'); cvs.width = resolution; cvs.height = resolution;
                const ctx = cvs.getContext('2d');
                if (ctx) {
                    ctx.drawImage(img, 0, 0, resolution, resolution);
                    const iData = ctx.getImageData(0, 0, resolution, resolution).data;
                    const fData = new Float32Array(resolution * resolution * 4);
                    for (let i = 0; i < resolution * resolution; i++) { fData[i * 4] = iData[i * 4] / 255.0; fData[i * 4 + 3] = 1; }
                    resetSimulationWithData(fData);
                    setStatus("HEIGHTMAP IMPORTED");
                }
            }
        };
        reader.readAsDataURL(file);
    };

    // --- PRO EXPORT SUITE ---

    const handleExportZIP = async () => {
        if (!engineRef.current || !engineRef.current.historyBuffers.length) return;
        setStatus("PREPARING ZIP...");

        // Load JSZip
        if (!(window as any).JSZip) await loadScript("https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js");
        const zip = new (window as any).JSZip();

        const r = engineRef.current;
        const w = resolution; const h = resolution;

        // We use a temp canvas to convert pixels to PNG
        const cvs = document.createElement('canvas');
        cvs.width = w; cvs.height = h;
        const ctx = cvs.getContext('2d');
        if (!ctx) return;

        const buffer = new Float32Array(w * h * 4);
        let processed = 0;

        // Async loop to prevent freeze
        const processFrame = async (i: number) => {
            if (i >= r.historyBuffers.length) {
                setStatus("COMPRESSING...");
                const blob = await zip.generateAsync({ type: "blob" });
                // Trigger Download
                downloadBlob(blob, "Tecton_Sequence.zip");
                // Also commit to Kernel if needed
                if (onCommit) onCommit(blob, "Tecton_Sequence.zip");
                setStatus("ZIP COMPLETE");
                return;
            }

            setStatus(`PROCESSING FRAME ${i}/${r.historyBuffers.length}`);

            // Read frame to buffer
            r.renderer.readRenderTargetPixels(r.historyBuffers[i], 0, 0, w, h, buffer);

            // Draw to canvas (convert float to byte)
            const iData = ctx.createImageData(w, h);
            for (let k = 0; k < w * h; k++) {
                const val = Math.floor(buffer[k * 4] * 255);
                iData.data[k * 4] = val;
                iData.data[k * 4 + 1] = val;
                iData.data[k * 4 + 2] = val;
                iData.data[k * 4 + 3] = 255;
            }
            ctx.putImageData(iData, 0, 0);

            // Add to zip
            const blob = await new Promise(res => cvs.toBlob(res as any));
            zip.file(`frame_${String(i).padStart(4, '0')}.png`, blob);

            requestAnimationFrame(() => processFrame(i + 1));
        };
        processFrame(0);
    };

    const handleExportGLB = () => {
        const r = engineRef.current;
        const THREE = r.THREE;
        if (!r.historyBuffers.length) return;

        setStatus("GENERATING MORPHS...");

        // 1. Setup Base Geometry (Low Res for performance)
        const exportRes = 128; // Reduced resolution for GLB export to avoid 2GB limit/crash
        const geo = new THREE.PlaneGeometry(sizeX, sizeZ, exportRes - 1, exportRes - 1);
        geo.rotateX(-Math.PI / 2);

        // 2. Setup Morph Attributes
        const pos = geo.attributes.position;
        const vertexCount = pos.count;

        // Stride to limit Morph Targets (Max ~50-100 recommended)
        const totalFrames = r.historyBuffers.length;
        const maxTargets = 60;
        const stride = Math.ceil(totalFrames / maxTargets);

        const morphPositions = [];
        const usedFrames = [];

        const readBuffer = new Float32Array(resolution * resolution * 4);

        for (let i = 0; i < totalFrames; i += stride) {
            setStatus(`BAKING FRAME ${i}/${totalFrames}`);

            // Read full res data
            r.renderer.readRenderTargetPixels(r.historyBuffers[i], 0, 0, resolution, resolution, readBuffer);

            // Sample to export mesh
            const morphPos = new Float32Array(vertexCount * 3);

            for (let v = 0; v < vertexCount; v++) {
                // Get UV of vertex
                // Grid is row-major. 
                const x = v % exportRes;
                const y = Math.floor(v / exportRes);

                // Map to source resolution
                // We need to sample nearest neighbor or bilinear from readBuffer
                const u = x / (exportRes - 1);
                const vCoord = 1.0 - (y / (exportRes - 1)); // Flip Y usually for Texture

                const srcX = Math.floor(u * (resolution - 1));
                const srcY = Math.floor(vCoord * (resolution - 1));

                const srcIdx = (srcY * resolution + srcX) * 4;
                const heightVal = readBuffer[srcIdx];

                const px = pos.getX(v);
                const pz = pos.getZ(v); // Grid is flat on XZ, Y is up

                morphPos[v * 3] = px;
                morphPos[v * 3 + 1] = heightVal * heightScale;
                morphPos[v * 3 + 2] = pz;
            }

            morphPositions.push(new THREE.Float32BufferAttribute(morphPos, 3));
            usedFrames.push(i);
        }

        geo.morphAttributes.position = morphPositions;

        // 3. Setup Mesh
        const mat = new THREE.MeshStandardMaterial({ color: 0x888888, roughness: 0.8, morphTargets: true });
        const exportMesh = new THREE.Mesh(geo, mat);
        exportMesh.name = "Tecton_Anim_Terrain";

        // 4. Setup Animation Clip
        const times = [];
        const values = [];

        // For N morph targets, we have N tracks? 
        // Or one track with N*Values?
        // Standard GLTF: Each morph target has a weight 0..1
        // We want to sequence them. 
        // Frame 0: Target 0 = 1, others 0
        // Frame 1: Target 1 = 1, others 0

        // Actually simpler: We create keyframes where at time T, MorphTarget I is 1.0
        const duration = totalFrames * (1 / 30); // 30fps assumption
        const frameDuration = duration / usedFrames.length;

        // ThreeJS AnimationClip expects tracks like: .morphTargetInfluences[0], .morphTargetInfluences[1]...
        // This is heavy. Optimized way: 
        // Just export the targets. User handles animation? 
        // NO, User asked for "recorded it".

        const tracks = [];
        for (let t = 0; t < morphPositions.length; t++) {
            const trackTimes = [];
            const trackValues = [];

            // Simple discrete switching
            // At time t, value is 1. At time t-1 and t+1, value is 0.

            for (let f = 0; f < usedFrames.length; f++) {
                const time = f * frameDuration;
                trackTimes.push(time);
                trackValues.push(f === t ? 1 : 0);
            }

            const track = new THREE.NumberKeyframeTrack(
                `.morphTargetInfluences[${t}]`,
                trackTimes,
                trackValues
            );
            tracks.push(track);
        }

        const clip = new THREE.AnimationClip("Tecton_Sim", -1, tracks);

        // 5. Export
        setStatus("WRITING GLB...");
        const exporter = new THREE.GLTFExporter();
        exporter.parse(exportMesh, (gltf: any) => {
            const blob = new Blob([gltf], { type: 'application/octet-stream' });
            downloadBlob(blob, "K-TECTON_ANIM.glb");
            if (onCommit) { onCommit(blob, "K-TECTON_ANIM.glb"); }
            setStatus("ANIMATION EXPORTED");
        }, {
            binary: true,
            animations: [clip]
        });
    };

    const handleCommit = () => {
        const r = engineRef.current;
        const THREE = r.THREE;
        setStatus("BAKING GEOMETRY...");

        const w = resolution; const h = resolution;
        const buffer = new Float32Array(w * h * 4);
        r.renderer.readRenderTargetPixels(r.targetA, 0, 0, w, h, buffer);

        const geo = new THREE.PlaneGeometry(sizeX, sizeZ, w - 1, h - 1);
        geo.rotateX(-Math.PI / 2);
        const pos = geo.attributes.position;

        for (let i = 0; i < pos.count; i++) {
            const idx = i * 4;
            const val = buffer[idx];
            pos.setY(i, val * heightScale);
        }
        geo.computeVertexNormals();

        const exportMat = new THREE.MeshStandardMaterial({ color: 0x888888, roughness: 0.8 });
        if (r.material.uniforms.useAlbedoMap.value) exportMat.map = r.material.uniforms.albedoMap.value;

        const exportMesh = new THREE.Mesh(geo, exportMat);
        exportMesh.name = "Tecton_Terrain";

        const exporter = new THREE.GLTFExporter();
        exporter.parse(exportMesh, (gltf: any) => {
            const blob = new Blob([gltf], { type: 'application/octet-stream' });
            if (onCommit) { onCommit(blob, "K-TECTON_TERRAIN"); setStatus("SENT TO KERNEL"); }
        }, { binary: true });
    };

    const { handleMouseDown, handleMouseMove, handleMouseUp } = useKTectonInteraction(
        mountRef, engineRef,
        { activeTab: activeRightTab === 'sculpt' ? 'sculpt' : 'create', brushSize, brushStrength, sculptMode, heightScale },
        sculptEngineRef,
        { sizeX, sizeZ },
        !isToolOverlay && !isViewportHost
    );

    if (isViewportHost) {
        return null;
    }

    if (isToolOverlay) {
        return (
            <div className="pointer-events-none flex h-full w-full overflow-hidden bg-transparent font-mono text-[#e0e0e0] select-none">
                <div className="pointer-events-auto">
                    <KTectonLeftPanel
                        isOpen={leftPanelOpen}
                        setIsOpen={setLeftPanelOpen}
                        activeTab={activeLeftTab}
                        setActiveTab={setActiveLeftTab}
                        shellMode="tool-overlay"
                        sizeX={sizeX}
                        setSizeX={setSizeX}
                        sizeZ={sizeZ}
                        setSizeZ={setSizeZ}
                        heightScale={heightScale}
                        setHeightScale={setHeightScale}
                        resolution={resolution}
                        setResolution={setResolution}
                        seed={seed}
                        setSeed={setSeed}
                        prompt={prompt}
                        setPrompt={setPrompt}
                        isProcessing={false}
                        generateTerrain={generateTerrain}
                        generateTexture={generateTexture}
                        handleGenerateRandom={handleGenerateRandom}
                        createLandscape={handleCreateLandscape}
                        landscapeReady={landscapeReady}
                        landscapeLabel={landscapeLabel}
                        sunIntensity={sunIntensity}
                        setSunIntensity={setSunIntensity}
                        sunAzimuth={sunAzimuth}
                        setSunAzimuth={setSunAzimuth}
                        sunElevation={sunElevation}
                        setSunElevation={setSunElevation}
                        scene={null}
                        renderer={null}
                    />
                </div>
                <div className="flex-1" />
            </div>
        );
    }

    return (
        <div className="flex h-full w-full bg-[#050505] text-[#e0e0e0] font-mono overflow-hidden select-none">
            <KTectonSpaceMenu
                visible={spaceMenuOpen}
                position={spaceMenuPos}
                activeEffect={activeEffect}
                setActiveEffect={setActiveEffect}
                isSimActive={isSimActive}
                setIsSimActive={setIsSimActive}
                simSpeed={simSpeed}
                setSimSpeed={setSimSpeed}
                handleReset={handleReset}
            />

            <KTectonLeftPanel
                isOpen={leftPanelOpen}
                setIsOpen={setLeftPanelOpen}
                activeTab={activeLeftTab}
                setActiveTab={setActiveLeftTab}
                shellMode="standalone"
                sizeX={sizeX}
                setSizeX={setSizeX}
                sizeZ={sizeZ}
                setSizeZ={setSizeZ}
                heightScale={heightScale}
                setHeightScale={setHeightScale}
                resolution={resolution}
                setResolution={setResolution}
                seed={seed}
                setSeed={setSeed}
                prompt={prompt}
                setPrompt={setPrompt}
                isProcessing={isProcessing}
                generateTerrain={generateTerrain}
                generateTexture={generateTexture}
                handleGenerateRandom={handleGenerateRandom}
                createLandscape={handleCreateLandscape}
                landscapeReady={landscapeReady}
                landscapeLabel={landscapeLabel}
                sunIntensity={sunIntensity}
                setSunIntensity={setSunIntensity}
                sunAzimuth={sunAzimuth}
                setSunAzimuth={setSunAzimuth}
                sunElevation={sunElevation}
                setSunElevation={setSunElevation}
                scene={engineRef.current?.scene}
                renderer={engineRef.current?.renderer}
            />

            <div className="flex-1 relative h-full min-w-0 flex flex-col">
                <KTectonTopBar
                    viewMode={viewMode}
                    setViewMode={setViewMode}
                    showSequencer={showSequencer}
                    setShowSequencer={setShowSequencer}
                    handleHeightmapUpload={handleHeightmapUpload}
                    status={status}
                    onCommit={handleCommit}
                    asteroidParams={asteroidParams}
                    setAsteroidParams={setAsteroidParams}
                    handleAsteroid={handleAsteroid}
                />

                <div
                    ref={mountRef}
                    className="absolute inset-0 w-full h-full z-0 cursor-crosshair"
                    onPointerDownCapture={handleMouseDown}
                    onPointerMoveCapture={handleMouseMove}
                    onPointerUpCapture={handleMouseUp}
                />

                {showSequencer && (
                    <div className="absolute bottom-0 left-0 right-0 z-50 pointer-events-auto">
                        <KTectonSequencer
                            isRecording={isRecording}
                            setIsRecording={setIsRecording}
                            timelineRef={timelineRef}
                            playhead={playhead}
                            setPlayhead={setPlayhead}
                            isPlaying={isPlaying}
                            setIsPlaying={setIsPlaying}
                            maxFrames={maxFrames}
                            timeDilation={timeDilation}
                            setTimeDilation={setTimeDilation}
                            overwriteMode={overwriteMode}
                            setOverwriteMode={setOverwriteMode}
                            frameStats={engineRef.current?.frameStats || []}
                            onExportGLB={handleExportGLB}
                            onExportZIP={handleExportZIP}
                        />
                    </div>
                )}
            </div>

            <KTectonRightPanel
                isOpen={rightPanelOpen}
                setIsOpen={setRightPanelOpen}
                activeTab={activeRightTab}
                setActiveTab={setActiveRightTab}
                sculptMode={sculptMode}
                setSculptMode={setSculptMode}
                brushSize={brushSize}
                setBrushSize={setBrushSize}
                brushStrength={brushStrength}
                setBrushStrength={setBrushStrength}
            />
        </div>
    );
}
