import { describe, expect, it } from "vitest";

import {
  applySparkSelection,
  applySweepSelection,
  buildCutoutBoundaryPoints,
  createCutoutMaskFromImageData,
} from "../components/explorer/explorerImageCutoutMask";

function createSolidPixels(width: number, height: number, pixels: number[][]) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let index = 0; index < pixels.length; index += 1) {
    const offset = index * 4;
    const [red, green, blue] = pixels[index] ?? [0, 0, 0];
    data[offset] = red;
    data[offset + 1] = green;
    data[offset + 2] = blue;
    data[offset + 3] = 255;
  }
  return { width, height, data };
}

describe("explorerImageCutoutMask", () => {
  it("extracts mask alpha from grayscale masks that use RGB instead of alpha", () => {
    const rgba = new Uint8ClampedArray([
      0, 0, 0, 255,
      255, 255, 255, 255,
      32, 32, 32, 255,
      200, 200, 200, 255,
    ]);
    const mask = createCutoutMaskFromImageData({
      width: 2,
      height: 2,
      data: rgba,
    });
    expect([...mask.alpha]).toEqual([0, 255, 32, 200]);
  });

  it("builds boundary points from the actual selection instead of the full image rectangle", () => {
    const mask = {
      width: 5,
      height: 5,
      alpha: new Uint8ClampedArray([
        0, 0, 0, 0, 0,
        0, 255, 255, 0, 0,
        0, 255, 255, 0, 0,
        0, 0, 0, 0, 0,
        0, 0, 0, 0, 0,
      ]),
    };

    const boundary = buildCutoutBoundaryPoints(mask);
    expect(boundary).toEqual(
      expect.arrayContaining([
        [1, 1],
        [2, 1],
        [1, 2],
        [2, 2],
      ]),
    );
    expect(boundary).not.toEqual(expect.arrayContaining([[0, 0], [4, 4]]));
  });

  it("spark selects a contiguous color island from the clicked seed", () => {
    const sourcePixels = createSolidPixels(3, 3, [
      [255, 0, 0], [255, 0, 0], [0, 0, 255],
      [255, 0, 0], [255, 0, 0], [0, 0, 255],
      [0, 255, 0], [0, 255, 0], [0, 0, 255],
    ]);
    const mask = {
      width: 3,
      height: 3,
      alpha: new Uint8ClampedArray(9),
    };

    const nextMask = applySparkSelection({
      baseMask: mask,
      sourcePixels,
      centerX: 0,
      centerY: 0,
      tolerance: 20,
      mode: "add",
    });

    expect([...nextMask.alpha]).toEqual([
      255, 255, 0,
      255, 255, 0,
      0, 0, 0,
    ]);
  });

  it("sweep paints only similar pixels inside the brush radius", () => {
    const sourcePixels = createSolidPixels(5, 1, [
      [200, 200, 200],
      [200, 200, 200],
      [200, 200, 200],
      [10, 10, 10],
      [10, 10, 10],
    ]);
    const mask = {
      width: 5,
      height: 1,
      alpha: new Uint8ClampedArray(5),
    };

    const nextMask = applySweepSelection({
      baseMask: mask,
      sourcePixels,
      centerX: 1,
      centerY: 0,
      radius: 2,
      tolerance: 18,
      softness: 0,
      mode: "add",
    });

    expect(nextMask.alpha[0]).toBeGreaterThan(0);
    expect(nextMask.alpha[1]).toBe(255);
    expect(nextMask.alpha[2]).toBeGreaterThan(0);
    expect(nextMask.alpha[3]).toBe(0);
    expect(nextMask.alpha[4]).toBe(0);
  });
});
