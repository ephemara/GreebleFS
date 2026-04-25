export type ExplorerImageCutoutAlphaMask = {
  width: number;
  height: number;
  alpha: Uint8ClampedArray;
};

export type ExplorerImageCutoutSourcePixels = {
  width: number;
  height: number;
  data: Uint8ClampedArray;
};

export type ExplorerImageCutoutEditMode = "add" | "subtract";

export type ExplorerImageCutoutBoundaryPoint = readonly [number, number];

export type ExplorerImageCutoutImageDataLike = {
  width: number;
  height: number;
  data: Uint8ClampedArray;
};

export type ExplorerImageCutoutMaskPoint = {
  x: number;
  y: number;
};

function clampByte(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function smoothstep(edge0: number, edge1: number, value: number): number {
  if (edge0 === edge1) {
    return value >= edge1 ? 1 : 0;
  }
  const t = Math.max(0, Math.min(1, (value - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

function sourceOffset(width: number, x: number, y: number): number {
  return (y * width + x) * 4;
}

function alphaIndex(width: number, x: number, y: number): number {
  return y * width + x;
}

function inferMaskChannelPreference(data: Uint8ClampedArray): "alpha" | "luma" {
  let alphaMin = 255;
  let alphaMax = 0;
  let lumaMin = 255;
  let lumaMax = 0;
  for (let offset = 0; offset < data.length; offset += 4) {
    const red = data[offset] ?? 0;
    const green = data[offset + 1] ?? 0;
    const blue = data[offset + 2] ?? 0;
    const alpha = data[offset + 3] ?? 0;
    const luma = Math.max(red, green, blue);
    if (alpha < alphaMin) {
      alphaMin = alpha;
    }
    if (alpha > alphaMax) {
      alphaMax = alpha;
    }
    if (luma < lumaMin) {
      lumaMin = luma;
    }
    if (luma > lumaMax) {
      lumaMax = luma;
    }
  }
  return alphaMax - alphaMin <= 1 && lumaMax - lumaMin > 1 ? "luma" : "alpha";
}

export function cloneCutoutMaskAlpha(alpha: Uint8ClampedArray): Uint8ClampedArray {
  return new Uint8ClampedArray(alpha);
}

export function createCutoutMaskFromImageData(
  imageData: ExplorerImageCutoutImageDataLike,
): ExplorerImageCutoutAlphaMask {
  const { width, height, data } = imageData;
  const alpha = new Uint8ClampedArray(width * height);
  const channelPreference = inferMaskChannelPreference(data);

  for (let offset = 0; offset < data.length; offset += 4) {
    const pixelIndex = offset / 4;
    if (channelPreference === "luma") {
      const red = data[offset] ?? 0;
      const green = data[offset + 1] ?? 0;
      const blue = data[offset + 2] ?? 0;
      alpha[pixelIndex] = Math.max(red, green, blue);
      continue;
    }
    alpha[pixelIndex] = data[offset + 3] ?? 0;
  }

  return { width, height, alpha };
}

export function writeCutoutMaskToCanvas(
  mask: ExplorerImageCutoutAlphaMask,
  canvas: HTMLCanvasElement,
): void {
  canvas.width = mask.width;
  canvas.height = mask.height;
  const context = canvas.getContext("2d");
  if (!context) {
    return;
  }
  const imageData = context.createImageData(mask.width, mask.height);
  for (let index = 0; index < mask.alpha.length; index += 1) {
    const offset = index * 4;
    imageData.data[offset] = 255;
    imageData.data[offset + 1] = 255;
    imageData.data[offset + 2] = 255;
    imageData.data[offset + 3] = mask.alpha[index] ?? 0;
  }
  context.clearRect(0, 0, mask.width, mask.height);
  context.putImageData(imageData, 0, 0);
}

export function readCutoutMaskFromCanvas(
  canvas: HTMLCanvasElement,
): ExplorerImageCutoutAlphaMask {
  const context = canvas.getContext("2d");
  if (!context) {
    return {
      width: canvas.width,
      height: canvas.height,
      alpha: new Uint8ClampedArray(canvas.width * canvas.height),
    };
  }
  return createCutoutMaskFromImageData(
    context.getImageData(0, 0, canvas.width, canvas.height),
  );
}

export function buildCutoutBoundaryPoints(
  mask: ExplorerImageCutoutAlphaMask,
  alphaThreshold = 12,
): ExplorerImageCutoutBoundaryPoint[] {
  const { width, height, alpha } = mask;
  const points: ExplorerImageCutoutBoundaryPoint[] = [];

  const alphaAt = (x: number, y: number): number => alpha[alphaIndex(width, x, y)] ?? 0;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const center = alphaAt(x, y);
      if (center < alphaThreshold) {
        continue;
      }
      const left = x > 0 ? alphaAt(x - 1, y) : 0;
      const right = x + 1 < width ? alphaAt(x + 1, y) : 0;
      const top = y > 0 ? alphaAt(x, y - 1) : 0;
      const bottom = y + 1 < height ? alphaAt(x, y + 1) : 0;
      if (
        left < alphaThreshold ||
        right < alphaThreshold ||
        top < alphaThreshold ||
        bottom < alphaThreshold
      ) {
        points.push([x, y]);
      }
    }
  }

  return points;
}

function colorDistanceSquared(
  pixels: ExplorerImageCutoutSourcePixels,
  x: number,
  y: number,
  red: number,
  green: number,
  blue: number,
): number {
  const offset = sourceOffset(pixels.width, x, y);
  const deltaRed = (pixels.data[offset] ?? 0) - red;
  const deltaGreen = (pixels.data[offset + 1] ?? 0) - green;
  const deltaBlue = (pixels.data[offset + 2] ?? 0) - blue;
  return deltaRed * deltaRed + deltaGreen * deltaGreen + deltaBlue * deltaBlue;
}

function resolveToleranceThreshold(tolerance: number): number {
  const clampedTolerance = Math.max(0, Math.min(100, tolerance));
  const maxDistance = 441.6729559300637;
  const threshold = (clampedTolerance / 100) * maxDistance;
  return threshold * threshold;
}

export function applySparkSelection(args: {
  baseMask: ExplorerImageCutoutAlphaMask;
  sourcePixels: ExplorerImageCutoutSourcePixels;
  centerX: number;
  centerY: number;
  tolerance: number;
  mode: ExplorerImageCutoutEditMode;
}): ExplorerImageCutoutAlphaMask {
  const { baseMask, sourcePixels, centerX, centerY, tolerance, mode } = args;
  if (
    baseMask.width !== sourcePixels.width ||
    baseMask.height !== sourcePixels.height ||
    centerX < 0 ||
    centerY < 0 ||
    centerX >= baseMask.width ||
    centerY >= baseMask.height
  ) {
    return {
      width: baseMask.width,
      height: baseMask.height,
      alpha: cloneCutoutMaskAlpha(baseMask.alpha),
    };
  }

  const alpha = cloneCutoutMaskAlpha(baseMask.alpha);
  const visited = new Uint8Array(baseMask.width * baseMask.height);
  const queueX = new Int32Array(baseMask.width * baseMask.height);
  const queueY = new Int32Array(baseMask.width * baseMask.height);
  let head = 0;
  let tail = 0;

  const centerOffset = sourceOffset(sourcePixels.width, centerX, centerY);
  const seedRed = sourcePixels.data[centerOffset] ?? 0;
  const seedGreen = sourcePixels.data[centerOffset + 1] ?? 0;
  const seedBlue = sourcePixels.data[centerOffset + 2] ?? 0;
  const threshold = resolveToleranceThreshold(tolerance);

  queueX[tail] = centerX;
  queueY[tail] = centerY;
  tail += 1;
  visited[alphaIndex(baseMask.width, centerX, centerY)] = 1;

  while (head < tail) {
    const x = queueX[head] ?? 0;
    const y = queueY[head] ?? 0;
    head += 1;

    const colorDistance = colorDistanceSquared(
      sourcePixels,
      x,
      y,
      seedRed,
      seedGreen,
      seedBlue,
    );
    if (colorDistance > threshold) {
      continue;
    }

    const nextIndex = alphaIndex(baseMask.width, x, y);
    alpha[nextIndex] = mode === "add" ? 255 : 0;

    if (x > 0) {
      const leftIndex = alphaIndex(baseMask.width, x - 1, y);
      if (visited[leftIndex] === 0) {
        visited[leftIndex] = 1;
        queueX[tail] = x - 1;
        queueY[tail] = y;
        tail += 1;
      }
    }
    if (x + 1 < baseMask.width) {
      const rightIndex = alphaIndex(baseMask.width, x + 1, y);
      if (visited[rightIndex] === 0) {
        visited[rightIndex] = 1;
        queueX[tail] = x + 1;
        queueY[tail] = y;
        tail += 1;
      }
    }
    if (y > 0) {
      const topIndex = alphaIndex(baseMask.width, x, y - 1);
      if (visited[topIndex] === 0) {
        visited[topIndex] = 1;
        queueX[tail] = x;
        queueY[tail] = y - 1;
        tail += 1;
      }
    }
    if (y + 1 < baseMask.height) {
      const bottomIndex = alphaIndex(baseMask.width, x, y + 1);
      if (visited[bottomIndex] === 0) {
        visited[bottomIndex] = 1;
        queueX[tail] = x;
        queueY[tail] = y + 1;
        tail += 1;
      }
    }
  }

  return {
    width: baseMask.width,
    height: baseMask.height,
    alpha,
  };
}

export function applySweepSelection(args: {
  baseMask: ExplorerImageCutoutAlphaMask;
  sourcePixels: ExplorerImageCutoutSourcePixels;
  centerX: number;
  centerY: number;
  radius: number;
  tolerance: number;
  softness: number;
  mode: ExplorerImageCutoutEditMode;
}): ExplorerImageCutoutAlphaMask {
  const {
    baseMask,
    sourcePixels,
    centerX,
    centerY,
    radius,
    tolerance,
    softness,
    mode,
  } = args;
  if (
    baseMask.width !== sourcePixels.width ||
    baseMask.height !== sourcePixels.height ||
    centerX < 0 ||
    centerY < 0 ||
    centerX >= baseMask.width ||
    centerY >= baseMask.height
  ) {
    return {
      width: baseMask.width,
      height: baseMask.height,
      alpha: cloneCutoutMaskAlpha(baseMask.alpha),
    };
  }

  const alpha = cloneCutoutMaskAlpha(baseMask.alpha);
  const brushRadius = Math.max(2, Math.round(radius));
  const brushRadiusSquared = brushRadius * brushRadius;
  const threshold = resolveToleranceThreshold(tolerance);
  const softnessRatio = Math.max(0, Math.min(1, softness / 100));
  const innerRatio = 1 - softnessRatio * 0.92;
  const centerOffset = sourceOffset(sourcePixels.width, centerX, centerY);
  const seedRed = sourcePixels.data[centerOffset] ?? 0;
  const seedGreen = sourcePixels.data[centerOffset + 1] ?? 0;
  const seedBlue = sourcePixels.data[centerOffset + 2] ?? 0;
  const minX = Math.max(0, centerX - brushRadius);
  const maxX = Math.min(baseMask.width - 1, centerX + brushRadius);
  const minY = Math.max(0, centerY - brushRadius);
  const maxY = Math.min(baseMask.height - 1, centerY + brushRadius);

  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      const deltaX = x - centerX;
      const deltaY = y - centerY;
      const distanceSquared = deltaX * deltaX + deltaY * deltaY;
      if (distanceSquared > brushRadiusSquared) {
        continue;
      }

      const colorDistance = colorDistanceSquared(
        sourcePixels,
        x,
        y,
        seedRed,
        seedGreen,
        seedBlue,
      );
      if (colorDistance > threshold) {
        continue;
      }

      const distanceRatio = Math.sqrt(distanceSquared) / brushRadius;
      const weight =
        distanceRatio <= innerRatio
          ? 1
          : 1 - smoothstep(innerRatio, 1, distanceRatio);
      const nextIndex = alphaIndex(baseMask.width, x, y);
      const current = alpha[nextIndex] ?? 0;
      if (mode === "add") {
        alpha[nextIndex] = Math.max(current, clampByte(weight * 255));
        continue;
      }
      alpha[nextIndex] = clampByte(current * (1 - weight));
    }
  }

  return {
    width: baseMask.width,
    height: baseMask.height,
    alpha,
  };
}

export function applySweepSelectionInPlace(args: {
  targetMask: ExplorerImageCutoutAlphaMask;
  sourcePixels: ExplorerImageCutoutSourcePixels;
  centerX: number;
  centerY: number;
  radius: number;
  tolerance: number;
  softness: number;
  mode: ExplorerImageCutoutEditMode;
}): void {
  const {
    targetMask,
    sourcePixels,
    centerX,
    centerY,
    radius,
    tolerance,
    softness,
    mode,
  } = args;
  if (
    targetMask.width !== sourcePixels.width ||
    targetMask.height !== sourcePixels.height ||
    centerX < 0 ||
    centerY < 0 ||
    centerX >= targetMask.width ||
    centerY >= targetMask.height
  ) {
    return;
  }

  const brushRadius = Math.max(2, Math.round(radius));
  const brushRadiusSquared = brushRadius * brushRadius;
  const threshold = resolveToleranceThreshold(tolerance);
  const softnessRatio = Math.max(0, Math.min(1, softness / 100));
  const innerRatio = 1 - softnessRatio * 0.92;
  const centerOffset = sourceOffset(sourcePixels.width, centerX, centerY);
  const seedRed = sourcePixels.data[centerOffset] ?? 0;
  const seedGreen = sourcePixels.data[centerOffset + 1] ?? 0;
  const seedBlue = sourcePixels.data[centerOffset + 2] ?? 0;
  const minX = Math.max(0, centerX - brushRadius);
  const maxX = Math.min(targetMask.width - 1, centerX + brushRadius);
  const minY = Math.max(0, centerY - brushRadius);
  const maxY = Math.min(targetMask.height - 1, centerY + brushRadius);

  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      const deltaX = x - centerX;
      const deltaY = y - centerY;
      const distanceSquared = deltaX * deltaX + deltaY * deltaY;
      if (distanceSquared > brushRadiusSquared) {
        continue;
      }

      const colorDistance = colorDistanceSquared(
        sourcePixels,
        x,
        y,
        seedRed,
        seedGreen,
        seedBlue,
      );
      if (colorDistance > threshold) {
        continue;
      }

      const distanceRatio = Math.sqrt(distanceSquared) / brushRadius;
      const weight =
        distanceRatio <= innerRatio
          ? 1
          : 1 - smoothstep(innerRatio, 1, distanceRatio);
      const nextIndex = alphaIndex(targetMask.width, x, y);
      const current = targetMask.alpha[nextIndex] ?? 0;
      if (mode === "add") {
        targetMask.alpha[nextIndex] = Math.max(current, clampByte(weight * 255));
        continue;
      }
      targetMask.alpha[nextIndex] = clampByte(current * (1 - weight));
    }
  }
}

