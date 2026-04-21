import * as THREE from "three";
import type { ModelPreviewFormat } from "../config/filePreview";

const TARGET_MODEL_SIZE = 2.4;

export function getModelPreviewRotation(
  format: ModelPreviewFormat,
): THREE.Euler {
  if (format === "fbx" || format === "obj" || format === "stl") {
    return new THREE.Euler(-Math.PI / 2, 0, 0);
  }
  return new THREE.Euler(0, 0, 0);
}

export function normalizeModelForPreview(
  object: THREE.Object3D,
  format: ModelPreviewFormat,
  targetSize = TARGET_MODEL_SIZE,
): THREE.Group {
  const root = new THREE.Group();
  const wrapper = new THREE.Group();
  wrapper.name = `${object.name || "model"}-normalized`;
  wrapper.rotation.copy(getModelPreviewRotation(format));
  wrapper.add(object);
  root.add(wrapper);

  wrapper.updateWorldMatrix(true, true);
  const initialBounds = new THREE.Box3().setFromObject(root);
  if (initialBounds.isEmpty()) {
    return root;
  }

  const initialSize = initialBounds.getSize(new THREE.Vector3());
  const maxDimension = Math.max(
    initialSize.x,
    initialSize.y,
    initialSize.z,
    0.001,
  );
  const scale = targetSize / maxDimension;
  wrapper.scale.setScalar(scale);
  wrapper.updateWorldMatrix(true, true);

  const normalizedBounds = new THREE.Box3().setFromObject(root);
  const center = normalizedBounds.getCenter(new THREE.Vector3());
  wrapper.position.x -= center.x;
  wrapper.position.z -= center.z;
  wrapper.position.y -= normalizedBounds.min.y;
  wrapper.updateWorldMatrix(true, true);

  root.userData.previewScale = scale;
  root.userData.previewRotation = wrapper.rotation.toArray();
  return root;
}

export function collectNormalizedBounds(object: THREE.Object3D): THREE.Box3 {
  object.updateWorldMatrix(true, true);
  return new THREE.Box3().setFromObject(object);
}

export function parseDiffuseTexturePath(path: string): string {
  return path.replace(/\\/g, "/");
}
