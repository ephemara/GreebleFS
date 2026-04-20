import * as THREE from 'three';

/**
 * K-RIG WEBGPU COMPUTE SYSTEM
 * 
 * Handles GPU-accelerated operations for rigging:
 * 1. Mesh Voxelization
 * 2. Geodesic Distance Calculation (Heat Diffusion)
 * 3. Weight Transfer from Voxels to Vertices
 * 
 * This is the "Secret Sauce" that makes auto-skinning production-quality.
 */

export interface VoxelGrid {
    resolution: number;
    bounds: THREE.Box3;
    voxelSize: number;
    data: Uint8Array; // 1 = solid, 0 = empty
}

export interface WeightMap {
    vertexCount: number;
    boneWeights: Float32Array; // [bone0_v0, bone0_v1, ..., bone1_v0, ...]
    boneCount: number;
}

export class KRigCompute {
    device: GPUDevice | null = null;
    initialized = false;

    // Shader modules
    voxelizeShader: GPUShaderModule | null = null;
    heatDiffusionShader: GPUShaderModule | null = null;
    weightTransferShader: GPUShaderModule | null = null;

    constructor() { }

    /**
     * Initialize WebGPU context
     */
    async initialize(): Promise<boolean> {
        if (this.initialized) return true;

        if (!navigator.gpu) {
            console.error('K-RIG COMPUTE: WebGPU not supported in this browser');
            return false;
        }

        try {
            const adapter = await navigator.gpu.requestAdapter();
            if (!adapter) {
                console.error('K-RIG COMPUTE: No GPU adapter found');
                return false;
            }

            this.device = await adapter.requestDevice();

            // Compile shaders
            this.voxelizeShader = this.device.createShaderModule({
                label: 'Voxelize Shader',
                code: this.getVoxelizeShaderCode()
            });

            this.heatDiffusionShader = this.device.createShaderModule({
                label: 'Heat Diffusion Shader',
                code: this.getHeatDiffusionShaderCode()
            });

            this.weightTransferShader = this.device.createShaderModule({
                label: 'Weight Transfer Shader',
                code: this.getWeightTransferShaderCode()
            });

            this.initialized = true;
            console.log('K-RIG COMPUTE: WebGPU initialized successfully');
            return true;
        } catch (error) {
            console.error('K-RIG COMPUTE: Failed to initialize WebGPU', error);
            return false;
        }
    }