export function applyCircularBrushInPlace(args: {
  targetMask: ExplorerImageCutoutAlphaMask;
  centerX: number;
  centerY: number;
  radius: number;
  softness: number;
  mode: ExplorerImageCutoutEditMode;
}): void {
  const { targetMask, centerX, centerY, radius, softness, mode } = args;
  if (
    centerX < 0 ||
    centerY < 0 ||
    centerX >= targetMask.width ||
    centerY >= targetMask.height
  ) {
    return;
  }

  const brushRadius = Math.max(2, Math.round(radius));
  const brushRadiusSquared = brushRadius * brushRadius;
  const softnessRatio = Math.max(0, Math.min(1, softness / 100));
  const innerRatio = 1 - softnessRatio * 0.92;
  const minX = Math.max(0, centerX - brushRadius);
  const maxX = Math.min(targetMask.width - 1, centerX + brushRadius);
  const minY = Math.max(0, centerY - brushRadius);
  const maxY = Math.min(targetMask.height - 1, centerY + brushRadius);

  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      const deltaX = x - centerX;
      const deltaY = y - centerY;
      const distanceSquared = deltaX * deltaX + deltaY * deltaY;
      if (distanceSquared > brushRadiusSquared) {
        continue;
      }

      const distanceRatio = Math.sqrt(distanceSquared) / brushRadius;
      const weight =
        distanceRatio <= innerRatio
          ? 1
          : 1 - smoothstep(innerRatio, 1, distanceRatio);
      const nextIndex = alphaIndex(targetMask.width, x, y);
      const current = targetMask.alpha[nextIndex] ?? 0;
      if (mode === "add") {
        targetMask.alpha[nextIndex] = Math.max(current, clampByte(weight * 255));
        continue;
      }
      targetMask.alpha[nextIndex] = clampByte(current * (1 - weight));
    }
  }
}

