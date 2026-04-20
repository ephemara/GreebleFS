
import * as THREE from 'three';

export const BRUSH_VERT = `
  varying vec2 vUv;
  varying vec2 vMapUV;
  
  void main() {
    vUv = uv;
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vMapUV = worldPos.xy; 
    gl_Position = projectionMatrix * worldPos;
  }
`;

export const BRUSH_FRAG = `
  varying vec2 vUv;
  varying vec2 vMapUV;
  
  uniform vec3 uColor;
  uniform float uOpacity;
  uniform float uHardness;
  uniform float uAngle;
  uniform float uTexScale;
  
  uniform sampler2D uBrushAlpha;
  uniform bool uUseBrushAlpha;
  
  uniform sampler2D uSrcTex;
  uniform bool uUseSrcTex;

  // --- MASKING SUPPORT ---
  uniform sampler2D uMaskMap;
  uniform bool uUseMask;

  // --- SMART MASKS ---
  // --- PROJECTION MODE ---
  uniform bool uProjectionMode;
  uniform vec3 uBrushPos;
  uniform float uBrushRadius;

  // --- SMART MASKS ---
  uniform bool uUseSmartMask;
  uniform sampler2D uCurvatureMap; // R=Convex(Edges), G=Concave(Cavities)
  uniform sampler2D uNormalMap;    // World Normals
  uniform sampler2D uPositionMap;  // World Positions
  
  uniform float uEdgeMask;   // -1.0 (Cavity) to 1.0 (Edge). 0.0 = Off
  uniform float uSlopeMask;  // -1.0 (Bottom) to 1.0 (Top). 0.0 = Off
  uniform float uHeightMask; // -1.0 (Low) to 1.0 (High). 0.0 = Off
  
  vec2 rotateUV(vec2 uv, float rotation) {
      float mid = 0.5;
      return vec2(
          cos(rotation) * (uv.x - mid) + sin(rotation) * (uv.y - mid) + mid,
          cos(rotation) * (uv.y - mid) - sin(rotation) * (uv.x - mid) + mid
      );
  }
  
  void main() {
    // 1. Check Mask Buffer First (Global Mask)
    if (uUseMask) {
        float maskVal = texture2D(uMaskMap, vMapUV).r;
        if (maskVal > 0.99) discard; // Fully masked optimization
    }

    float alpha = 0.0;
    
    if (uProjectionMode) {
        // --- 3D PROJECTION MODE ---
        // Sample World Position from baked map
        vec3 worldPos = texture2D(uPositionMap, vMapUV).xyz;
        if (length(worldPos) < 0.001) discard; // Empty space background

        float dist3D = distance(worldPos, uBrushPos);
        
        // Hardness calc for 3D
        // Map 0 -> uBrushRadius to 1.0 -> 0.0
        // smoothstep(edge0, edge1, x)
        // We want 1.0 inside 'hardness' core, fading to 0.0 at radius
        
        float falloffStart = uBrushRadius * uHardness;
        alpha = 1.0 - smoothstep(falloffStart, uBrushRadius, dist3D);

        // Discard far pixels to save fill rate? Unlikely to help in fragment shader after dispatch, but cleaner.
        if (dist3D > uBrushRadius) discard;
        
    } else {
        // --- 2D UV MODE ---
        vec2 center = vec2(0.5);
        vec2 rUv = rotateUV(vUv, uAngle);
        float dist = distance(vUv, center) * 2.0; // 0.0 to 1.414 (corner)
        alpha = 1.0 - smoothstep(uHardness, 1.0, dist);
        
        if (uUseBrushAlpha) {
            vec4 mask = texture2D(uBrushAlpha, rUv);
            alpha *= mask.r; 
        }
    }
    
    // --- SMART MASK LOGIC (Procedural) ---
    if (uUseSmartMask) {
        vec2 meshUV = vMapUV;
        
        // 1. Edge/Cavity Mask
        if (abs(uEdgeMask) > 0.01) {
            vec4 curv = texture2D(uCurvatureMap, meshUV);
            float edge = curv.r;   
            float cavity = curv.g; 
            if (uEdgeMask > 0.0) alpha *= smoothstep(1.0 - uEdgeMask, 1.0, edge);
            else alpha *= smoothstep(1.0 + uEdgeMask, 1.0, cavity);
        }

        // 2. Slope Mask (Top/Bottom facing)
        if (abs(uSlopeMask) > 0.01) {
            vec3 norm = texture2D(uNormalMap, meshUV).xyz * 2.0 - 1.0;
            float up = norm.y; 
            if (uSlopeMask > 0.0) alpha *= smoothstep(1.0 - uSlopeMask, 1.0, up);
            else alpha *= smoothstep(1.0 + uSlopeMask, 1.0, -up);
        }

        // 3. Height Mask (Position Y)
        if (abs(uHeightMask) > 0.01) {
            float height = texture2D(uPositionMap, meshUV).y;
            if (uHeightMask > 0.0) {
                 alpha *= smoothstep(uHeightMask - 0.2, uHeightMask + 0.2, height);
            } else {
                 float level = abs(uHeightMask);
                 alpha *= 1.0 - smoothstep(level - 0.2, level + 0.2, height);
            }
        }
    }

    // --- APPLY GLOBAL MASK (Soft) ---
    if (uUseMask) {
        float maskVal = texture2D(uMaskMap, vMapUV).r;
        alpha *= (1.0 - maskVal);
    }
    
    vec3 outColor = uColor;
    
    if (uUseSrcTex) {
        vec2 texUV;
        if (uProjectionMode) {
             // Triplanar-ish or just World projected?
             // Simple Box projection based on position for now, or just use meshUV * scale
             texUV = vMapUV * uTexScale; 
        } else {
             texUV = vMapUV * uTexScale;
        }
        vec4 src = texture2D(uSrcTex, texUV);
        outColor *= src.rgb;
    }
    
    gl_FragColor = vec4(outColor, alpha * uOpacity);
    if (gl_FragColor.a <= 0.001) discard;
  }
`;