    /**
     * STEP 1: Voxelize the mesh
     * Converts mesh into a 3D grid of occupied/empty cells
     */
    async voxelizeMesh(
        geometry: THREE.BufferGeometry,
        resolution: number = 128
    ): Promise<VoxelGrid> {
        if (!this.device || !this.voxelizeShader) {
            throw new Error('WebGPU not initialized');
        }

        // Calculate bounds
        geometry.computeBoundingBox();
        const bounds = geometry.boundingBox!;
        const size = new THREE.Vector3();
        bounds.getSize(size);
        const maxDim = Math.max(size.x, size.y, size.z);
        const voxelSize = maxDim / resolution;

        // Expand bounds slightly to avoid edge cases
        bounds.min.subScalar(voxelSize * 0.5);
        bounds.max.addScalar(voxelSize * 0.5);

        console.log(`K-RIG COMPUTE: Voxelizing mesh at ${resolution}³ resolution`);

        // Prepare vertex data
        const positions = geometry.attributes.position.array;
        const indices = geometry.index ? geometry.index.array : null;

        const vertexBuffer = this.device.createBuffer({
            label: 'Vertex Buffer',
            size: positions.byteLength,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
            mappedAtCreation: true
        });
        new Float32Array(vertexBuffer.getMappedRange()).set(positions);
        vertexBuffer.unmap();

        // Create index buffer if mesh is indexed
        let indexBuffer: GPUBuffer | null = null;
        let triangleCount = 0;

        if (indices) {
            triangleCount = indices.length / 3;
            // Always allocate for 32-bit indices (4 bytes per index)
            // Shader expects array<u32>
            const indexBufferSize = indices.length * 4;

            // Align to 4 bytes (implicitly handled by *4 but good practice to be aligned)
            const alignedSize = (indexBufferSize + 3) & ~3;

            indexBuffer = this.device.createBuffer({
                label: 'Index Buffer',
                size: alignedSize,
                usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
                mappedAtCreation: true
            });
            new Uint32Array(indexBuffer.getMappedRange()).set(indices);
            indexBuffer.unmap();
        } else {
            triangleCount = positions.length / 9;
        }

        // Create voxel grid buffer
        const gridSize = resolution * resolution * resolution;
        const voxelBuffer = this.device.createBuffer({
            label: 'Voxel Grid',
            size: gridSize,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC
        });

        // Create uniform buffer for parameters
        const uniformData = new Float32Array([
            bounds.min.x, bounds.min.y, bounds.min.z, voxelSize,
            resolution, triangleCount, indices ? 1 : 0, 0
        ]);
        const uniformBuffer = this.device.createBuffer({
            label: 'Voxelize Uniforms',
            size: uniformData.byteLength,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
            mappedAtCreation: true
        });
        new Float32Array(uniformBuffer.getMappedRange()).set(uniformData);
        uniformBuffer.unmap();

        // Create compute pipeline
        const pipeline = this.device.createComputePipeline({
            label: 'Voxelize Pipeline',
            layout: 'auto',
            compute: {
                module: this.voxelizeShader,
                entryPoint: 'main'
            }
        });

        // Create bind group
        const bindGroup = this.device.createBindGroup({
            label: 'Voxelize Bind Group',
            layout: pipeline.getBindGroupLayout(0),
            entries: [
                { binding: 0, resource: { buffer: uniformBuffer } },
                { binding: 1, resource: { buffer: vertexBuffer } },
                { binding: 2, resource: { buffer: indexBuffer || vertexBuffer } },
                { binding: 3, resource: { buffer: voxelBuffer } }
            ]
        });

        // Execute compute shader
        const commandEncoder = this.device.createCommandEncoder();
        const passEncoder = commandEncoder.beginComputePass();
        passEncoder.setPipeline(pipeline);
        passEncoder.setBindGroup(0, bindGroup);

        const workgroupCount = Math.ceil(triangleCount / 64);
        passEncoder.dispatchWorkgroups(workgroupCount);
        passEncoder.end();

        // Read back results
        const stagingBuffer = this.device.createBuffer({
            size: gridSize,
            usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST
        });

        commandEncoder.copyBufferToBuffer(voxelBuffer, 0, stagingBuffer, 0, gridSize);
        this.device.queue.submit([commandEncoder.finish()]);

        await stagingBuffer.mapAsync(GPUMapMode.READ);
        const voxelData = new Uint8Array(stagingBuffer.getMappedRange()).slice();
        stagingBuffer.unmap();

        // Cleanup
        vertexBuffer.destroy();
        if (indexBuffer) indexBuffer.destroy();
        voxelBuffer.destroy();
        uniformBuffer.destroy();
        stagingBuffer.destroy();

        const occupiedVoxels = voxelData.reduce((sum, val) => sum + (val > 0 ? 1 : 0), 0);
        console.log(`K-RIG COMPUTE: Voxelization complete. ${occupiedVoxels}/${gridSize} voxels occupied`);

        return {
            resolution,
            bounds,
            voxelSize,
            data: voxelData
        };
    }

