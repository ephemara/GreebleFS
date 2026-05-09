import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import {
  MODEL_PREVIEW_PROXY_CONFIG,
  type ModelPreviewFormat,
} from '../config/filePreview';
import {
  collectNormalizedBounds,
  applyModelPreviewFallbackMaterials,
  disposeModelPreviewObject,
  normalizeModelForPreview,
} from './modelPreview.utils';
import { loadModelPreviewObject } from './modelPreviewSource';

type ModelPreviewProps = {
  entryName: string;
  format: ModelPreviewFormat;
  sourcePath: string;
  sourceBytes: number;
};

const VIEW_BG = '#090d12';
const GRID_MAJOR = '#24303c';
const GRID_MINOR = '#151c24';
const OVERLAY_BG = 'rgba(8, 12, 18, 0.82)';
const OVERLAY_BORDER = 'rgba(117, 139, 166, 0.2)';
const TEXT = '#d8e1ec';
const MUTED = '#8393a7';
const PROXY_FILL = '#88b5e8';
const PROXY_EDGE = '#d8e8fb';

type LoadedPreviewResult = {
  object: THREE.Object3D;
  proxyNotice: string | null;
};

type ModelGeometryStats = {
  meshCount: number;
  vertexCount: number;
  triangleCount: number;
};

export function ModelPreview({ entryName, format, sourcePath, sourceBytes }: ModelPreviewProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const modelRef = useRef<THREE.Object3D | null>(null);
  const frameRef = useRef<number | null>(null);
  const resetViewRef = useRef<{ position: THREE.Vector3; target: THREE.Vector3 } | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);
  const [proxyNotice, setProxyNotice] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const host = hostRef.current;
    if (!host) return undefined;

    setStatus('loading');
    setError(null);
    setProxyNotice(null);

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

    void loadPreviewObject({ format, sourcePath, sourceBytes }).then(({ object, proxyNotice: nextProxyNotice }) => {
      if (cancelled) {
      disposeModelPreviewObject(object);
        return;
      }

      applyModelPreviewFallbackMaterials(object);
      modelRef.current = object;
      scene.add(object);
      setProxyNotice(nextProxyNotice);
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
        disposeModelPreviewObject(modelRef.current);
        scene.remove(modelRef.current);
        modelRef.current = null;
      }
      renderer.dispose();
      rendererRef.current = null;
      cameraRef.current = null;
      resetViewRef.current = null;
      host.innerHTML = '';
    };
  }, [format, sourceBytes, sourcePath]);

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
        {proxyNotice && (
          <div style={{ padding: '6px 8px', borderRadius: 9, background: OVERLAY_BG, border: `1px solid ${OVERLAY_BORDER}`, color: MUTED, fontSize: 10 }}>
            {proxyNotice}
          </div>
        )}
      </div>
    </div>
  );
}

async function loadPreviewObject(args: {
  format: ModelPreviewFormat;
  sourcePath: string;
  sourceBytes: number;
}): Promise<LoadedPreviewResult> {
  const rawObject = await loadModelPreviewObject(args.format, args.sourcePath);
  applyModelPreviewFallbackMaterials(rawObject);
  const normalizedObject = normalizeModelForPreview(rawObject, args.format);
  const stats = collectModelGeometryStats(normalizedObject);

  if (shouldUseProxyPreview(args.sourceBytes, stats)) {
    const proxy = createProxyObject(normalizedObject, stats);
    disposeModelPreviewObject(normalizedObject);
    return {
      object: proxy,
      proxyNotice: `Proxy preview · ${formatCompactCount(stats.triangleCount)} tris`,
    };
  }

  return { object: normalizedObject, proxyNotice: null };
}

function collectModelGeometryStats(object: THREE.Object3D): ModelGeometryStats {
  const stats: ModelGeometryStats = {
    meshCount: 0,
    vertexCount: 0,
    triangleCount: 0,
  };

  object.traverse((child: THREE.Object3D) => {
    if (!(child instanceof THREE.Mesh) || !(child.geometry instanceof THREE.BufferGeometry)) {
      return;
    }

    stats.meshCount += 1;
    const positionCount = child.geometry.attributes.position?.count ?? 0;
    stats.vertexCount += positionCount;
    stats.triangleCount += child.geometry.index
      ? Math.floor(child.geometry.index.count / 3)
      : Math.floor(positionCount / 3);
  });

  return stats;
}

