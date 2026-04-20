import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { Maximize2, Grid3X3, Eye, EyeOff } from 'lucide-react';

// Checkerboard shader for transparency visualization
const CheckerboardShader = {
    vertexShader: `
        varying vec2 vUv;
        void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `,
    fragmentShader: `
        uniform float scale;
        varying vec2 vUv;
        void main() {
            vec2 p = floor(vUv * scale);
            float checker = mod(p.x + p.y, 2.0);
            gl_FragColor = vec4(vec3(checker * 0.08 + 0.06), 1.0);
        }
    `
};

interface KPainterUVViewProps {
    // Texture set meshes to display UVs for
    meshes: THREE.Mesh[];
    // The composite layer (PaintLayer) to retrieve textures from
    compositeLayer: any | null;
    // Which channel to display
    viewChannel: 'BASE' | 'NORMAL' | 'ROUGHNESS' | 'METALNESS' | 'EMISSION' | 'MATERIAL';
    // Version trigger for updates
    version?: number;
    // Callback for pointer events (for painting)
    onPointerDown?: (uv: THREE.Vector2, e: React.PointerEvent) => void;
    onPointerMove?: (uv: THREE.Vector2, e: React.PointerEvent) => void;
    onPointerUp?: (e: React.PointerEvent) => void;
    // Cursor mesh for showing brush position
    cursorSize?: number;
    cursorColor?: string;
    transparentBackground?: boolean;
}

