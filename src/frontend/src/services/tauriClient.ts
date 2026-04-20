/**
 * tauriClient.ts
 * 
 * TypeScript bindings for K_OS Rust backend.
 * Provides a clean API for calling Rust functions from the frontend.
 * 
 * When running in browser (dev mode without Tauri), falls back to
 * JavaScript implementations for compatibility.
 */

// Type definitions matching Rust structs
export interface SparseTriplet {
    i: number;
    j: number;
    v: number;
}

export interface CgResult {
    x: number[];
    iter: number;
    error: number;
    time_ms: number;
}

export interface MultiplyResult {
    y: number[];
    time_ms: number;
}

export interface BenchmarkResult {
    rust_time_ms: number;
    iterations: number;
    error: number;
    matrix_size: number;
    nnz: number;
}

// Check if we're running in Tauri
const isTauri = (): boolean => {
    return typeof window !== 'undefined' && '__TAURI__' in window;
};

// Lazy import Tauri invoke (only available in Tauri context)
let tauriInvoke: ((cmd: string, args?: any) => Promise<any>) | null = null;

const getInvoke = async () => {
    if (tauriInvoke) return tauriInvoke;

    if (isTauri()) {
        try {
            const tauri = await import('@tauri-apps/api/core');
            tauriInvoke = tauri.invoke;
            return tauriInvoke;
        } catch (e) {
            console.warn('Failed to import Tauri API:', e);
        }
    }
    return null;
};

/**
 * Linear Algebra operations powered by Rust
 */
export const rustLinAlg = {
    /**
     * Solve Ax = b using Preconditioned Conjugate Gradient
     * 
     * @param triplets - Sparse matrix in triplet format
     * @param b - Right-hand side vector
     * @param nRows - Number of rows (defaults to b.length)
     * @param nCols - Number of columns (defaults to b.length)
     * @param tol - Convergence tolerance (default: 1e-6)
     * @param maxIter - Maximum iterations (default: 1000)
     * @returns Solution x, iteration count, error, and timing
     */
    solveCG: async (
        triplets: SparseTriplet[],
        b: number[],
        nRows?: number,
        nCols?: number,
        tol: number = 1e-6,
        maxIter: number = 1000
    ): Promise<CgResult> => {
        const invoke = await getInvoke();

        if (invoke) {
            // Use Rust backend
            return invoke('solve_cg', {
                triplets,
                b,
                nRows: nRows ?? b.length,
                nCols: nCols ?? b.length,
                tol,
                maxIter,
            });
        } else {
            // Fallback to JS implementation
            console.warn('[tauriClient] Rust backend not available, using JS fallback');
            const { solveCG: jsSolveCG } = await import('../core/math/KLinearAlgebra');
            const { SparseMatrix } = await import('../core/math/KLinearAlgebra');

            const start = performance.now();

            const A = new SparseMatrix(nRows ?? b.length, nCols ?? b.length);
            triplets.forEach(t => A.addTriplet(t.i, t.j, t.v));
            A.build();

            const bArray = new Float64Array(b);
            const result = jsSolveCG(A, bArray, undefined, tol, maxIter);

            const elapsed = performance.now() - start;

            return {
                x: Array.from(result.x),
                iter: result.iter,
                error: result.error,
                time_ms: elapsed,
            };
        }
    },

    /**
     * Sparse matrix-vector multiply: y = A * x
     */
    sparseMultiply: async (
        triplets: SparseTriplet[],
        x: number[],
        nRows?: number,
        nCols?: number
    ): Promise<MultiplyResult> => {
        const invoke = await getInvoke();

        if (invoke) {
            return invoke('sparse_multiply', {
                triplets,
                x,
                nRows: nRows ?? x.length,
                nCols: nCols ?? x.length,
            });
        } else {
            // Fallback to JS
            const { SparseMatrix } = await import('../core/math/KLinearAlgebra');

            const start = performance.now();

            const A = new SparseMatrix(nRows ?? x.length, nCols ?? x.length);
            triplets.forEach(t => A.addTriplet(t.i, t.j, t.v));
            A.build();

            const xArray = new Float64Array(x);
            const y = A.multiplyVec(xArray);

            const elapsed = performance.now() - start;

            return {
                y: Array.from(y),
                time_ms: elapsed,
            };
        }
    },

    /**
     * Benchmark the CG solver with a synthetic Laplacian matrix
     */
    benchmark: async (size: number, maxIter: number = 1000): Promise<BenchmarkResult> => {
        const invoke = await getInvoke();

        if (invoke) {
            return invoke('benchmark_cg', { size, maxIter });
        } else {
            // Create benchmark in JS
            const { solveCG, SparseMatrix } = await import('../core/math/KLinearAlgebra');

            const start = performance.now();

            const A = new SparseMatrix(size, size);
            for (let i = 0; i < size; i++) {
                A.addTriplet(i, i, 2.0);
                if (i > 0) A.addTriplet(i, i - 1, -1.0);
                if (i < size - 1) A.addTriplet(i, i + 1, -1.0);
            }
            A.build();

            const b = new Float64Array(size).fill(1.0);
            const result = solveCG(A, b, undefined, 1e-6, maxIter);

            const elapsed = performance.now() - start;

            return {
                rust_time_ms: elapsed,  // It's actually JS time, but same interface
                iterations: result.iter,
                error: result.error,
                matrix_size: size,
                nnz: 3 * size - 2,
            };
        }
    },

    /**
     * Check if Rust backend is available
     */
    isAvailable: async (): Promise<boolean> => {
        const invoke = await getInvoke();
        return invoke !== null;
    },
};