    /**
     * STEP 2: Calculate geodesic distances using heat diffusion
     * This is the magic that prevents "sticky armpits"
     */
    async calculateGeodesicWeights(
        voxelGrid: VoxelGrid,
        bonePositions: THREE.Vector3[],
        iterations: number = 50
    ): Promise<Float32Array[]> {
        if (!this.device || !this.heatDiffusionShader) {
            throw new Error('WebGPU not initialized');
        }

        console.log(`K-RIG COMPUTE: Computing geodesic weights for ${bonePositions.length} bones`);

        const resolution = voxelGrid.resolution;
        const gridSize = resolution * resolution * resolution;
        const boneWeights: Float32Array[] = [];

        // Process each bone
        for (let boneIdx = 0; boneIdx < bonePositions.length; boneIdx++) {
            const bonePos = bonePositions[boneIdx];

            // Convert bone world position to voxel coordinates
            const voxelX = Math.floor((bonePos.x - voxelGrid.bounds.min.x) / voxelGrid.voxelSize);
            const voxelY = Math.floor((bonePos.y - voxelGrid.bounds.min.y) / voxelGrid.voxelSize);
            const voxelZ = Math.floor((bonePos.z - voxelGrid.bounds.min.z) / voxelGrid.voxelSize);

            // Clamp to grid bounds
            const seedX = Math.max(0, Math.min(resolution - 1, voxelX));
            const seedY = Math.max(0, Math.min(resolution - 1, voxelY));
            const seedZ = Math.max(0, Math.min(resolution - 1, voxelZ));

            // Run heat diffusion from this bone
            const heatMap = await this.runHeatDiffusion(
                voxelGrid,
                seedX, seedY, seedZ,
                iterations
            );

            boneWeights.push(heatMap);

            const progress = ((boneIdx + 1) / bonePositions.length * 100).toFixed(0);
            console.log(`K-RIG COMPUTE: Bone ${boneIdx + 1}/${bonePositions.length} (${progress}%)`);
        }

        return boneWeights;
    }

    /**
     * Run heat diffusion simulation from a seed point
     */
    private async runHeatDiffusion(
        voxelGrid: VoxelGrid,
        seedX: number,
        seedY: number,
        seedZ: number,
        iterations: number
    ): Promise<Float32Array> {
        if (!this.device || !this.heatDiffusionShader) {
            throw new Error('WebGPU not initialized');
        }

        const resolution = voxelGrid.resolution;
        const gridSize = resolution * resolution * resolution;

        // Create buffers for ping-pong heat diffusion
        const heatBuffer0 = this.device.createBuffer({
            label: 'Heat Map 0',
            size: gridSize * 4,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST
        });

        const heatBuffer1 = this.device.createBuffer({
            label: 'Heat Map 1',
            size: gridSize * 4,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC
        });

        // Initialize heat buffer (seed point = 1.0, rest = 0.0)
        const initialHeat = new Float32Array(gridSize);
        const seedIdx = seedX + seedY * resolution + seedZ * resolution * resolution;
        initialHeat[seedIdx] = 1.0;

        const stagingBuffer = this.device.createBuffer({
            size: gridSize * 4,
            usage: GPUBufferUsage.MAP_WRITE | GPUBufferUsage.COPY_SRC,
            mappedAtCreation: true
        });
        new Float32Array(stagingBuffer.getMappedRange()).set(initialHeat);
        stagingBuffer.unmap();

        const commandEncoder = this.device.createCommandEncoder();
        commandEncoder.copyBufferToBuffer(stagingBuffer, 0, heatBuffer0, 0, gridSize * 4);
        this.device.queue.submit([commandEncoder.finish()]);

        // Upload voxel grid
        const voxelBuffer = this.device.createBuffer({
            label: 'Voxel Grid',
            size: gridSize,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
            mappedAtCreation: true
        });
        new Uint8Array(voxelBuffer.getMappedRange()).set(voxelGrid.data);
        voxelBuffer.unmap();

        // Prepare uniform data
        const uniformData = new Uint32Array([resolution, 0, 0, 0]);
        const uniformBuffer = this.device.createBuffer({
            label: 'Diffusion Uniforms',
            size: uniformData.byteLength,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
            mappedAtCreation: true
        });
        new Uint32Array(uniformBuffer.getMappedRange()).set(uniformData);
        uniformBuffer.unmap();

        // Create pipeline
        const pipeline = this.device.createComputePipeline({
            label: 'Heat Diffusion Pipeline',
            layout: 'auto',
            compute: {
                module: this.heatDiffusionShader,
                entryPoint: 'main'
            }
        });

        // Run iterations (ping-pong between buffers)
        for (let i = 0; i < iterations; i++) {
            const srcBuffer = i % 2 === 0 ? heatBuffer0 : heatBuffer1;
            const dstBuffer = i % 2 === 0 ? heatBuffer1 : heatBuffer0;

            const bindGroup = this.device.createBindGroup({
                label: `Diffusion Bind Group ${i}`,
                layout: pipeline.getBindGroupLayout(0),
                entries: [
                    { binding: 0, resource: { buffer: uniformBuffer } },
                    { binding: 1, resource: { buffer: voxelBuffer } },
                    { binding: 2, resource: { buffer: srcBuffer } },
                    { binding: 3, resource: { buffer: dstBuffer } }
                ]
            });

            const encoder = this.device.createCommandEncoder();
            const pass = encoder.beginComputePass();
            pass.setPipeline(pipeline);
            pass.setBindGroup(0, bindGroup);
            pass.dispatchWorkgroups(
                Math.ceil(resolution / 4),
                Math.ceil(resolution / 4),
                Math.ceil(resolution / 4)
            );
            pass.end();
            this.device.queue.submit([encoder.finish()]);
        }

        // Read back final result
        const finalBuffer = iterations % 2 === 0 ? heatBuffer0 : heatBuffer1;
        const readBuffer = this.device.createBuffer({
            size: gridSize * 4,
            usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST
        });

        const encoder = this.device.createCommandEncoder();
        encoder.copyBufferToBuffer(finalBuffer, 0, readBuffer, 0, gridSize * 4);
        this.device.queue.submit([encoder.finish()]);

        await readBuffer.mapAsync(GPUMapMode.READ);
        const result = new Float32Array(readBuffer.getMappedRange()).slice();
        readBuffer.unmap();

        // Cleanup
        heatBuffer0.destroy();
        heatBuffer1.destroy();
        voxelBuffer.destroy();
        uniformBuffer.destroy();
        stagingBuffer.destroy();
        readBuffer.destroy();

        return result;
    }

