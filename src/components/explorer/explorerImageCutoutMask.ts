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

type OklabColor = {
  l: number;
  a: number;
  b: number;
};

function srgbChannelToLinear(component: number): number {
  const normalized = component / 255;
  return normalized <= 0.04045
    ? normalized / 12.92
    : Math.pow((normalized + 0.055) / 1.055, 2.4);
}

function resolveOklabColorFromRgb(
  red: number,
  green: number,
  blue: number,
): OklabColor {
  const linearRed = srgbChannelToLinear(red);
  const linearGreen = srgbChannelToLinear(green);
  const linearBlue = srgbChannelToLinear(blue);

  const l =
    0.4122214708 * linearRed +
    0.5363325363 * linearGreen +
    0.0514459929 * linearBlue;
  const m =
    0.2119034982 * linearRed +
    0.6806995451 * linearGreen +
    0.1073969566 * linearBlue;
  const s =
    0.0883024619 * linearRed +
    0.2817188376 * linearGreen +
    0.6299787005 * linearBlue;

  const lRoot = Math.cbrt(l);
  const mRoot = Math.cbrt(m);
  const sRoot = Math.cbrt(s);

  return {
    l: 0.2104542553 * lRoot + 0.793617785 * mRoot - 0.0040720468 * sRoot,
    a: 1.9779984951 * lRoot - 2.428592205 * mRoot + 0.4505937099 * sRoot,
    b: 0.0259040371 * lRoot + 0.7827717662 * mRoot - 0.808675766 * sRoot,
  };
}

function resolvePixelOklabColor(
  pixels: ExplorerImageCutoutSourcePixels,
  x: number,
  y: number,
): OklabColor {
  const offset = sourceOffset(pixels.width, x, y);
  return resolveOklabColorFromRgb(
    pixels.data[offset] ?? 0,
    pixels.data[offset + 1] ?? 0,
    pixels.data[offset + 2] ?? 0,
  );
}

function colorDistanceSquared(left: OklabColor, right: OklabColor): number {
  const deltaL = left.l - right.l;
  const deltaA = left.a - right.a;
  const deltaB = left.b - right.b;
  return deltaL * deltaL + deltaA * deltaA + deltaB * deltaB;
}

function colorDistanceSquaredToPixel(
  pixels: ExplorerImageCutoutSourcePixels,
  x: number,
  y: number,
  color: OklabColor,
): number {
  return colorDistanceSquared(resolvePixelOklabColor(pixels, x, y), color);
}

function neighborColorDistanceSquared(
  pixels: ExplorerImageCutoutSourcePixels,
  leftX: number,
  leftY: number,
  rightX: number,
  rightY: number,
): number {
  return colorDistanceSquared(
    resolvePixelOklabColor(pixels, leftX, leftY),
    resolvePixelOklabColor(pixels, rightX, rightY),
  );
}

function resolveToleranceThreshold(tolerance: number): number {
  const clampedTolerance = Math.max(0, Math.min(100, tolerance));
  const maxPerceptualDistance = 0.38;
  const threshold =
    Math.pow(clampedTolerance / 100, 1.35) * maxPerceptualDistance;
  return threshold * threshold;
}

function resolveEdgeBarrierThreshold(
  tolerance: number,
  edgeAwareness: number,
): number {
  const baseToleranceDistance = Math.sqrt(
    resolveToleranceThreshold(Math.max(8, tolerance)),
  );
  const normalizedAwareness = Math.max(0, Math.min(100, edgeAwareness)) / 100;
  const threshold =
    baseToleranceDistance * (1.55 - normalizedAwareness * 1.1);
  return threshold * threshold;
}