export const MASK_BRUSH_FRAG = `
  varying vec2 vUv;
  varying vec2 vMapUV;
  
  uniform float uOpacity;
  uniform float uHardness;
  uniform float uAngle;
  uniform float uValue; // 1.0 for Add, 0.0 for Subtract
  
  uniform sampler2D uBrushAlpha;
  uniform bool uUseBrushAlpha;

  vec2 rotateUV(vec2 uv, float rotation) {
      float mid = 0.5;
      return vec2(
          cos(rotation) * (uv.x - mid) + sin(rotation) * (uv.y - mid) + mid,
          cos(rotation) * (uv.y - mid) - sin(rotation) * (uv.x - mid) + mid
      );
  }

  void main() {
    vec2 center = vec2(0.5);
    vec2 rUv = rotateUV(vUv, uAngle);
    float dist = distance(vUv, center) * 2.0;
    
    float alpha = 1.0 - smoothstep(uHardness, 1.0, dist);
    
    if (uUseBrushAlpha) {
        vec4 mask = texture2D(uBrushAlpha, rUv);
        alpha *= mask.r;
    }

    float str = alpha * uOpacity;
    
    // Output R channel is the mask value.
    // We blend this additively or subtractively in the blend function of the material/renderer
    gl_FragColor = vec4(str, 0.0, 0.0, str); 
  }
`;

export const COPY_VERT = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position, 1.0);
  }
`;

export const COPY_FRAG = `
  uniform sampler2D tDiffuse;
  uniform float uOpacity;
  varying vec2 vUv;
  void main() {
    vec4 tex = texture2D(tDiffuse, vUv);
    gl_FragColor = vec4(tex.rgb, tex.a * uOpacity);
  }