    /**
     * STEP 3: Transfer voxel weights to mesh vertices
     */
    async transferWeightsToVertices(
        geometry: THREE.BufferGeometry,
        voxelGrid: VoxelGrid,
        boneHeatMaps: Float32Array[]
    ): Promise<WeightMap> {
        const positions = geometry.attributes.position;
        const vertexCount = positions.count;
        const boneCount = boneHeatMaps.length;

        console.log(`K-RIG COMPUTE: Transferring weights to ${vertexCount} vertices for ${boneCount} bones`);

        // For each vertex, sample the nearest voxel from each bone's heat map
        const vertexWeights = new Float32Array(vertexCount * 4); // top 4 bones per vertex
        const vertexIndices = new Uint16Array(vertexCount * 4);

        for (let v = 0; v < vertexCount; v++) {
            const vx = positions.getX(v);
            const vy = positions.getY(v);
            const vz = positions.getZ(v);

            // Convert to voxel coordinates
            const gx = Math.floor((vx - voxelGrid.bounds.min.x) / voxelGrid.voxelSize);
            const gy = Math.floor((vy - voxelGrid.bounds.min.y) / voxelGrid.voxelSize);
            const gz = Math.floor((vz - voxelGrid.bounds.min.z) / voxelGrid.voxelSize);

            // Clamp
            const resolution = voxelGrid.resolution;
            const cx = Math.max(0, Math.min(resolution - 1, gx));
            const cy = Math.max(0, Math.min(resolution - 1, gy));
            const cz = Math.max(0, Math.min(resolution - 1, gz));

            const voxelIdx = cx + cy * resolution + cz * resolution * resolution;

            // Sample heat from all bones
            const boneInfluences: Array<{ boneIdx: number; weight: number }> = [];
            for (let b = 0; b < boneCount; b++) {
                const heat = boneHeatMaps[b][voxelIdx];
                if (heat > 0.001) {
                    boneInfluences.push({ boneIdx: b, weight: heat });
                }
            }

            // Sort by weight and take top 4
            boneInfluences.sort((a, b) => b.weight - a.weight);
            const top4 = boneInfluences.slice(0, 4);

            // Normalize weights
            let totalWeight = top4.reduce((sum, inf) => sum + inf.weight, 0);
            if (totalWeight === 0) totalWeight = 1; // Fallback

            for (let i = 0; i < 4; i++) {
                if (i < top4.length) {
                    vertexIndices[v * 4 + i] = top4[i].boneIdx;
                    vertexWeights[v * 4 + i] = top4[i].weight / totalWeight;
                } else {
                    vertexIndices[v * 4 + i] = 0;
                    vertexWeights[v * 4 + i] = 0;
                }
            }
        }

        console.log('K-RIG COMPUTE: Weight transfer complete');

        return {
            vertexCount,
            boneWeights: vertexWeights,
            boneCount
        };
    }

