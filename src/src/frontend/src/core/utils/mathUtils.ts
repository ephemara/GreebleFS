// Common math utilities used across multiple apps

export const fract = (x: number): number => x - Math.floor(x);

export const hash = (n: number): number => fract(Math.sin(n) * 43758.5453123);

export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

export const clamp = (value: number, min: number, max: number): number => 
    Math.min(Math.max(value, min), max);

export const mapRange = (value: number, inMin: number, inMax: number, outMin: number, outMax: number): number => 
    ((value - inMin) * (outMax - outMin)) / (inMax - inMin) + outMin;

