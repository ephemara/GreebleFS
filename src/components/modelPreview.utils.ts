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

export function applyModelPreviewFallbackMaterials(object: THREE.Object3D) {
  object.traverse((child: THREE.Object3D) => {
    if (!(child instanceof THREE.Mesh)) return;
    if (!child.material) {
      child.material = new THREE.MeshStandardMaterial({
        color: "#cbd6e2",
        roughness: 0.64,
        metalness: 0.08,
      });
    }

    const materials = Array.isArray(child.material)
      ? child.material
      : [child.material];
    materials.forEach((material) => {
      material.side = THREE.DoubleSide;
      if ("metalness" in material && typeof material.metalness === "number") {
        material.metalness = Math.min(material.metalness, 0.2);
      }
      if ("roughness" in material && typeof material.roughness === "number") {
        material.roughness = Math.max(material.roughness, 0.45);
      }
      material.needsUpdate = true;
    });

    if (!child.geometry.attributes.normal) {
      child.geometry.computeVertexNormals();
    }
  });
}

type DisposablePreviewObject = THREE.Object3D & {
  geometry?: { dispose?: () => void };
  material?: THREE.Material | THREE.Material[];
};

export function disposeModelPreviewObject(object: THREE.Object3D) {
  object.traverse((child: THREE.Object3D) => {
    const disposable = child as DisposablePreviewObject;
    disposable.geometry?.dispose?.();
    const materials = disposable.material
      ? Array.isArray(disposable.material)
        ? disposable.material
        : [disposable.material]
      : [];
    materials.forEach((material: THREE.Material) => material.dispose());
  });
}

export function parseDiffuseTexturePath(path: string): string {
  return path.replace(/\\/g, "/");
}