`;

export const FILL_FRAG = `
  uniform sampler2D tSource;
  uniform bool uUseTexture;
  uniform vec3 uColor;
  uniform float uAlpha;
  varying vec2 vUv;
  void main() {
    if (uUseTexture) {
        vec4 tex = texture2D(tSource, vUv);
        gl_FragColor = tex;
    } else {
        gl_FragColor = vec4(uColor, uAlpha);
    }
  }
`;

// --- SIMULATION KERNELS ---

export const SIM_VERT = `varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position, 1.0); }`;

// BLACK HOLE PHYSICS KERNEL
export const BLACK_HOLE_FRAG = `
  uniform sampler2D tVelocity; // Current velocity field
  uniform vec2 uCenter;        // Center of black hole (0.5, 0.5 usually)
  uniform float uStrength;     // Gravity/Mass
  uniform float uSpin;         // Angular Momentum
  uniform float uRadius;       // Event Horizon Radius
  uniform float uDecay;        // Stability damping
  uniform float uDt;
  varying vec2 vUv;

  void main() {
    vec2 vel = texture2D(tVelocity, vUv).xy;
    
    // Apply heavy decay to stabilize the chaotic energy
    vel *= uDecay;

    vec2 dir = uCenter - vUv;
    float dist = length(dir);
    
    // Radius check - localize the effect
    // We use smoothstep for soft edges around the event horizon
    float influence = 1.0 - smoothstep(uRadius * 0.8, uRadius, dist);
    
    if (influence > 0.001) {
        // Singularity protection
        float effectiveDist = max(dist, 0.001);
        
        vec2 normDir = normalize(dir);
        
        // 1. Gravity (Attraction)
        float gravity = uStrength / (effectiveDist * 10.0 + 0.1);
        
        // 2. Spin (Accretion Disk)
        vec2 tangent = vec2(-normDir.y, normDir.x);
        float spin = uSpin / (effectiveDist * 5.0 + 0.1);
        
        // Apply Forces limited by influence
        vec2 force = (normDir * gravity) + (tangent * spin);
        vel += force * influence * uDt;
    }
    
    // Velocity Clamp to prevent explosion
    float speed = length(vel);
    if (speed > 5.0) {
        vel = normalize(vel) * 5.0;
    }

    gl_FragColor = vec4(vel, 0.0, 1.0);
  }
`;

export const REACTION_FRAG = `
  uniform sampler2D tSource;
  uniform vec2 resolution;
  varying vec2 vUv;

  void main() {
    vec2 texel = 1.0 / resolution;
    vec4 uv = texture2D(tSource, vUv);
    
    vec4 uv_L = texture2D(tSource, vUv + vec2(-texel.x, 0.0));
    vec4 uv_R = texture2D(tSource, vUv + vec2(texel.x, 0.0));
    vec4 uv_T = texture2D(tSource, vUv + vec2(0.0, texel.y));
    vec4 uv_B = texture2D(tSource, vUv + vec2(0.0, -texel.y));
    
    vec4 laplacian = (uv_L + uv_R + uv_T + uv_B - 4.0 * uv);
    
    float dA = 1.0;
    float dB = 0.5;
    float feed = 0.037;
    float k = 0.06;
    
    float a = uv.r;
    float b = uv.g;
    
    float newA = a + (dA * laplacian.r - a * b * b + feed * (1.0 - a));
    float newB = b + (dB * laplacian.g + a * b * b - (k + feed) * b);
    
    gl_FragColor = vec4(clamp(newA, 0.0, 1.0), clamp(newB, 0.0, 1.0), uv.b * 0.99, uv.a);
  }
`;

export const VORTEX_FRAG = `
  uniform sampler2D tSource;
  uniform float time;
  uniform vec2 resolution;
  varying vec2 vUv;

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

  void main() {
    float scale = 10.0;
    float n1 = snoise(vUv * scale + time * 0.1);
    float n2 = snoise(vUv * scale + vec2(100.0) + time * 0.1);
    vec2 vel = vec2(n1, n2) * 0.005;
    vec2 coord = vUv - vel;
    gl_FragColor = texture2D(tSource, coord);
  }