function shouldUseProxyPreview(sourceBytes: number, stats: ModelGeometryStats): boolean {
  return sourceBytes >= MODEL_PREVIEW_PROXY_CONFIG.maxDirectSourceBytes
    || stats.vertexCount >= MODEL_PREVIEW_PROXY_CONFIG.maxRenderableVertexCount
    || stats.triangleCount >= MODEL_PREVIEW_PROXY_CONFIG.maxRenderableTriangleCount
    || stats.meshCount >= MODEL_PREVIEW_PROXY_CONFIG.maxRenderableMeshCount;
}

function createProxyObject(sourceObject: THREE.Object3D, stats: ModelGeometryStats): THREE.Object3D {
  sourceObject.updateWorldMatrix(true, true);

  const proxyGroup = new THREE.Group();
  proxyGroup.name = `${sourceObject.name || 'model'}-proxy`;
  proxyGroup.userData.previewProxy = true;
  proxyGroup.userData.previewStats = stats;

  const fillMaterial = new THREE.MeshStandardMaterial({
    color: PROXY_FILL,
    roughness: 0.72,
    metalness: 0.06,
    transparent: true,
    opacity: 0.18,
  });
  const edgeMaterial = new THREE.LineBasicMaterial({
    color: PROXY_EDGE,
    transparent: true,
    opacity: 0.55,
  });

  let proxyMeshCount = 0;
  sourceObject.traverse((child: THREE.Object3D) => {
    if (!(child instanceof THREE.Mesh) || proxyMeshCount >= MODEL_PREVIEW_PROXY_CONFIG.maxProxyMeshes) {
      return;
    }

    const bounds = new THREE.Box3().setFromObject(child);
    if (bounds.isEmpty()) {
      return;
    }

    addProxyBounds(proxyGroup, bounds, fillMaterial, edgeMaterial);
    proxyMeshCount += 1;
  });

  if (proxyMeshCount === 0) {
    const fallbackBounds = new THREE.Box3().setFromObject(sourceObject);
    if (!fallbackBounds.isEmpty()) {
      addProxyBounds(proxyGroup, fallbackBounds, fillMaterial, edgeMaterial);
    }
  }

  return proxyGroup;
}

function addProxyBounds(
  proxyGroup: THREE.Group,
  bounds: THREE.Box3,
  fillMaterial: THREE.MeshStandardMaterial,
  edgeMaterial: THREE.LineBasicMaterial,
) {
  const size = bounds.getSize(new THREE.Vector3());
  const center = bounds.getCenter(new THREE.Vector3());
  const geometry = new THREE.BoxGeometry(
    Math.max(size.x, 0.02),
    Math.max(size.y, 0.02),
    Math.max(size.z, 0.02),
  );

  const fill = new THREE.Mesh(geometry, fillMaterial);
  fill.position.copy(center);
  proxyGroup.add(fill);

  const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geometry), edgeMaterial);
  edges.position.copy(center);
  proxyGroup.add(edges);
}

function formatCompactCount(value: number): string {
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M`;
  }
  if (value >= 1_000) {
    return `${Math.round(value / 1_000)}K`;
  }
  return String(value);
}

function fitObjectInView(
  object: THREE.Object3D,
  camera: THREE.PerspectiveCamera,
  controls: OrbitControls,
) {
  const bounds = collectNormalizedBounds(object);
  if (bounds.isEmpty()) {
    camera.position.set(2.4, 1.8, 3.6);
    controls.target.set(0, 0.4, 0);
    controls.update();
    return;
  }

  const center = bounds.getCenter(new THREE.Vector3());
  const size = bounds.getSize(new THREE.Vector3());
  const radius = Math.max(size.length() * 0.32, 0.3);
  const distance = Math.max(radius / Math.sin((camera.fov * Math.PI) / 360), radius * 1.55);

  camera.near = Math.max(distance / 200, 0.01);
  camera.far = Math.max(distance * 50, 100);
  camera.updateProjectionMatrix();
  camera.position.copy(center.clone().add(new THREE.Vector3(distance, distance * 0.52, distance)));
  controls.target.copy(center);
  controls.maxDistance = Math.max(distance * 10, 8);
  controls.update();
}

function formatLoadError(error: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  if (typeof error === 'string' && error.trim()) {
    return error;
  }
  return 'Self-contained model files work best. Sidecar materials or textures may still be limited.';
}