function polygonContainsPoint(
  polygonPoints: readonly ExplorerImageCutoutMaskPoint[],
  sampleX: number,
  sampleY: number,
): boolean {
  let contains = false;
  for (
    let currentIndex = 0, previousIndex = polygonPoints.length - 1;
    currentIndex < polygonPoints.length;
    previousIndex = currentIndex, currentIndex += 1
  ) {
    const currentPoint = polygonPoints[currentIndex];
    const previousPoint = polygonPoints[previousIndex];
    if (!currentPoint || !previousPoint) {
      continue;
    }
    const currentY = currentPoint.y + 0.5;
    const previousY = previousPoint.y + 0.5;
    const currentX = currentPoint.x + 0.5;
    const previousX = previousPoint.x + 0.5;
    const intersects =
      (currentY > sampleY) !== (previousY > sampleY) &&
      sampleX <
        ((previousX - currentX) * (sampleY - currentY)) /
          ((previousY - currentY) || 1e-6) +
          currentX;
    if (intersects) {
      contains = !contains;
    }
  }
  return contains;
}

export function applyPolygonSelectionInPlace(args: {
  targetMask: ExplorerImageCutoutAlphaMask;
  polygonPoints: readonly ExplorerImageCutoutMaskPoint[];
  mode: ExplorerImageCutoutEditMode;
}): void {
  const { targetMask, polygonPoints, mode } = args;
  if (polygonPoints.length < 3) {
    return;
  }

  let minX = targetMask.width - 1;
  let maxX = 0;
  let minY = targetMask.height - 1;
  let maxY = 0;

  for (const point of polygonPoints) {
    minX = Math.min(minX, Math.max(0, Math.min(targetMask.width - 1, point.x)));
    maxX = Math.max(maxX, Math.max(0, Math.min(targetMask.width - 1, point.x)));
    minY = Math.min(minY, Math.max(0, Math.min(targetMask.height - 1, point.y)));
    maxY = Math.max(maxY, Math.max(0, Math.min(targetMask.height - 1, point.y)));
  }

  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      if (!polygonContainsPoint(polygonPoints, x + 0.5, y + 0.5)) {
        continue;
      }
      const nextIndex = alphaIndex(targetMask.width, x, y);
      targetMask.alpha[nextIndex] = mode === "add" ? 255 : 0;
    }
  }
}