`;

export const FERRO_FRAG = `
  uniform sampler2D tSource;
  uniform vec2 resolution;
  varying vec2 vUv;

  void main() {
    vec2 texel = 1.0 / resolution;
    float h = texture2D(tSource, vUv).r; 
    float hL = texture2D(tSource, vUv + vec2(-texel.x, 0.0)).r;
    float hR = texture2D(tSource, vUv + vec2(texel.x, 0.0)).r;
    float hT = texture2D(tSource, vUv + vec2(0.0, texel.y)).r;
    float hB = texture2D(tSource, vUv + vec2(0.0, -texel.y)).r;
    float laplacian = hL + hR + hT + hB - 4.0 * h;
    vec4 color = texture2D(tSource, vUv);
    vec4 outColor = color;
    if (h > 0.1) {
        outColor.r += laplacian * -0.5; 
        outColor.g += laplacian * -0.5;
        outColor.b += laplacian * -0.5;
    }
    gl_FragColor = clamp(outColor, 0.0, 1.0);
  }
`;

export const QUANTUM_FRAG = `
  uniform sampler2D tSource;
  uniform vec2 resolution;
  uniform float time;
  varying vec2 vUv;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }

  void main() {
    vec4 self = texture2D(tSource, vUv);
    if (self.a < 0.01) discard;
    float prob = hash(vUv * 100.0 + time);
    if (prob > 0.98) {
        gl_FragColor = self * 0.9;
    } else if (prob < 0.02) {
        gl_FragColor = min(self * 1.5, 1.0);
    } else {
        vec2 offset = (vec2(hash(vUv), hash(vUv + 1.0)) - 0.5) * 0.01;
        vec4 neighbor = texture2D(tSource, vUv + offset);
        gl_FragColor = mix(self, neighbor, 0.1);
    }
  }
`;

export const CHRONOS_FRAG = `
  uniform sampler2D tSource;
  uniform float time;
  varying vec2 vUv;
  void main() {
    vec4 self = texture2D(tSource, vUv);
    gl_FragColor = max(self * 0.98, vec4(0.0));
  }
`;

// --- FIXED SIMULATION KERNELS ---

export const GRAVITY_FRAG = `
  uniform sampler2D tSource;
  uniform float time;
  uniform vec2 resolution;
  uniform float uSpeed;
  varying vec2 vUv;

  void main() {
    vec2 texel = 1.0 / resolution;
    
    // Sample above
    vec4 above = texture2D(tSource, vUv + vec2(0.0, texel.y));
    float heaviness = length(above.rgb) * above.a;
    
    float jitter = sin(vUv.y * 50.0 + time) * 0.0005;
    vec2 offset = vec2(jitter, 0.002 * heaviness * uSpeed);
    
    vec4 flowColor = texture2D(tSource, vUv + offset);
    gl_FragColor = flowColor;
  }
`;

export const RIVULET_FRAG = `
  uniform sampler2D tSource;
  uniform float time;
  uniform vec2 resolution;
  uniform float uChaos;
  uniform float uSpeed;
  varying vec2 vUv;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
  float noise(vec2 p) {
      vec2 i = floor(p); vec2 f = fract(p); f = f*f*(3.0-2.0*f);
      return mix(mix(hash(i + vec2(0.0,0.0)), hash(i + vec2(1.0,0.0)), f.x),
                 mix(hash(i + vec2(0.0,1.0)), hash(i + vec2(1.0,1.0)), f.x), f.y);
  }

  void main() {
    vec2 texel = 1.0 / resolution;
    vec4 self = texture2D(tSource, vUv);
    
    float n = noise(vec2(vUv.x * 20.0, vUv.y * 5.0 + time * 0.5));
    vec2 flow = vec2((n - 0.5) * 0.004 * uChaos, 0.005 * uSpeed); 
    
    vec4 incoming = texture2D(tSource, vUv + flow);
    float strength = length(incoming.rgb);
    vec4 result = incoming;
    
    if (strength < 0.1) result = self; 
    
    gl_FragColor = result;
  }