/**
 * Run a comparison benchmark between JS and Rust solvers
 */
export const runComparisonBenchmark = async (size: number = 5000): Promise<{
    js: BenchmarkResult;
    rust: BenchmarkResult | null;
    speedup: number | null;
}> => {
    // Always run JS benchmark
    const { solveCG, SparseMatrix } = await import('../core/math/KLinearAlgebra');

    const jsStart = performance.now();

    const A = new SparseMatrix(size, size);
    for (let i = 0; i < size; i++) {
        A.addTriplet(i, i, 2.0);
        if (i > 0) A.addTriplet(i, i - 1, -1.0);
        if (i < size - 1) A.addTriplet(i, i + 1, -1.0);
    }
    A.build();

    const b = new Float64Array(size).fill(1.0);
    const jsResult = solveCG(A, b, undefined, 1e-6, 1000);

    const jsTime = performance.now() - jsStart;

    const jsBench: BenchmarkResult = {
        rust_time_ms: jsTime,
        iterations: jsResult.iter,
        error: jsResult.error,
        matrix_size: size,
        nnz: 3 * size - 2,
    };

    // Try Rust benchmark
    const invoke = await getInvoke();

    if (invoke) {
        const rustBench: BenchmarkResult = await invoke('benchmark_cg', { size, maxIter: 1000 });

        console.log(`
🦀 BENCHMARK RESULTS (${size}x${size} Laplacian)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
JavaScript: ${jsTime.toFixed(2)}ms (${jsResult.iter} iterations)
Rust:       ${rustBench.rust_time_ms.toFixed(2)}ms (${rustBench.iterations} iterations)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SPEEDUP:    ${(jsTime / rustBench.rust_time_ms).toFixed(1)}x 🚀
        `);

        return {
            js: jsBench,
            rust: rustBench,
            speedup: jsTime / rustBench.rust_time_ms,
        };
    } else {
        console.log(`
📊 JS BENCHMARK (${size}x${size} Laplacian) - Rust not available
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
JavaScript: ${jsTime.toFixed(2)}ms (${jsResult.iter} iterations)
        `);

        return {
            js: jsBench,
            rust: null,
            speedup: null,
        };
    }
};

export default { rustLinAlg, runComparisonBenchmark };
