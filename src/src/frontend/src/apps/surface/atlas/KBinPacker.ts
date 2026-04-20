/**
 * KBinPacker.ts
 * Enhanced 2D bin packer for UV charts.
 * Uses MaxRects algorithm with multiple heuristics for better packing.
 * Preserves Aspect Ratio and Relative Scale (Texel Density).
 */

interface Rect {
    id: number;
    w: number;
    h: number;
    x: number;
    y: number;
    rotated?: boolean;
}

interface FreeRect {
    x: number;
    y: number;
    w: number;
    h: number;
}

export class KBinPacker {
    private freeRects: FreeRect[] = [];
    private binW: number;
    private binH: number;

    constructor(w: number = 1.0, h: number = 1.0) {
        this.binW = w;
        this.binH = h;
        this.freeRects = [{ x: 0, y: 0, w: w, h: h }];
    }

    /**
     * Pack blocks into UV space using MaxRects Best Short Side Fit (BSSF).
     * This produces much tighter packing than simple shelf algorithms.
     */
    fit(blocks: Rect[], padding: number = 0.01) {
        // Reset packer state
        this.freeRects = [{ x: 0, y: 0, w: this.binW, h: this.binH }];

        // Sort by AREA (largest first) - empirically better for MaxRects
        blocks.sort((a, b) => (b.w * b.h) - (a.w * a.h));

        // Calculate total area to estimate needed bin size
        let totalArea = 0;
        for (const b of blocks) {
            totalArea += (b.w + padding) * (b.h + padding);
        }

        // Estimate bin size with 15% waste overhead
        const estimatedSide = Math.sqrt(totalArea) * 1.15;

        // Scale blocks to fit estimated bin
        const maxBlockDim = Math.max(...blocks.map(b => Math.max(b.w, b.h)));
        const scaleFactor = maxBlockDim > 0 ? (estimatedSide * 0.3) / maxBlockDim : 1;

        // Apply initial scaling and padding
        const scaledBlocks = blocks.map(b => ({
            ...b,
            w: b.w * scaleFactor + padding,
            h: b.h * scaleFactor + padding
        }));

        // Expand bin to fit all blocks
        const neededW = Math.max(this.binW, estimatedSide * 1.2);
        const neededH = Math.max(this.binH, estimatedSide * 1.2);
        this.freeRects = [{ x: 0, y: 0, w: neededW, h: neededH }];

        // Pack each block using BSSF heuristic
        for (const block of scaledBlocks) {
            const result = this.findPositionBSSF(block.w, block.h);

            if (result) {
                block.x = result.x;
                block.y = result.y;
                if (result.rotated) {
                    // Swap dimensions if rotated
                    const tmp = block.w;
                    block.w = block.h;
                    block.h = tmp;
                    block.rotated = true;
                }
                this.placeRect(block);
            } else {
                // Fallback: place outside bounds (will be normalized anyway)
                console.warn('KBinPacker: Could not fit block, placing at end');
                block.x = this.binW;
                block.y = 0;
            }
        }

        // Copy positions back to original blocks
        for (let i = 0; i < blocks.length; i++) {
            blocks[i].x = scaledBlocks[i].x;
            blocks[i].y = scaledBlocks[i].y;
            blocks[i].w = scaledBlocks[i].w;
            blocks[i].h = scaledBlocks[i].h;
            blocks[i].rotated = scaledBlocks[i].rotated;
        }

        // Normalize to 0-1 UV space
        this.normalizeToUVSpace(blocks, padding);
    }

    /**
     * Best Short Side Fit - finds the free rectangle where the short side
     * leftover is smallest. Good balance of density and predictability.
     */
    private findPositionBSSF(w: number, h: number): { x: number; y: number; rotated: boolean } | null {
        let bestScore = Infinity;
        let bestRect: FreeRect | null = null;
        let bestRotated = false;

        for (const rect of this.freeRects) {
            // Try without rotation
            if (w <= rect.w && h <= rect.h) {
                const leftoverH = rect.h - h;
                const leftoverW = rect.w - w;
                const shortSide = Math.min(leftoverH, leftoverW);
                if (shortSide < bestScore) {
                    bestScore = shortSide;
                    bestRect = rect;
                    bestRotated = false;
                }
            }

            // Try with 90° rotation
            if (h <= rect.w && w <= rect.h) {
                const leftoverH = rect.h - w;
                const leftoverW = rect.w - h;
                const shortSide = Math.min(leftoverH, leftoverW);
                if (shortSide < bestScore) {
                    bestScore = shortSide;
                    bestRect = rect;
                    bestRotated = true;
                }
            }
        }

        if (bestRect) {
            return { x: bestRect.x, y: bestRect.y, rotated: bestRotated };
        }
        return null;
    }