`;

export const GROWTH_FRAG = `
  uniform sampler2D tSource;
  uniform vec2 resolution;
  uniform float time;
  uniform float uSpeed;
  uniform float uChaos;
  varying vec2 vUv;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }

  void main() {
    vec2 texel = 1.0 / resolution;
    vec4 self = texture2D(tSource, vUv);
    
    if (self.a > 0.1) {
        gl_FragColor = self;
        return;
    }
    
    // Check 4 direct neighbors
    vec4 nL = texture2D(tSource, vUv + vec2(-texel.x, 0.0));
    vec4 nR = texture2D(tSource, vUv + vec2(texel.x, 0.0));
    vec4 nT = texture2D(tSource, vUv + vec2(0.0, texel.y));
    vec4 nB = texture2D(tSource, vUv + vec2(0.0, -texel.y));
    
    float chance = 0.0;
    vec4 grower = vec4(0.0);
    
    if(nL.a > 0.5) { chance += 1.0; grower = nL; }
    if(nR.a > 0.5) { chance += 1.0; grower = nR; }
    if(nT.a > 0.5) { chance += 1.0; grower = nT; }
    if(nB.a > 0.5) { chance += 1.0; grower = nB; }
    
    float rnd = hash(vUv * 100.0 + time);
    
    // Dynamic threshold based on speed and chaos
    float threshold = 0.99 - (uSpeed * 0.1) + (uChaos * 0.05);
    
    if (chance > 0.0 && rnd > threshold) {
        gl_FragColor = grower;
    } else {
        gl_FragColor = self;
    }
  }
`;

// --- BAKING SHADERS ---

export const BAKE_VERT = `
  varying vec3 vNormal;
  varying vec3 vPosition;
  varying vec2 vUv;
  void main() {
    vUv = uv;
    vec4 worldNormal = modelMatrix * vec4(normal, 0.0);
    vNormal = normalize(worldNormal.xyz);
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vPosition = worldPos.xyz;
    gl_Position = vec4(uv.x * 2.0 - 1.0, uv.y * 2.0 - 1.0, 0.0, 1.0);
  }
`;

export const NORMAL_BAKE_FRAG = `
  varying vec3 vNormal;
  void main() {
    gl_FragColor = vec4(vNormal * 0.5 + 0.5, 1.0);
  }
`;

export const POS_BAKE_FRAG = `
  varying vec3 vPosition;
  void main() {
    gl_FragColor = vec4(vPosition, 1.0);
  }
`;

// IMPROVED: Added Spread for softer edges
export const CURVATURE_COMPUTE_FRAG = `
  uniform sampler2D tNormal;
  uniform vec2 resolution;
  uniform float uSpread; 
  varying vec2 vUv;
  void main() {
    vec2 texel = (1.0 / resolution) * uSpread;
    
    vec3 n = texture2D(tNormal, vUv).xyz * 2.0 - 1.0;
    
    // Sample 4 neighbors with spread
    vec3 nL = texture2D(tNormal, vUv - vec2(texel.x, 0.0)).xyz * 2.0 - 1.0;
    vec3 nR = texture2D(tNormal, vUv + vec2(texel.x, 0.0)).xyz * 2.0 - 1.0;
    vec3 nT = texture2D(tNormal, vUv + vec2(0.0, texel.y)).xyz * 2.0 - 1.0;
    vec3 nB = texture2D(tNormal, vUv - vec2(0.0, texel.y)).xyz * 2.0 - 1.0;
    
    float edge = length(n - nL) + length(n - nR) + length(n - nT) + length(n - nB);
    
    // R = Edges (Convex), G = Cavities (Approximation), B = Empty
    gl_FragColor = vec4(edge, edge * 0.5, 0.0, 1.0); 
  }
`;
