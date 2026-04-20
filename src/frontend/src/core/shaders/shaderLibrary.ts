/**
 * Shared Shader Library
 * Common GLSL functions and shaders used across multiple apps
 */

// ===== NOISE FUNCTIONS =====
export const SIMPLEX_NOISE = `
  vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec3 permute(vec3 x) { return mod289(((x*34.0)+1.0)*x); }
  
  float snoise(vec2 v) {
    const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
    vec2 i  = floor(v + dot(v, C.yy) );
    vec2 x0 = v - i + dot(i, C.xx);
    vec2 i1;
    i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
    vec4 x12 = x0.xyxy + C.xxzz;
    x12.xy -= i1;
    i = mod289(i);
    vec3 p = permute( permute( i.y + vec3(0.0, i1.y, 1.0 )) + i.x + vec3(0.0, i1.x, 1.0 ));
    vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
    m = m*m ;
    m = m*m ;
    vec3 x = 2.0 * fract(p * C.www) - 1.0;
    vec3 h = abs(x) - 0.5;
    vec3 ox = floor(x + 0.5);
    vec3 a0 = x - ox;
    m *= 1.79284291400159 - 0.85373472095314 * ( a0*a0 + h*h );
    vec3 g;
    g.x  = a0.x  * x0.x  + h.x  * x0.y;
    g.yz = a0.yz * x12.xz + h.yz * x12.yw;
    return 130.0 * dot(m, g);
  }
`;

export const RANDOM_FUNCTION = `
  float rand(vec2 co) { 
    return fract(sin(dot(co.xy, vec2(12.9898, 78.233))) * 43758.5453); 
  }
`;

export const HASH_FUNCTION = `
  float hash(vec2 p) { 
    return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); 
  }
`;

// ===== COMMON VERTEX SHADERS =====
export const SIMPLE_VERTEX = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position, 1.0);
  }
`;

export const FULLSCREEN_VERTEX = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

// ===== COMMON UTILITY FUNCTIONS =====
export const ROTATE_UV = `
  vec2 rotateUV(vec2 uv, float rotation) {
    float mid = 0.5;
    return vec2(
      cos(rotation) * (uv.x - mid) + sin(rotation) * (uv.y - mid) + mid,
      cos(rotation) * (uv.y - mid) - sin(rotation) * (uv.x - mid) + mid
    );
  }
`;

export const CIRCULAR_FALLOFF = `
  float circularFalloff(vec2 uv, vec2 center, float radius, float hardness) {
    float dist = distance(uv, center) * 2.0;
    return 1.0 - smoothstep(hardness, 1.0, dist / radius);
  }
`;

// ===== SHADER TEMPLATE BUILDER =====
export const buildShader = (vertex: string, fragment: string, includes: string[] = []) => {
    const includesCode = includes.join('\n');
    return {
        vertex: includesCode + '\n' + vertex,
        fragment: includesCode + '\n' + fragment
    };
};

// ===== COMMON SHADER INCLUDES =====
export const SHADER_INCLUDES = {
    noise: SIMPLEX_NOISE,
    random: RANDOM_FUNCTION,
    hash: HASH_FUNCTION,
    rotateUV: ROTATE_UV,
    falloff: CIRCULAR_FALLOFF
};

