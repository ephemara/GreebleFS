import { describe, expect, it } from "vitest";
import * as THREE from "three";
import {
  getModelPreviewRotation,
  normalizeModelForPreview,
  collectNormalizedBounds,
} from "../components/modelPreview.utils";

describe("modelPreview utils", () => {
  it("applies format-specific rotation for fbx assets", () => {
    expect(getModelPreviewRotation("fbx").x).toBeCloseTo(-Math.PI / 2);
    expect(getModelPreviewRotation("glb").x).toBe(0);
  });

  it("normalizes models to be centered and grounded in the preview space", () => {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(2, 4, 6),
      new THREE.MeshStandardMaterial(),
    );
    mesh.position.set(10, 8, -5);

    const normalized = normalizeModelForPreview(mesh, "glb");
    const bounds = collectNormalizedBounds(normalized);
    const center = bounds.getCenter(new THREE.Vector3());
    const size = bounds.getSize(new THREE.Vector3());

    expect(center.x).toBeCloseTo(0, 5);
    expect(center.z).toBeCloseTo(0, 5);
    expect(bounds.min.y).toBeCloseTo(0, 5);
    expect(Math.max(size.x, size.y, size.z)).toBeCloseTo(2.4, 5);
  });
});
