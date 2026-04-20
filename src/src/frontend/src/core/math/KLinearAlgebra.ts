/**
 * KLinearAlgebra.ts
 * 
 * A lightweight, high-performance Sparse Linear Algebra library for K_OS.
 * Designed for solving symmetric positive-definite systems (like LSCM / FEM)
 * completely in JavaScript/TypeScript without external WASM dependencies.
 * 
 * Features:
 * - SparseMatrix (Triplet form for assembly, CSR for arithmetic)
 * - Conjugate Gradient (CG) Solver
 */

export class SparseMatrix {
    // Coordinate list (Triplet) format for easy construction
    triplets: { i: number; j: number; v: number }[] = [];

    // Compressed Row Storage (CSR) format for fast multiplication
    // Only populated after .build() is called
    nRows: number = 0;
    nCols: number = 0;
    rowPtr: Int32Array | null = null;
    colIdx: Int32Array | null = null;
    values: Float64Array | null = null;
    isBuilt: boolean = false;

    constructor(rows: number = 0, cols: number = 0) {
        this.nRows = rows;
        this.nCols = cols;
    }

    addTriplet(i: number, j: number, v: number) {
        this.triplets.push({ i, j, v });
    }

    // Convert Triplet to CSR for fast matrix-vector operations
    build(rows?: number, cols?: number) {
        if (rows) this.nRows = rows;
        if (cols) this.nCols = cols;

        // Sort triplets by row, then col
        this.triplets.sort((a, b) => {
            if (a.i !== b.i) return a.i - b.i;
            return a.j - b.j;
        });

        // Consolidate duplicates (sum values)
        const uniqueTriplets: { i: number; j: number; v: number }[] = [];
        if (this.triplets.length > 0) {
            let curr = this.triplets[0];
            for (let k = 1; k < this.triplets.length; k++) {
                const next = this.triplets[k];
                if (next.i === curr.i && next.j === curr.j) {
                    curr.v += next.v;
                } else {
                    uniqueTriplets.push(curr);
                    curr = next;
                }
            }
            uniqueTriplets.push(curr);
        }

        // Allocate CSR arrays
        const nz = uniqueTriplets.length;
        this.rowPtr = new Int32Array(this.nRows + 1);
        this.colIdx = new Int32Array(nz);
        this.values = new Float64Array(nz);

        let currentNz = 0;
        for (let i = 0; i < this.nRows; i++) {
            this.rowPtr[i] = currentNz;
            while (currentNz < nz && uniqueTriplets[currentNz].i === i) {
                this.colIdx[currentNz] = uniqueTriplets[currentNz].j;
                this.values[currentNz] = uniqueTriplets[currentNz].v;
                currentNz++;
            }
        }
        this.rowPtr[this.nRows] = nz; // Sentinel

        this.isBuilt = true;
        // console.log(`SparseMatrix Built: ${this.nRows}x${this.nCols}, ${nz} non-zeros`);
    }

    // y = A * x
    multiplyVec(x: Float64Array | number[]): Float64Array {
        if (!this.isBuilt) throw new Error("Matrix not built");
        const y = new Float64Array(this.nRows);

        for (let i = 0; i < this.nRows; i++) {
            const start = this.rowPtr![i];
            const end = this.rowPtr![i + 1];
            let dot = 0;
            for (let k = start; k < end; k++) {
                dot += this.values![k] * x[this.colIdx![k]];
            }
            y[i] = dot;
        }
        return y;
    }