function resolveQuickSelectionSeedModel(args: {
  targetMask: ExplorerImageCutoutAlphaMask;
  sourcePixels: ExplorerImageCutoutSourcePixels;
  centerX: number;
  centerY: number;
  radius: number;
}): {
  meanColor: OklabColor;
  seedPoints: ExplorerImageCutoutMaskPoint[];
} {
  const { targetMask, sourcePixels, centerX, centerY, radius } = args;
  const seedPoints: ExplorerImageCutoutMaskPoint[] = [{ x: centerX, y: centerY }];
  const sampleRadius = Math.max(1, Math.min(6, Math.round(radius * 0.18)));
  const sampleRadiusSquared = sampleRadius * sampleRadius;
  const minX = Math.max(0, centerX - sampleRadius);
  const maxX = Math.min(targetMask.width - 1, centerX + sampleRadius);
  const minY = Math.max(0, centerY - sampleRadius);
  const maxY = Math.min(targetMask.height - 1, centerY + sampleRadius);

  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      if (x === centerX && y === centerY) {
        continue;
      }
      const deltaX = x - centerX;
      const deltaY = y - centerY;
      if (deltaX * deltaX + deltaY * deltaY > sampleRadiusSquared) {
        continue;
      }
      if ((targetMask.alpha[alphaIndex(targetMask.width, x, y)] ?? 0) < 160) {
        continue;
      }
      seedPoints.push({ x, y });
    }
  }

  let meanL = 0;
  let meanA = 0;
  let meanB = 0;
  for (const point of seedPoints) {
    const color = resolvePixelOklabColor(sourcePixels, point.x, point.y);
    meanL += color.l;
    meanA += color.a;
    meanB += color.b;
  }
  const sampleCount = Math.max(1, seedPoints.length);

  return {
    meanColor: {
      l: meanL / sampleCount,
      a: meanA / sampleCount,
      b: meanB / sampleCount,
    },
    seedPoints,
  };
}

