import { useEffect, useMemo, useRef, useState } from 'react';
import { convertFileSrc } from '@tauri-apps/api/core';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import type { ModelPreviewFormat } from '../config/filePreview';

type ModelPreviewProps = {
  entryName: string;
  format: ModelPreviewFormat;
  sourcePath: string;
};

const VIEW_BG = '#090d12';
const GRID_MAJOR = '#24303c';
const GRID_MINOR = '#151c24';
const OVERLAY_BG = 'rgba(8, 12, 18, 0.82)';
const OVERLAY_BORDER = 'rgba(117, 139, 166, 0.2)';
const TEXT = '#d8e1ec';
const MUTED = '#8393a7';

export function ModelPreview({ entryName, format, sourcePath }: ModelPreviewProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const modelRef = useRef<THREE.Object3D | null>(null);
  const frameRef = useRef<number | null>(null);
  const resetViewRef = useRef<{ position: THREE.Vector3; target: THREE.Vector3 } | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);
  const assetUrl = useMemo(() => convertFileSrc(sourcePath), [sourcePath]);

  useEffect(() => {
    let cancelled = false;
    const host = hostRef.current;
    if (!host) return undefined;

    setStatus('loading');
    setError(null);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(VIEW_BG);

    const camera = new THREE.PerspectiveCamera(42, 1, 0.01, 2000);
    camera.position.set(2.4, 1.8, 3.6);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({
      antialias: false,
      alpha: false,
      powerPreference: 'low-power',
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.display = 'block';
    rendererRef.current = renderer;
    host.innerHTML = '';
    host.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.07;
    controls.screenSpacePanning = true;
    controls.minDistance = 0.05;
    controls.maxDistance = 600;
    controls.mouseButtons = {
      LEFT: THREE.MOUSE.ROTATE,
      MIDDLE: THREE.MOUSE.DOLLY,
      RIGHT: THREE.MOUSE.PAN,
    };
    controlsRef.current = controls;

    scene.add(new THREE.AmbientLight('#dbe8f5', 1.25));

    const key = new THREE.DirectionalLight('#ffffff', 1.4);
    key.position.set(6, 8, 6);
    scene.add(key);

    const fill = new THREE.DirectionalLight('#7aa7d9', 0.45);
    fill.position.set(-4, 2, -5);
    scene.add(fill);

    const grid = new THREE.GridHelper(14, 18, GRID_MAJOR, GRID_MINOR);
    grid.position.y = -0.001;
    scene.add(grid);

    const resize = () => {
      if (!host || !rendererRef.current || !cameraRef.current) return;
      const width = Math.max(host.clientWidth, 1);
      const height = Math.max(host.clientHeight, 1);
      rendererRef.current.setSize(width, height, false);
      cameraRef.current.aspect = width / height;
      cameraRef.current.updateProjectionMatrix();
    };

    resize();
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(host);

    const animate = () => {
      if (cancelled) return;
      frameRef.current = window.requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };

    void loadPreviewObject(format, assetUrl).then(object => {
      if (cancelled) {
        disposeObject(object);
        return;
      }

      applyFallbackMaterials(object);
      modelRef.current = object;
      scene.add(object);
      fitObjectInView(object, camera, controls);
      resetViewRef.current = {
        position: camera.position.clone(),
        target: controls.target.clone(),
      };
      setStatus('ready');
    }).catch(loadError => {
      if (cancelled) return;
      setStatus('error');
      setError(formatLoadError(loadError));
    });

    animate();

    return () => {
      cancelled = true;
      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
      resizeObserver.disconnect();
      controls.dispose();
      controlsRef.current = null;
      if (modelRef.current) {
        disposeObject(modelRef.current);
        scene.remove(modelRef.current);
        modelRef.current = null;
      }
      renderer.dispose();
      rendererRef.current = null;
      cameraRef.current = null;
      resetViewRef.current = null;
      host.innerHTML = '';
    };
  }, [assetUrl, format]);

  const resetView = () => {
    if (!cameraRef.current || !controlsRef.current || !resetViewRef.current) return;
    cameraRef.current.position.copy(resetViewRef.current.position);
    controlsRef.current.target.copy(resetViewRef.current.target);
    controlsRef.current.update();
  };

  return (
    <div
      onDoubleClick={resetView}
      style={{ width: '100%', height: '100%', position: 'relative', background: VIEW_BG }}
      title="Double-click to reset view"
    >
      <div ref={hostRef} style={{ position: 'absolute', inset: 0 }} />

      {status !== 'ready' && (
        <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', pointerEvents: 'none' }}>
          <div style={{ padding: '10px 12px', borderRadius: 10, border: `1px solid ${OVERLAY_BORDER}`, background: OVERLAY_BG, color: status === 'error' ? '#f3b0b0' : TEXT, fontSize: 11, lineHeight: 1.5, textAlign: 'center', maxWidth: 300 }}>
            <div style={{ fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 4 }}>
              {status === 'loading' ? 'Loading Preview' : 'Preview Unavailable'}
            </div>
            <div style={{ color: status === 'error' ? '#d8b1b1' : MUTED }}>
              {status === 'loading'
                ? `${entryName} is being prepared.`
                : error ?? 'The viewer could not parse this asset.'}
            </div>
          </div>
        </div>
      )}

      <div style={{ position: 'absolute', left: 10, right: 10, bottom: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, pointerEvents: 'none' }}>
        <div style={{ minWidth: 0, display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 8px', borderRadius: 9, background: OVERLAY_BG, border: `1px solid ${OVERLAY_BORDER}`, color: TEXT, fontSize: 10, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
          <span>{format.toUpperCase()}</span>
          <span style={{ color: MUTED, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textTransform: 'none', letterSpacing: 0 }}>{entryName}</span>
        </div>
        <div style={{ padding: '6px 8px', borderRadius: 9, background: OVERLAY_BG, border: `1px solid ${OVERLAY_BORDER}`, color: MUTED, fontSize: 10 }}>
          Double-click reset
        </div>
      </div>
    </div>
  );
}

async function loadPreviewObject(format: ModelPreviewFormat, assetUrl: string): Promise<THREE.Object3D> {
  if (format === 'glb') {
    const loader = new GLTFLoader();
    const asset = await loader.loadAsync(assetUrl);
    return asset.scene ?? asset.scenes[0];
  }

  if (format === 'gltf') {
    const loader = new GLTFLoader();
    const asset = await loader.loadAsync(assetUrl);
    return asset.scene ?? asset.scenes[0];
  }

  if (format === 'obj') {
    const loader = new OBJLoader();
    return loader.loadAsync(assetUrl);
  }

  if (format === 'fbx') {
    const loader = new FBXLoader();
    return loader.loadAsync(assetUrl);
  }

  const loader = new STLLoader();
  const geometry = await loader.loadAsync(assetUrl);
  geometry.computeBoundingBox();
  geometry.computeVertexNormals();
  return new THREE.Mesh(
    geometry,
    new THREE.MeshStandardMaterial({
      color: '#cbd6e2',
      roughness: 0.64,
      metalness: 0.08,
    }),
  );
}

function fitObjectInView(
  object: THREE.Object3D,
  camera: THREE.PerspectiveCamera,
  controls: OrbitControls,
) {
  const bounds = new THREE.Box3().setFromObject(object);
  if (bounds.isEmpty()) {
    camera.position.set(2.4, 1.8, 3.6);
    controls.target.set(0, 0.4, 0);
    controls.update();
    return;
  }

  const center = bounds.getCenter(new THREE.Vector3());
  const size = bounds.getSize(new THREE.Vector3());
  const radius = Math.max(size.length() * 0.28, 0.3);
  const distance = Math.max(radius / Math.sin((camera.fov * Math.PI) / 360), radius * 1.55);

  camera.near = Math.max(distance / 200, 0.01);
  camera.far = Math.max(distance * 50, 100);
  camera.updateProjectionMatrix();
  camera.position.copy(center.clone().add(new THREE.Vector3(distance, distance * 0.52, distance)));
  controls.target.copy(center);
  controls.maxDistance = Math.max(distance * 10, 8);
  controls.update();
}

function applyFallbackMaterials(object: THREE.Object3D) {
  object.traverse((child: THREE.Object3D) => {
    if (!(child instanceof THREE.Mesh)) return;
    if (!child.material) {
      child.material = new THREE.MeshStandardMaterial({
        color: '#cbd6e2',
        roughness: 0.64,
        metalness: 0.08,
      });
    }
    if (!child.geometry.attributes.normal) {
      child.geometry.computeVertexNormals();
    }
  });
}

function disposeObject(object: THREE.Object3D) {
  object.traverse((child: THREE.Object3D) => {
    if (!(child instanceof THREE.Mesh)) return;
    child.geometry.dispose();
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    materials.forEach((material: THREE.Material) => material.dispose());
  });
}

function formatLoadError(error: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  if (typeof error === 'string' && error.trim()) {
    return error;
  }
  return 'Embedded GLB assets will work best. Sidecar materials or textures are not fully resolved yet.';
}