    // Transpose Multiply: y = A^T * x
    multiplyTransposeVec(x: Float64Array | number[]): Float64Array {
        if (!this.isBuilt) throw new Error("Matrix not built");
        const y = new Float64Array(this.nCols); // Result size is nCols

        // A^T * x is tricky with CSR, usually better to transpose the matrix first
        // But we can iterate CSR and accumulate:
        // For each element A_ij, add A_ij * x_i to y_j
        for (let i = 0; i < this.nRows; i++) {
            const start = this.rowPtr![i];
            const end = this.rowPtr![i + 1];
            const xi = x[i];
            for (let k = start; k < end; k++) {
                const col = this.colIdx![k];
                const val = this.values![k];
                y[col] += val * xi;
            }
        }
        return y;
    }
    // Get diagonal element A_ii
    diag(i: number): number {
        if (!this.isBuilt) throw new Error("Matrix not built");
        const start = this.rowPtr![i];
        const end = this.rowPtr![i + 1];
        for (let k = start; k < end; k++) {
            if (this.colIdx![k] === i) return this.values![k];
        }
        return 0; // Should not happen for valid Laplacian
    }
}

// Basic Vector Operations
export const vec = {
    dot: (a: Float64Array, b: Float64Array) => {
        let sum = 0;
        for (let i = 0; i < a.length; i++) sum += a[i] * b[i];
        return sum;
    },
    addScaled: (a: Float64Array, b: Float64Array, s: number) => {
        const out = new Float64Array(a.length);
        for (let i = 0; i < a.length; i++) out[i] = a[i] + b[i] * s;
        return out;
    },
    sub: (a: Float64Array, b: Float64Array) => {
        const out = new Float64Array(a.length);
        for (let i = 0; i < a.length; i++) out[i] = a[i] - b[i];
        return out;
    },
    norm: (a: Float64Array) => Math.sqrt(vec.dot(a, a)),
    zero: (n: number) => new Float64Array(n),
    copy: (a: Float64Array) => new Float64Array(a)
};

// Helper: Apply Jacobi Preconditioner (M^-1 * r)
// M is the diagonal of A. M^-1 is 1/diag.
/**
 * Solve Ax = b using Preconditioned Conjugate Gradient (PCG) method.
 * A must be Symmetric Positive Definite.
 * Optimized with cached Inverse Diagonal preconditioner.
 */
export const solveCG = (
    A: SparseMatrix,
    b: Float64Array,
    x0?: Float64Array,
    tol: number = 1e-6,
    maxIter: number = 1000
): { x: Float64Array, iter: number, error: number } => {

    const n = b.length;
    // Helper: implicit vec usage or use the helper object?
    // The user code uses `vec` object. The file has `export const vec`.
    // We can use it.

    const x = x0 ? vec.copy(x0) : new Float64Array(n);
    // r = b - Ax
    const r = vec.sub(b, A.multiplyVec(x));

    // Pre-calculate Jacobi Preconditioner (Inverse Diagonal)
    const Minv = new Float64Array(n);
    for (let i = 0; i < n; i++) {
        const d = A.diag(i);
        Minv[i] = (Math.abs(d) > 1e-9) ? 1.0 / d : 1.0;
    }

    // z = M^-1 * r
    const z = new Float64Array(n);
    for (let i = 0; i < n; i++) z[i] = Minv[i] * r[i];

    const p = vec.copy(z);
    let rsold = vec.dot(r, z);

    let k = 0;
    for (k = 0; k < maxIter; k++) {
        const Ap = A.multiplyVec(p);
        const alpha = rsold / (vec.dot(p, Ap) + 1e-10);

        // x = x + alpha * p
        for (let i = 0; i < n; i++) x[i] += alpha * p[i];
        // r = r - alpha * Ap
        for (let i = 0; i < n; i++) r[i] -= alpha * Ap[i];

        const error = Math.sqrt(vec.dot(r, r));
        if (error < tol) return { x, iter: k, error };

        // z = M^-1 * r
        for (let i = 0; i < n; i++) z[i] = Minv[i] * r[i];

        const rsnew = vec.dot(r, z);
        const beta = rsnew / rsold;

        // p = z + beta * p
        for (let i = 0; i < n; i++) p[i] = z[i] + beta * p[i];

        rsold = rsnew;
    }

    return { x, iter: k, error: Math.sqrt(vec.dot(r, r)) };
};

export default { SparseMatrix, solveCG, vec };