    /**
     * Dispose and cleanup
     */
    dispose() {
        this.device = null;
        this.initialized = false;
    }

    // ========== SHADER CODE ==========

    private getVoxelizeShaderCode(): string {
        return `
            struct Uniforms {
                boundsMin: vec3f,
                voxelSize: f32,
                resolution: u32,
                triangleCount: u32,
                isIndexed: u32,
                padding: u32
            }

            @group(0) @binding(0) var<uniform> uniforms: Uniforms;
            @group(0) @binding(1) var<storage, read> vertices: array<f32>;
            @group(0) @binding(2) var<storage, read> indices: array<u32>;
            @group(0) @binding(3) var<storage, read_write> voxels: array<atomic<u32>>;

            @compute @workgroup_size(64)
            fn main(@builtin(global_invocation_id) globalId: vec3u) {
                let triIdx = globalId.x;
                if (triIdx >= uniforms.triangleCount) { return; }

                // Get triangle vertices
                var v0: vec3f;
                var v1: vec3f;
                var v2: vec3f;

                if (uniforms.isIndexed == 1u) {
                    let i0 = indices[triIdx * 3u + 0u];
                    let i1 = indices[triIdx * 3u + 1u];
                    let i2 = indices[triIdx * 3u + 2u];
                    v0 = vec3f(vertices[i0 * 3u + 0u], vertices[i0 * 3u + 1u], vertices[i0 * 3u + 2u]);
                    v1 = vec3f(vertices[i1 * 3u + 0u], vertices[i1 * 3u + 1u], vertices[i1 * 3u + 2u]);
                    v2 = vec3f(vertices[i2 * 3u + 0u], vertices[i2 * 3u + 1u], vertices[i2 * 3u + 2u]);
                } else {
                    let base = triIdx * 9u;
                    v0 = vec3f(vertices[base + 0u], vertices[base + 1u], vertices[base + 2u]);
                    v1 = vec3f(vertices[base + 3u], vertices[base + 4u], vertices[base + 5u]);
                    v2 = vec3f(vertices[base + 6u], vertices[base + 7u], vertices[base + 8u]);
                }

                // Calculate triangle bounding box in voxel space
                let minCorner = min(min(v0, v1), v2);
                let maxCorner = max(max(v0, v1), v2);

                let voxelMin = vec3u((minCorner - uniforms.boundsMin) / uniforms.voxelSize);
                let voxelMax = vec3u((maxCorner - uniforms.boundsMin) / uniforms.voxelSize);

                // Iterate over voxels in triangle's bounding box
                for (var z = voxelMin.z; z <= min(voxelMax.z, uniforms.resolution - 1u); z++) {
                    for (var y = voxelMin.y; y <= min(voxelMax.y, uniforms.resolution - 1u); y++) {
                        for (var x = voxelMin.x; x <= min(voxelMax.x, uniforms.resolution - 1u); x++) {
                            // Check if voxel center intersects triangle (simple AABB test)
                            let voxelCenter = uniforms.boundsMin + vec3f(f32(x), f32(y), f32(z)) * uniforms.voxelSize;
                            
                            // Simple test: if voxel is close to triangle, mark as solid
                            // Production would use proper triangle-box intersection
                            if (pointNearTriangle(voxelCenter, v0, v1, v2, uniforms.voxelSize)) {
                                let idx = x + y * uniforms.resolution + z * uniforms.resolution * uniforms.resolution;
                                atomicStore(&voxels[idx], 1u);
                            }
                        }
                    }
                }
            }

            fn pointNearTriangle(p: vec3f, v0: vec3f, v1: vec3f, v2: vec3f, threshold: f32) -> bool {
                // Project point onto triangle plane and check distance
                let n = normalize(cross(v1 - v0, v2 - v0));
                let dist = abs(dot(p - v0, n));
                return dist < threshold * 1.5;
            }
        `;
    }

