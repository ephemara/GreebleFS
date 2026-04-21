import * as THREE from "three";
import {
  MODEL_THUMBNAIL_RENDER_CONFIG,
  type ModelPreviewFormat,
} from "../config/filePreview";
import { loadModelPreviewObject } from "../components/modelPreviewSource";
import {
  applyModelPreviewFallbackMaterials,
  collectNormalizedBounds,
  disposeModelPreviewObject,
  normalizeModelForPreview,
} from "../components/modelPreview.utils";

export interface ModelThumbnailRenderRequest {
  format: ModelPreviewFormat;
  sourcePath: string;
  maxWidth: number;
  maxHeight: number;
}

type SharedModelThumbnailRendererState = {
  canvas: HTMLCanvasElement;
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
};

let sharedRendererState: SharedModelThumbnailRendererState | null = null;
let sharedRenderQueue: Promise<void> = Promise.resolve();

export function renderModelThumbnailDataUrl(
  request: ModelThumbnailRenderRequest,
): Promise<string> {
  const task = () => renderModelThumbnailDataUrlNow(request);
  const next = sharedRenderQueue.then(task, task);
  sharedRenderQueue = next.then(
    () => undefined,
    () => undefined,
  );
  return next;
}

async function renderModelThumbnailDataUrlNow(
  request: ModelThumbnailRenderRequest,
): Promise<string> {
  const state = ensureModelThumbnailRendererState();
  const width = Math.max(1, Math.floor(request.maxWidth));
  const height = Math.max(1, Math.floor(request.maxHeight));
  const pixelRatio = Math.min(
    window.devicePixelRatio || 1,
    MODEL_THUMBNAIL_RENDER_CONFIG.maxPixelRatio,
  );

  state.renderer.setPixelRatio(pixelRatio);
  state.renderer.setSize(width, height, false);
  state.camera.aspect = width / height;
  state.camera.updateProjectionMatrix();

  let normalizedObject: THREE.Object3D | null = null;
  try {
    const rawObject = await loadModelPreviewObject(
      request.format,
      request.sourcePath,
    );
    applyModelPreviewFallbackMaterials(rawObject);
    normalizedObject = normalizeModelForPreview(rawObject, request.format);
    state.scene.add(normalizedObject);
    frameModelThumbnailCamera(normalizedObject, state.camera);
    state.renderer.render(state.scene, state.camera);
    return state.canvas.toDataURL("image/png");
  } finally {
    if (normalizedObject) {
      state.scene.remove(normalizedObject);
      disposeModelPreviewObject(normalizedObject);
    }
  }
}

function ensureModelThumbnailRendererState(): SharedModelThumbnailRendererState {
  if (sharedRendererState) {
    return sharedRendererState;
  }

  if (typeof document === "undefined") {
    throw new Error("Model thumbnail rendering requires a browser canvas.");
  }

  const canvas = document.createElement("canvas");
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: false,
    preserveDrawingBuffer: true,
    powerPreference: "low-power",
  });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearColor(MODEL_THUMBNAIL_RENDER_CONFIG.backgroundColor, 1);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(
    MODEL_THUMBNAIL_RENDER_CONFIG.backgroundColor,
  );

  const camera = new THREE.PerspectiveCamera(
    MODEL_THUMBNAIL_RENDER_CONFIG.cameraFov,
    1,
    0.01,
    2000,
  );
  camera.position.set(2.4, 1.8, 3.6);

  const ambientLight = new THREE.AmbientLight(
    "#dbe8f5",
    MODEL_THUMBNAIL_RENDER_CONFIG.ambientIntensity,
  );
  const keyLight = new THREE.DirectionalLight(
    "#ffffff",
    MODEL_THUMBNAIL_RENDER_CONFIG.keyLightIntensity,
  );
  keyLight.position.set(6, 8, 6);
  const fillLight = new THREE.DirectionalLight(
    "#7aa7d9",
    MODEL_THUMBNAIL_RENDER_CONFIG.fillLightIntensity,
  );
  fillLight.position.set(-4, 2, -5);

  scene.add(ambientLight, keyLight, fillLight);

  sharedRendererState = {
    canvas,
    renderer,
    scene,
    camera,
  };

  return sharedRendererState;
}

function frameModelThumbnailCamera(
  object: THREE.Object3D,
  camera: THREE.PerspectiveCamera,
) {
  const bounds = collectNormalizedBounds(object);
  if (bounds.isEmpty()) {
    camera.position.set(2.4, 1.8, 3.6);
    camera.lookAt(0, 0.4, 0);
    return;
  }

  const center = bounds.getCenter(new THREE.Vector3());
  const size = bounds.getSize(new THREE.Vector3());
  const radius = Math.max(size.length() * 0.32, 0.3);
  const distance = Math.max(
    radius / Math.sin((camera.fov * Math.PI) / 360),
    radius * 1.55,
  );

  camera.near = Math.max(distance / 200, 0.01);
  camera.far = Math.max(distance * 50, 100);
  camera.updateProjectionMatrix();
  camera.position.copy(
    center.clone().add(new THREE.Vector3(distance, distance * 0.52, distance)),
  );
  camera.lookAt(center);
}
