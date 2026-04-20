
import * as THREE from 'three';

export interface AudioData {
    bass: number; // 0-1
    mid: number; // 0-1
    high: number; // 0-1
    level: number; // 0-1 (Total volume)
    raw: Uint8Array;
}

/**
 * AudioReactor
 * Core system for extracting real-time frequency data from audio sources.
 * Used for visualizers, shader inputs, and animation drivers.
 */
export class AudioReactor {
    private ctx: AudioContext | null = null;
    private analyser: AnalyserNode | null = null;
    private source: MediaElementAudioSourceNode | null = null;
    private dataArray: Uint8Array<ArrayBuffer> | null = null;
    private fftSize: number = 512;
    
    // Smoothing factors
    public smoothing: number = 0.8;
    public bassSensitivity: number = 1.0;
    public highSensitivity: number = 1.0;

    // Current State
    public current: AudioData = {
        bass: 0,
        mid: 0,
        high: 0,
        level: 0,
        raw: new Uint8Array(0)
    };

    constructor(fftSize = 512) {
        this.fftSize = fftSize;
    }

    /**
     * Initialize with an HTML Audio Element
     */
    init(audioElement: HTMLMediaElement) {
        if (!this.ctx) {
            const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
            this.ctx = new AudioContext();
        }

        if (this.ctx.state === 'suspended') {
            this.ctx.resume();
        }

        if (this.source) {
            this.source.disconnect();
        }

        this.analyser = this.ctx.createAnalyser();
        this.analyser.fftSize = this.fftSize;
        this.analyser.smoothingTimeConstant = this.smoothing;
        
        this.dataArray = new Uint8Array(new ArrayBuffer(this.analyser.frequencyBinCount));
        this.current.raw = this.dataArray;

        this.source = this.ctx.createMediaElementSource(audioElement);
        this.source.connect(this.analyser);
        this.analyser.connect(this.ctx.destination);
    }

    /**
     * Update frequency data. Call this in the render loop.
     */
    update() {
        if (!this.analyser || !this.dataArray) return;

        this.analyser.smoothingTimeConstant = this.smoothing;
        this.analyser.getByteFrequencyData(this.dataArray);

        const length = this.dataArray.length;
        const bassRange = Math.floor(length * 0.05); // Bottom 5%
        const midRange = Math.floor(length * 0.2); // Next 20%
        const highRange = length - bassRange - midRange;

        let bassSum = 0, midSum = 0, highSum = 0, totalSum = 0;

        for (let i = 0; i < length; i++) {
            const val = this.dataArray[i];
            totalSum += val;
            if (i < bassRange) bassSum += val;
            else if (i < bassRange + midRange) midSum += val;
            else highSum += val;
        }

        // Normalize 0-1
        this.current.bass = Math.min((bassSum / bassRange / 255) * this.bassSensitivity, 1.0);
        this.current.mid = (midSum / midRange / 255);
        this.current.high = Math.min((highSum / highRange / 255) * this.highSensitivity, 1.0);
        this.current.level = (totalSum / length / 255);
    }

    /**
     * Create a DataTexture for use in Shaders
     */
    createTexture(): THREE.DataTexture {
        const size = this.analyser ? this.analyser.frequencyBinCount : 128;
        const tex = new THREE.DataTexture(
            new Uint8Array(size), 
            size, 
            1, 
            THREE.RedFormat, 
            THREE.UnsignedByteType
        );
        tex.needsUpdate = true;
        return tex;
    }

    /**
     * Update a shader texture with current raw data
     */
    updateTexture(texture: THREE.DataTexture) {
        if (!this.dataArray) return;
        texture.image.data.set(this.dataArray);
        texture.needsUpdate = true;
    }

    dispose() {
        if (this.ctx) this.ctx.close();
        this.source = null;
        this.analyser = null;
    }
}