    private getHeatDiffusionShaderCode(): string {
        return `
            struct Uniforms {
                resolution: u32,
                padding0: u32,
                padding1: u32,
                padding2: u32
            }

            @group(0) @binding(0) var<uniform> uniforms: Uniforms;
            @group(0) @binding(1) var<storage, read> voxels: array<u32>;
            @group(0) @binding(2) var<storage, read> heatIn: array<f32>;
            @group(0) @binding(3) var<storage, read_write> heatOut: array<f32>;

            @compute @workgroup_size(4, 4, 4)
            fn main(@builtin(global_invocation_id) globalId: vec3u) {
                let x = globalId.x;
                let y = globalId.y;
                let z = globalId.z;
                let res = uniforms.resolution;

                if (x >= res || y >= res || z >= res) { return; }

                let idx = x + y * res + z * res * res;

                // If this voxel is empty, no heat propagation
                if (voxels[idx] == 0u) {
                    heatOut[idx] = 0.0;
                    return;
                }

                // Average heat from 6 neighbors (Laplacian diffusion)
                var heat = heatIn[idx];
                var neighborCount = 0.0;
                var neighborSum = 0.0;

                // Check all 6 neighbors
                if (x > 0u && voxels[idx - 1u] > 0u) {
                    neighborSum += heatIn[idx - 1u];
                    neighborCount += 1.0;
                }
                if (x < res - 1u && voxels[idx + 1u] > 0u) {
                    neighborSum += heatIn[idx + 1u];
                    neighborCount += 1.0;
                }
                if (y > 0u && voxels[idx - res] > 0u) {
                    neighborSum += heatIn[idx - res];
                    neighborCount += 1.0;
                }
                if (y < res - 1u && voxels[idx + res] > 0u) {
                    neighborSum += heatIn[idx + res];
                    neighborCount += 1.0;
                }
                if (z > 0u && voxels[idx - res * res] > 0u) {
                    neighborSum += heatIn[idx - res * res];
                    neighborCount += 1.0;
                }
                if (z < res - 1u && voxels[idx + res * res] > 0u) {
                    neighborSum += heatIn[idx + res * res];
                    neighborCount += 1.0;
                }

                // Diffusion: blend current heat with neighbor average
                if (neighborCount > 0.0) {
                    let diffusionRate = 0.15;
                    heat = heat * (1.0 - diffusionRate) + (neighborSum / neighborCount) * diffusionRate;
                }

                heatOut[idx] = heat;
            }
        `;
    }

    private getWeightTransferShaderCode(): string {
        // Not needed - we do this on CPU for simplicity
        return '';
    }
}

/**
 * Utility: Smooth step function
 */
function smoothstep(edge0: number, edge1: number, x: number): number {
    const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
    return t * t * (3 - 2 * t);
}