export default function KPainterUVView({
    meshes,
    compositeLayer,
    viewChannel,
    version,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    cursorSize = 0.05,
    cursorColor = '#3daee9',
    transparentBackground = false
}: KPainterUVViewProps) {
    const mountRef = useRef<HTMLDivElement>(null);

    // View state
    const [zoom, setZoom] = useState(1.0);
    const [pan, setPan] = useState({ x: 0, y: 0 });
    const [uvBounds, setUvBounds] = useState({ minU: -0.1, maxU: 1.1, minV: -0.1, maxV: 1.1 });

    // Display toggles
    const [showGrid, setShowGrid] = useState(true);
    const [showWireframe, setShowWireframe] = useState(true);
    const [showCheckerboard, setShowCheckerboard] = useState(!transparentBackground);

    // Interaction state
    const isPointerDown = useRef(false);
    const isPanning = useRef(false);
    const lastPanPos = useRef({ x: 0, y: 0 });

    // Refs for animation loop access
    const compositeLayerRef = useRef(compositeLayer);
    const viewChannelRef = useRef(viewChannel);
    useEffect(() => { compositeLayerRef.current = compositeLayer; }, [compositeLayer]);
    useEffect(() => { viewChannelRef.current = viewChannel; }, [viewChannel]);

    const engine = useRef<{
        scene: THREE.Scene | null;
        camera: THREE.OrthographicCamera | null;
        renderer: THREE.WebGLRenderer | null;
        grid: THREE.GridHelper | null;
        uvLines: THREE.LineSegments | null;
        boundsBox: THREE.LineSegments | null;
        textureQuad: THREE.Mesh | null;
        checkerboard: THREE.Mesh | null;
        brushCursor: THREE.Mesh | null;
        animationId: number | null;
    }>({
        scene: null,
        camera: null,
        renderer: null,
        grid: null,
        uvLines: null,
        boundsBox: null,
        textureQuad: null,
        checkerboard: null,
        brushCursor: null,
        animationId: null
    });

    // Calculate UV bounds from all meshes
    const calculateUVBounds = useCallback(() => {
        if (!meshes || meshes.length === 0) {
            return { minU: -0.1, maxU: 1.1, minV: -0.1, maxV: 1.1 };
        }

        let minU = Infinity, maxU = -Infinity;
        let minV = Infinity, maxV = -Infinity;

        meshes.forEach(mesh => {
            if (!mesh?.geometry?.attributes?.uv) return;
            const uv = mesh.geometry.attributes.uv;

            for (let i = 0; i < uv.count; i++) {
                const u = uv.getX(i);
                const v = uv.getY(i);
                minU = Math.min(minU, u);
                maxU = Math.max(maxU, u);
                minV = Math.min(minV, v);
                maxV = Math.max(maxV, v);
            }
        });

        // Handle no valid UVs case
        if (!isFinite(minU)) {
            return { minU: -0.1, maxU: 1.1, minV: -0.1, maxV: 1.1 };
        }

        // Add 10% padding
        const paddingU = Math.max((maxU - minU) * 0.1, 0.1);
        const paddingV = Math.max((maxV - minV) * 0.1, 0.1);

        return {
            minU: minU - paddingU,
            maxU: maxU + paddingU,
            minV: minV - paddingV,
            maxV: maxV + paddingV
        };
    }, [meshes]);

    // Frame all UVs in view
    const frameAll = useCallback(() => {
        const bounds = calculateUVBounds();
        setUvBounds(bounds);
        setZoom(1.0);
        setPan({ x: 0, y: 0 });
    }, [calculateUVBounds]);

    // Update UV wireframe
    const updateUVWireframe = useCallback(() => {
        const { scene, uvLines } = engine.current;
        if (!scene) return;

        // Remove old lines
        if (uvLines) {
            scene.remove(uvLines);
            uvLines.geometry.dispose();
            (uvLines.material as THREE.Material).dispose();
        }

        if (!meshes || meshes.length === 0) {
            engine.current.uvLines = null;
            return;
        }

        const positions: number[] = [];

        meshes.forEach(mesh => {
            if (!mesh?.geometry) return;
            const uv = mesh.geometry.attributes.uv;
            const index = mesh.geometry.index;

            if (!uv) return;

            const count = index ? index.count / 3 : uv.count / 3;
            for (let i = 0; i < count; i++) {
                let a, b, c;
                if (index) {
                    a = index.getX(i * 3);
                    b = index.getX(i * 3 + 1);
                    c = index.getX(i * 3 + 2);
                } else {
                    a = i * 3; b = i * 3 + 1; c = i * 3 + 2;
                }

                const u1 = uv.getX(a), v1 = uv.getY(a);
                const u2 = uv.getX(b), v2 = uv.getY(b);
                const u3 = uv.getX(c), v3 = uv.getY(c);

                // Triangle edges
                positions.push(u1, v1, 0.002, u2, v2, 0.002);
                positions.push(u2, v2, 0.002, u3, v3, 0.002);
                positions.push(u3, v3, 0.002, u1, v1, 0.002);
            }
        });

        if (positions.length > 0) {
            const geo = new THREE.BufferGeometry();
            geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
            const mat = new THREE.LineBasicMaterial({
                color: 0x22d3ee,
                opacity: 0.6,
                transparent: true,
                depthTest: false
            });
            const lines = new THREE.LineSegments(geo, mat);
            lines.renderOrder = 10;
            scene.add(lines);
            engine.current.uvLines = lines;
        }
    }, [meshes]);

    // Initialize 2D Engine
    useEffect(() => {
        if (!mountRef.current) return;

        const container = mountRef.current;
        const w = container.clientWidth;
        const h = container.clientHeight;

        // Renderer
        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        renderer.setSize(w, h);
        renderer.setClearColor(0x000000, transparentBackground ? 0 : 1);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        container.appendChild(renderer.domElement);

        // Scene
        const scene = new THREE.Scene();

        // Ortho Camera
        const camera = new THREE.OrthographicCamera(-0.1, 1.1, 1.1, -0.1, 0.1, 100);
        camera.position.z = 10;

        // Checkerboard Background
        const checkerGeo = new THREE.PlaneGeometry(10, 10);
        const checkerMat = new THREE.ShaderMaterial({
            uniforms: { scale: { value: 32.0 } },
            vertexShader: CheckerboardShader.vertexShader,
            fragmentShader: CheckerboardShader.fragmentShader,
            depthTest: false,
            depthWrite: false
        });
        const checkerboard = new THREE.Mesh(checkerGeo, checkerMat);
        checkerboard.position.set(0.5, 0.5, -0.1);
        checkerboard.renderOrder = 0;
        checkerboard.visible = !transparentBackground;
        scene.add(checkerboard);

        // Texture Display Quad
        const textureQuad = new THREE.Mesh(
            new THREE.PlaneGeometry(1, 1),
            new THREE.MeshBasicMaterial({
                transparent: true,
                opacity: 1.0,
                depthTest: false,
                depthWrite: false
            })
        );
        textureQuad.position.set(0.5, 0.5, 0);
        textureQuad.renderOrder = 1;
        scene.add(textureQuad);

        // Grid
        const grid = new THREE.GridHelper(2, 20, 0x444444, 0x222222);
        grid.rotation.x = Math.PI / 2;
        grid.position.set(0.5, 0.5, 0.001);
        grid.renderOrder = 2;
        scene.add(grid);

        // UV Bounds Box
        const boundsGeo = new THREE.BufferGeometry();
        boundsGeo.setAttribute('position', new THREE.Float32BufferAttribute([
            0, 0, 0.003, 1, 0, 0.003,
            1, 0, 0.003, 1, 1, 0.003,
            1, 1, 0.003, 0, 1, 0.003,
            0, 1, 0.003, 0, 0, 0.003
        ], 3));
        const boundsMat = new THREE.LineBasicMaterial({
            color: 0x3daee9,
            opacity: 0.8,
            transparent: true,
            linewidth: 2,
            depthTest: false
        });
        const boundsBox = new THREE.LineSegments(boundsGeo, boundsMat);
        boundsBox.renderOrder = 5;
        scene.add(boundsBox);

        // Brush Cursor
        const cursorGeo = new THREE.RingGeometry(0.02, 0.025, 32);
        const cursorMat = new THREE.MeshBasicMaterial({
            color: parseInt(cursorColor.replace('#', '0x')),
            transparent: true,
            opacity: 0.8,
            depthTest: false,
            side: THREE.DoubleSide
        });
        const brushCursor = new THREE.Mesh(cursorGeo, cursorMat);
        brushCursor.visible = false;
        brushCursor.renderOrder = 100;
        scene.add(brushCursor);

        engine.current = {
            scene, camera, renderer, grid, uvLines: null,
            boundsBox, textureQuad, checkerboard, brushCursor, animationId: null
        };

        // Animation loop
        const animate = () => {
            engine.current.animationId = requestAnimationFrame(animate);

            // Dynamic Texture Update
            const layer = compositeLayerRef.current;
            const channelName = viewChannelRef.current;
            const channelMap: Record<string, string> = {
                'BASE': 'albedo', 'MATERIAL': 'albedo',
                'NORMAL': 'normal', 'ROUGHNESS': 'roughness',
                'METALNESS': 'metalness', 'EMISSION': 'emission'
            };
            const targetChannel = channelMap[channelName] || 'albedo';

            if (layer && engine.current.textureQuad) {
                // Poll for the current texture (handles ping-pong buffer swaps)
                const tex = layer.getRead(targetChannel)?.texture;
                const mat = engine.current.textureQuad.material as THREE.MeshBasicMaterial;
                if (tex && mat.map !== tex) {
                    mat.map = tex;
                    mat.needsUpdate = true;
                }
            }

            renderer.render(scene, camera);
        };
        animate();

        // Initial update
        setTimeout(frameAll, 100);

        return () => {
            if (engine.current.animationId) cancelAnimationFrame(engine.current.animationId);
            renderer.dispose();
            if (container.contains(renderer.domElement)) container.removeChild(renderer.domElement);
        };
    }, []); // Run once on mount

    // Update camera when bounds/zoom/pan change
    useEffect(() => {
        if (!mountRef.current || !engine.current.camera || !engine.current.grid) return;

        const { camera, grid, scene, checkerboard } = engine.current;
        if (!camera || !scene) return;

        const nw = mountRef.current.clientWidth;
        const nh = mountRef.current.clientHeight;

        // Update grid
        const gridSize = Math.max(
            Math.abs(uvBounds.maxU - uvBounds.minU),
            Math.abs(uvBounds.maxV - uvBounds.minV),
            2
        ) * 2;

        if (grid) {
            scene.remove(grid);
            const newGrid = new THREE.GridHelper(gridSize, Math.ceil(gridSize * 10), 0x444444, 0x222222);
            newGrid.rotation.x = Math.PI / 2;
            newGrid.position.set(
                (uvBounds.minU + uvBounds.maxU) / 2,
                (uvBounds.minV + uvBounds.maxV) / 2,
                0.001
            );
            newGrid.visible = showGrid;
            newGrid.renderOrder = 2;
            scene.add(newGrid);
            engine.current.grid = newGrid;
        }

        // Update checkerboard position
        if (checkerboard) {
            checkerboard.position.set(
                (uvBounds.minU + uvBounds.maxU) / 2,
                (uvBounds.minV + uvBounds.maxV) / 2,
                -0.1
            );
            checkerboard.visible = showCheckerboard;
        }

        // Calculate view
        const baseWidth = (uvBounds.maxU - uvBounds.minU) / zoom;
        const baseHeight = (uvBounds.maxV - uvBounds.minV) / zoom;
        const centerU = (uvBounds.minU + uvBounds.maxU) / 2;
        const centerV = (uvBounds.minV + uvBounds.maxV) / 2;

        const aspect = nw / nh;

        if (aspect > 1) {
            camera.left = centerU - (baseWidth * aspect) / 2 + pan.x;
            camera.right = centerU + (baseWidth * aspect) / 2 + pan.x;
            camera.top = centerV + baseHeight / 2 + pan.y;
            camera.bottom = centerV - baseHeight / 2 + pan.y;
        } else {
            camera.left = centerU - baseWidth / 2 + pan.x;
            camera.right = centerU + baseWidth / 2 + pan.x;
            camera.top = centerV + (baseHeight / aspect) / 2 + pan.y;
            camera.bottom = centerV - (baseHeight / aspect) / 2 + pan.y;
        }
        camera.updateProjectionMatrix();
    }, [zoom, pan, uvBounds, showGrid, showCheckerboard]);

    // Update UV wireframe when meshes change
    useEffect(() => {
        updateUVWireframe();
        if (meshes && meshes.length > 0) frameAll();
    }, [meshes, version, updateUVWireframe, frameAll]);

    // Update wireframe visibility
    useEffect(() => {
        if (engine.current.uvLines) engine.current.uvLines.visible = showWireframe;
    }, [showWireframe]);

    // Update cursor size
    useEffect(() => {
        if (engine.current.brushCursor) {
            const s = cursorSize / 0.025;
            engine.current.brushCursor.scale.set(s, s, 1);
        }
    }, [cursorSize]);

    // Handle resize
    useEffect(() => {
        const handleResize = () => {
            if (mountRef.current && engine.current.renderer) {
                const nw = mountRef.current.clientWidth;
                const nh = mountRef.current.clientHeight;
                engine.current.renderer.setSize(nw, nh);
                setZoom(z => z); // Trigger camera update
            }
        };

        window.addEventListener('resize', handleResize);
        const observer = new ResizeObserver(handleResize);
        if (mountRef.current) observer.observe(mountRef.current);

        return () => {
            window.removeEventListener('resize', handleResize);
            observer.disconnect();
        };
    }, []);

    // Convert screen coords to UV coords
    const screenToUV = useCallback((clientX: number, clientY: number): THREE.Vector2 => {
        if (!mountRef.current || !engine.current.camera) {
            return new THREE.Vector2(0.5, 0.5);
        }

        const rect = mountRef.current.getBoundingClientRect();
        const camera = engine.current.camera;

        // NDC coords
        const ndcX = ((clientX - rect.left) / rect.width) * 2 - 1;
        const ndcY = -((clientY - rect.top) / rect.height) * 2 + 1;

        // Map to world/UV space
        const u = ndcX * (camera.right - camera.left) / 2 + (camera.right + camera.left) / 2;
        const v = ndcY * (camera.top - camera.bottom) / 2 + (camera.top + camera.bottom) / 2;

        return new THREE.Vector2(u, v);
    }, []);

    // Pointer handlers
    const handlePointerDown = useCallback((e: React.PointerEvent) => {
        if (!mountRef.current) return;

        // Middle mouse OR Alt+LMB = pan
        if (e.button === 1 || (e.button === 0 && e.altKey)) {
            isPanning.current = true;
            lastPanPos.current = { x: e.clientX, y: e.clientY };
            e.preventDefault();
            return;
        }

        isPointerDown.current = true;
        const uv = screenToUV(e.clientX, e.clientY);
        if (onPointerDown) onPointerDown(uv, e);
    }, [screenToUV, onPointerDown]);

    const handlePointerMove = useCallback((e: React.PointerEvent) => {
        if (!mountRef.current || !engine.current.camera) return;

        const uv = screenToUV(e.clientX, e.clientY);

        // Update cursor
        if (engine.current.brushCursor) {
            engine.current.brushCursor.position.set(uv.x, uv.y, 0.01);
            engine.current.brushCursor.visible = true;
        }

        // Handle panning
        if (isPanning.current) {
            const rect = mountRef.current.getBoundingClientRect();
            const deltaX = e.clientX - lastPanPos.current.x;
            const deltaY = e.clientY - lastPanPos.current.y;

            const worldWidth = (uvBounds.maxU - uvBounds.minU) / zoom;
            const worldHeight = (uvBounds.maxV - uvBounds.minV) / zoom;
            const panDeltaX = -(deltaX / rect.width) * worldWidth;
            const panDeltaY = (deltaY / rect.height) * worldHeight;

            setPan(prev => ({
                x: prev.x + panDeltaX,
                y: prev.y + panDeltaY
            }));

            lastPanPos.current = { x: e.clientX, y: e.clientY };
            return;
        }

        // Paint callback
        if (isPointerDown.current && onPointerMove) {
            onPointerMove(uv, e);
        }
    }, [screenToUV, uvBounds, zoom, onPointerMove]);

    const handlePointerUp = useCallback((e: React.PointerEvent) => {
        isPointerDown.current = false;
        isPanning.current = false;
        if (onPointerUp) onPointerUp(e);
    }, [onPointerUp]);

    const handlePointerLeave = useCallback((e: React.PointerEvent) => {
        if (engine.current.brushCursor) engine.current.brushCursor.visible = false;
        handlePointerUp(e);
    }, [handlePointerUp]);

    const handleWheel = useCallback((e: React.WheelEvent) => {
        e.preventDefault();
        const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
        setZoom(z => Math.max(0.1, Math.min(20, z * zoomFactor)));
    }, []);

    return (
        <div className={`w-full h-full relative overflow-hidden ${transparentBackground ? 'bg-transparent' : 'bg-[#0a0a0a]'}`}>
            <div
                ref={mountRef}
                className={`absolute inset-0 ${isPanning.current ? 'cursor-grabbing' : 'cursor-crosshair'}`}
                onPointerDown={handlePointerDown}
                onPointerUp={handlePointerUp}
                onPointerMove={handlePointerMove}
                onPointerLeave={handlePointerLeave}
                onWheel={handleWheel}
                // Prevent context menu on right click if desired, though we are not using RMB yet.
                onContextMenu={(e) => e.preventDefault()}
            />

            {/* View Controls */}
            <div className="absolute top-2 right-2 flex gap-1 pointer-events-auto">
                <button
                    onClick={frameAll}
                    className="bg-[#222] text-white p-1.5 text-xs rounded hover:bg-teal-600 transition-colors"
                    title="Frame All UVs"
                >
                    <Maximize2 size={14} />
                </button>
                <button
                    onClick={() => setShowGrid(!showGrid)}
                    className={`p-1.5 text-xs rounded transition-colors ${showGrid ? 'bg-teal-600 text-white' : 'bg-[#222] text-gray-400'}`}
                    title="Toggle Grid"
                >
                    <Grid3X3 size={14} />
                </button>
                <button
                    onClick={() => setShowWireframe(!showWireframe)}
                    className={`p-1.5 text-xs rounded transition-colors ${showWireframe ? 'bg-teal-600 text-white' : 'bg-[#222] text-gray-400'}`}
                    title="Toggle UV Wireframe"
                >
                    {showWireframe ? <Eye size={14} /> : <EyeOff size={14} />}
                </button>
            </div>

            {/* Status Bar */}
            <div className="absolute bottom-2 left-2 text-[9px] text-gray-500 font-mono pointer-events-none select-none">
                <div>UV VIEW | Zoom: {zoom.toFixed(1)}x</div>
                <div className="text-[8px] text-gray-600">
                    Alt+LMB or MMB: Pan | Scroll: Zoom | LMB: Paint
                </div>
            </div>
        </div>
    );
}