export function applySparkSelection(args: {
  baseMask: ExplorerImageCutoutAlphaMask;
  sourcePixels: ExplorerImageCutoutSourcePixels;
  centerX: number;
  centerY: number;
  tolerance: number;
  contiguous?: boolean;
  mode: ExplorerImageCutoutEditMode;
}): ExplorerImageCutoutAlphaMask {
  const {
    baseMask,
    sourcePixels,
    centerX,
    centerY,
    tolerance,
    contiguous = true,
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
  const visited = new Uint8Array(baseMask.width * baseMask.height);
  const queueX = new Int32Array(baseMask.width * baseMask.height);
  const queueY = new Int32Array(baseMask.width * baseMask.height);
  let head = 0;
  let tail = 0;

  const seedColor = resolvePixelOklabColor(sourcePixels, centerX, centerY);
  const threshold = resolveToleranceThreshold(tolerance);

  if (!contiguous) {
    for (let y = 0; y < baseMask.height; y += 1) {
      for (let x = 0; x < baseMask.width; x += 1) {
        if (
          colorDistanceSquaredToPixel(sourcePixels, x, y, seedColor) >
          threshold
        ) {
          continue;
        }
        alpha[alphaIndex(baseMask.width, x, y)] = mode === "add" ? 255 : 0;
      }
    }
    return {
      width: baseMask.width,
      height: baseMask.height,
      alpha,
    };
  }

  queueX[tail] = centerX;
  queueY[tail] = centerY;
  tail += 1;
  visited[alphaIndex(baseMask.width, centerX, centerY)] = 1;

  while (head < tail) {
    const x = queueX[head] ?? 0;
    const y = queueY[head] ?? 0;
    head += 1;

    const colorDistance = colorDistanceSquared(
      resolvePixelOklabColor(sourcePixels, x, y),
      seedColor,
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
  edgeAwareness?: number;
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
    edgeAwareness = 68,
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

  const nextMask = {
    width: baseMask.width,
    height: baseMask.height,
    alpha: cloneCutoutMaskAlpha(baseMask.alpha),
  };
  applySweepSelectionInPlace({
    targetMask: nextMask,
    sourcePixels,
    centerX,
    centerY,
    radius,
    tolerance,
    softness,
    edgeAwareness,
    mode,
  });
  return nextMask;
}

export function applySweepSelectionInPlace(args: {
  targetMask: ExplorerImageCutoutAlphaMask;
  sourcePixels: ExplorerImageCutoutSourcePixels;
  centerX: number;
  centerY: number;
  radius: number;
  tolerance: number;
  softness: number;
  edgeAwareness?: number;
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
    edgeAwareness = 68,
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
  const edgeThreshold = resolveEdgeBarrierThreshold(tolerance, edgeAwareness);
  const softnessRatio = Math.max(0, Math.min(1, softness / 100));
  const innerRatio = 1 - softnessRatio * 0.92;
  const visited = new Uint8Array(targetMask.width * targetMask.height);
  const queueCapacity = targetMask.width * targetMask.height;
  const queueX = new Int32Array(queueCapacity);
  const queueY = new Int32Array(queueCapacity);
  const queueParentX = new Int32Array(queueCapacity);
  const queueParentY = new Int32Array(queueCapacity);
  let head = 0;
  let tail = 0;

  const seedModel = resolveQuickSelectionSeedModel({
    targetMask,
    sourcePixels,
    centerX,
    centerY,
    radius: brushRadius,
  });
  let meanColor = seedModel.meanColor;
  let acceptedCount = Math.max(1, seedModel.seedPoints.length);

  const pushQueuePoint = (
    x: number,
    y: number,
    parentX: number,
    parentY: number,
  ) => {
    const nextIndex = alphaIndex(targetMask.width, x, y);
    if (visited[nextIndex] !== 0) {
      return;
    }
    visited[nextIndex] = 1;
    queueX[tail] = x;
    queueY[tail] = y;
    queueParentX[tail] = parentX;
    queueParentY[tail] = parentY;
    tail += 1;
  };

  for (const point of seedModel.seedPoints) {
    pushQueuePoint(point.x, point.y, point.x, point.y);
  }

  while (head < tail) {
    const x = queueX[head] ?? 0;
    const y = queueY[head] ?? 0;
    const parentX = queueParentX[head] ?? x;
    const parentY = queueParentY[head] ?? y;
    head += 1;

    const deltaX = x - centerX;
    const deltaY = y - centerY;
    const distanceSquared = deltaX * deltaX + deltaY * deltaY;
    if (distanceSquared > brushRadiusSquared) {
      continue;
    }

    const pixelColor = resolvePixelOklabColor(sourcePixels, x, y);
    const colorDistance = colorDistanceSquared(pixelColor, meanColor);
    if (colorDistance > threshold) {
      continue;
    }

    const edgeDistance =
      x === parentX && y === parentY
        ? 0
        : neighborColorDistanceSquared(sourcePixels, x, y, parentX, parentY);
    if (edgeDistance > edgeThreshold) {
      continue;
    }

    const distanceRatio = Math.sqrt(distanceSquared) / brushRadius;
    const radialWeight =
      distanceRatio <= innerRatio
        ? 1
        : 1 - smoothstep(innerRatio, 1, distanceRatio);
    const colorConfidence =
      threshold <= 1e-6
        ? 1
        : 1 - smoothstep(threshold * 0.35, threshold, colorDistance);
    const edgeConfidence =
      edgeThreshold <= 1e-6
        ? 1
        : 1 - smoothstep(edgeThreshold * 0.35, edgeThreshold, edgeDistance);
    const confidenceWeight = Math.max(
      softnessRatio > 0 ? 0.08 : 0.2,
      colorConfidence * 0.72 + edgeConfidence * 0.28,
    );
    const weight = radialWeight * confidenceWeight;
    const nextIndex = alphaIndex(targetMask.width, x, y);
    const current = targetMask.alpha[nextIndex] ?? 0;
    if (mode === "add") {
      targetMask.alpha[nextIndex] = Math.max(current, clampByte(weight * 255));
    } else {
      targetMask.alpha[nextIndex] = clampByte(current * (1 - weight));
    }

    acceptedCount += 1;
    const blend = 1 / acceptedCount;
    meanColor = {
      l: meanColor.l + (pixelColor.l - meanColor.l) * blend,
      a: meanColor.a + (pixelColor.a - meanColor.a) * blend,
      b: meanColor.b + (pixelColor.b - meanColor.b) * blend,
    };

    if (x > 0) {
      pushQueuePoint(x - 1, y, x, y);
    }
    if (x + 1 < targetMask.width) {
      pushQueuePoint(x + 1, y, x, y);
    }
    if (y > 0) {
      pushQueuePoint(x, y - 1, x, y);
    }
    if (y + 1 < targetMask.height) {
      pushQueuePoint(x, y + 1, x, y);
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