export function resolveAdjustedCutoutMask(args: {
  baseMask: ExplorerImageCutoutAlphaMask;
  edgeSoftness: number;
  edgePull: number;
}): ExplorerImageCutoutAlphaMask {
  const { baseMask, edgeSoftness, edgePull } = args;
  const blurRadius = Math.max(0, edgeSoftness + Math.abs(edgePull) * 0.45);
  const workingCanvas = document.createElement("canvas");
  const filteredCanvas = document.createElement("canvas");
  writeCutoutMaskToCanvas(baseMask, workingCanvas);

  filteredCanvas.width = baseMask.width;
  filteredCanvas.height = baseMask.height;
  const filteredContext = filteredCanvas.getContext("2d");
  if (!filteredContext) {
    return {
      width: baseMask.width,
      height: baseMask.height,
      alpha: cloneCutoutMaskAlpha(baseMask.alpha),
    };
  }

  filteredContext.clearRect(0, 0, baseMask.width, baseMask.height);
  filteredContext.filter = blurRadius > 0 ? `blur(${blurRadius.toFixed(2)}px)` : "none";
  filteredContext.drawImage(workingCanvas, 0, 0, baseMask.width, baseMask.height);
  filteredContext.filter = "none";

  const filteredMask = readCutoutMaskFromCanvas(filteredCanvas);
  const alpha = cloneCutoutMaskAlpha(filteredMask.alpha);
  const cutoff = 128 - edgePull * 4;
  const softnessWindow = Math.max(10, edgeSoftness * 6 + Math.abs(edgePull) * 3 + 8);

  for (let index = 0; index < alpha.length; index += 1) {
    const sample = filteredMask.alpha[index] ?? 0;
    const weight = smoothstep(cutoff - softnessWindow, cutoff + softnessWindow, sample);
    alpha[index] = clampByte(weight * 255);
  }

  return {
    width: baseMask.width,
    height: baseMask.height,
    alpha,
  };
}
