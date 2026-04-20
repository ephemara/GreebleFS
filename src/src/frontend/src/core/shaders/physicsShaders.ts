
/**
 * CORE PHYSICS SHADERS
 * Extracted from K-Quantum and K-Chronos for global reuse.
 */

// --- NAVIER-STOKES FLUID DYNAMICS ---

export const FLUID_VERT = `
  varying vec2 vUv; 
  void main() { 
    vUv = uv; 
    gl_Position = vec4(position, 1.0); 
  }
`;

export const FLUID_ADVECT = `
  uniform sampler2D velocityTex; 
  uniform sampler2D sourceTex; 
  uniform float dt; 
  uniform float dissipation; 
  varying vec2 vUv; 
  void main() { 
    // Follow velocity field backwards
    vec2 coord = vUv - dt * texture2D(velocityTex, vUv).xy * 0.01; 
    gl_FragColor = texture2D(sourceTex, coord) * dissipation; 
  }
`;

export const FLUID_DIV = `
  uniform sampler2D velocityTex; 
  uniform vec2 texelSize;
  varying vec2 vUv; 
  void main() { 
    float L = texture2D(velocityTex, vUv - vec2(texelSize.x, 0.0)).x; 
    float R = texture2D(velocityTex, vUv + vec2(texelSize.x, 0.0)).x; 
    float T = texture2D(velocityTex, vUv + vec2(0.0, texelSize.y)).y; 
    float B = texture2D(velocityTex, vUv - vec2(0.0, texelSize.y)).y; 
    
    // Calculate divergence (net flow in/out)
    float div = 0.5 * (R - L + T - B); 
    gl_FragColor = vec4(div, 0.0, 0.0, 1.0); 
  }
`;

export const FLUID_PRESS = `
  uniform sampler2D pressureTex; 
  uniform sampler2D divergenceTex; 
  uniform vec2 texelSize;
  varying vec2 vUv; 
  void main() { 
    float L = texture2D(pressureTex, vUv - vec2(texelSize.x, 0.0)).x; 
    float R = texture2D(pressureTex, vUv + vec2(texelSize.x, 0.0)).x; 
    float T = texture2D(pressureTex, vUv + vec2(0.0, texelSize.y)).x; 
    float B = texture2D(pressureTex, vUv - vec2(0.0, texelSize.y)).x; 
    float div = texture2D(divergenceTex, vUv).x; 
    
    // Jacobi iteration for pressure field
    float p = (L + R + T + B - div) * 0.25; 
    gl_FragColor = vec4(p, 0.0, 0.0, 1.0); 
  }
`;

export const FLUID_GRAD = `
  uniform sampler2D pressureTex; 
  uniform sampler2D velocityTex; 
  uniform vec2 texelSize;
  varying vec2 vUv; 
  void main() { 
    float L = texture2D(pressureTex, vUv - vec2(texelSize.x, 0.0)).x; 
    float R = texture2D(pressureTex, vUv + vec2(texelSize.x, 0.0)).x; 
    float T = texture2D(pressureTex, vUv + vec2(0.0, texelSize.y)).x; 
    float B = texture2D(pressureTex, vUv - vec2(0.0, texelSize.y)).x; 
    
    vec2 v = texture2D(velocityTex, vUv).xy; 
    // Subtract pressure gradient to enforce incompressibility
    v -= vec2(R - L, T - B); 
    gl_FragColor = vec4(v, 0.0, 1.0); 
  }
`;

export const FLUID_SPLAT = `
  uniform sampler2D targetTex; 
  uniform vec2 point; 
  uniform vec3 color; 
  uniform float radius; 
  varying vec2 vUv; 
  void main() { 
    vec2 p = vUv - point.xy; 
    // Gaussian splat
    vec3 splat = exp(-dot(p, p) / radius) * color; 
    vec3 base = texture2D(targetTex, vUv).xyz; 
    gl_FragColor = vec4(base + splat, 1.0); 
  }
`;

// --- ENTROPY / PARTICLE PHYSICS ---

export const PARTICLE_SIM_VERT = `
  varying vec2 vUv; 
  void main() { 
    vUv = uv; 
    gl_Position = vec4(position, 1.0); 
  }
`;

export const CURL_NOISE_FUNC = `
  vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec3 permute(vec3 x) { return mod289(((x*34.0)+1.0)*x); }
  float snoise(vec2 v) { const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439); vec2 i = floor(v + dot(v, C.yy) ); vec2 x0 = v - i + dot(i, C.xx); vec2 i1; i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0); vec4 x12 = x0.xyxy + C.xxzz; x12.xy -= i1; i = mod289(i); vec3 p = permute( permute( i.y + vec3(0.0, i1.y, 1.0 )) + i.x + vec3(0.0, i1.x, 1.0 )); vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0); m = m*m ; m = m*m ; vec3 x = 2.0 * fract(p * C.www) - 1.0; vec3 h = abs(x) - 0.5; vec3 ox = floor(x + 0.5); vec3 a0 = x - ox; m *= 1.79284291400159 - 0.85373472095314 * ( a0*a0 + h*h ); vec3 g; g.x = a0.x * x0.x + h.x * x0.y; g.yz = a0.yz * x12.xz + h.yz * x12.yw; return 130.0 * dot(m, g); }
  vec3 curl(float x, float y, float z) { float eps = 0.1; float n1 = snoise(vec2(x, y)); float n2 = snoise(vec2(y, z)); float n3 = snoise(vec2(z, x)); return vec3(n2 - n3, n3 - n1, n1 - n2); }
`;