    /**
     * Place a rectangle and split the free space using Guillotine algorithm.
     */
    private placeRect(rect: Rect) {
        const newFreeRects: FreeRect[] = [];

        for (const free of this.freeRects) {
            // Check if the placed rect overlaps this free rect
            if (this.intersects(rect, free)) {
                // Split the free rectangle

                // Left of placed rect
                if (rect.x > free.x) {
                    newFreeRects.push({
                        x: free.x,
                        y: free.y,
                        w: rect.x - free.x,
                        h: free.h
                    });
                }

                // Right of placed rect
                if (rect.x + rect.w < free.x + free.w) {
                    newFreeRects.push({
                        x: rect.x + rect.w,
                        y: free.y,
                        w: (free.x + free.w) - (rect.x + rect.w),
                        h: free.h
                    });
                }

                // Below placed rect
                if (rect.y > free.y) {
                    newFreeRects.push({
                        x: free.x,
                        y: free.y,
                        w: free.w,
                        h: rect.y - free.y
                    });
                }

                // Above placed rect
                if (rect.y + rect.h < free.y + free.h) {
                    newFreeRects.push({
                        x: free.x,
                        y: rect.y + rect.h,
                        w: free.w,
                        h: (free.y + free.h) - (rect.y + rect.h)
                    });
                }
            } else {
                // No overlap, keep this free rect
                newFreeRects.push(free);
            }
        }

        // Remove redundant/contained free rects
        this.freeRects = this.pruneRects(newFreeRects);
    }

    /**
     * Check if two rectangles intersect.
     */
    private intersects(a: Rect | FreeRect, b: FreeRect): boolean {
        return !(a.x >= b.x + b.w ||
            a.x + a.w <= b.x ||
            a.y >= b.y + b.h ||
            a.y + a.h <= b.y);
    }

    /**
     * Remove free rectangles that are fully contained within others.
     */
    private pruneRects(rects: FreeRect[]): FreeRect[] {
        const result: FreeRect[] = [];

        for (let i = 0; i < rects.length; i++) {
            let isContained = false;

            for (let j = 0; j < rects.length; j++) {
                if (i !== j && this.contains(rects[j], rects[i])) {
                    isContained = true;
                    break;
                }
            }

            if (!isContained && rects[i].w > 0.001 && rects[i].h > 0.001) {
                result.push(rects[i]);
            }
        }

        return result;
    }

    /**
     * Check if rect A fully contains rect B.
     */
    private contains(a: FreeRect, b: FreeRect): boolean {
        return a.x <= b.x &&
            a.y <= b.y &&
            a.x + a.w >= b.x + b.w &&
            a.y + a.h >= b.y + b.h;
    }

    /**
     * Normalize all blocks to fit within 0-1 UV space with padding from edges.
     */
    private normalizeToUVSpace(blocks: Rect[], margin: number) {
        if (blocks.length === 0) return;

        // Find bounding box of all placed blocks
        let minX = Infinity, minY = Infinity;
        let maxX = -Infinity, maxY = -Infinity;

        for (const b of blocks) {
            minX = Math.min(minX, b.x);
            minY = Math.min(minY, b.y);
            maxX = Math.max(maxX, b.x + b.w);
            maxY = Math.max(maxY, b.y + b.h);
        }

        const rangeX = maxX - minX;
        const rangeY = maxY - minY;
        const maxRange = Math.max(rangeX, rangeY);

        if (maxRange < 0.0001) return;

        // Scale to fit in 0-1 with margin
        const targetSize = 1.0 - margin * 2;
        const scale = targetSize / maxRange;

        for (const b of blocks) {
            b.x = ((b.x - minX) * scale) + margin;
            b.y = ((b.y - minY) * scale) + margin;
            b.w *= scale;
            b.h *= scale;
        }
    }
}
