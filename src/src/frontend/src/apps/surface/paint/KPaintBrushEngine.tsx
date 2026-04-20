
import * as THREE from 'three';

export const TEXTURE_SIZE = 2048;
const FLUID_SIZE = 512; // Lower res for physics perf

// --- BRUSH SHADER (Supports Textures) ---
const BRUSH_VERT = `
  varying vec2 vUv;
  varying vec2 vMapUV;
  
  void main() {
    vUv = uv;
    // Calculate the Map UV (0..1) based on the position in the render target
    // modelMatrix places the brush at the target UV location
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vMapUV = worldPos.xy; 
    gl_Position = projectionMatrix * worldPos;
  }
`;

const BRUSH_FRAG = `
  varying vec2 vUv;
  varying vec2 vMapUV;
  
  uniform vec3 uColor;
  uniform float uOpacity;
  uniform float uHardness;
  uniform float uAngle;
  uniform float uTexScale;
  
  // Brush Alpha Mask (The shape of the brush tip)
  uniform sampler2D uBrushAlpha;
  uniform bool uUseBrushAlpha;
  
  // Material Source Texture (The texture being painted, e.g. Wood Grain)
  uniform sampler2D uSrcTex;
  uniform bool uUseSrcTex;
  
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
    
    // 1. Calculate Base Alpha (Hardness + Shape)
    float alpha = 1.0 - smoothstep(uHardness, 1.0, dist);
    
    if (uUseBrushAlpha) {
        vec4 mask = texture2D(uBrushAlpha, rUv);
        alpha *= mask.r; 
    }
    
    // 2. Calculate Color/Value
    vec3 outColor = uColor;
    
    if (uUseSrcTex) {
        // Sample texture using Map UVs (tiled) instead of Brush UVs
        // This ensures the material is continuous across strokes (Liquid Feel)
        vec2 texUV = vMapUV * uTexScale;
        vec4 src = texture2D(uSrcTex, texUV);
        
        // If painting a texture, uColor should act as a tint (usually white 1,1,1)
        outColor *= src.rgb;
    }
    
    gl_FragColor = vec4(outColor, alpha * uOpacity);
    
    if (gl_FragColor.a <= 0.001) discard;
  }
`;

// --- COPY SHADER (For Compositing) ---
const COPY_VERT = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position, 1.0);
  }
`;
const COPY_FRAG = `
  uniform sampler2D tDiffuse;
  uniform float uOpacity;
  varying vec2 vUv;
  void main() {
    vec4 tex = texture2D(tDiffuse, vUv);
    gl_FragColor = vec4(tex.rgb, tex.a * uOpacity);
  }
`;

// --- FILL SHADER (For Material Fill & Clearing) ---
const FILL_FRAG = `
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

// --- FLUID SIMULATION SHADERS ---
const SIM_VERT = `varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position, 1.0); }`;

const FLUID_ADVECT = `
  uniform sampler2D velocityTex; 
  uniform sampler2D sourceTex; 
  uniform float dt; 
  uniform float dissipation; 
  varying vec2 vUv; 
  void main() { 
    vec2 coord = vUv - dt * texture2D(velocityTex, vUv).xy * 0.01; 
    gl_FragColor = texture2D(sourceTex, coord) * dissipation; 
  }
`;

const FLUID_DIV = `
  uniform sampler2D velocityTex; 
  varying vec2 vUv; 
  void main() { 
    float w = 1.0/512.0; 
    float L = texture2D(velocityTex, vUv - vec2(w, 0.0)).x; 
    float R = texture2D(velocityTex, vUv + vec2(w, 0.0)).x; 
    float T = texture2D(velocityTex, vUv + vec2(0.0, w)).y; 
    float B = texture2D(velocityTex, vUv - vec2(0.0, w)).y; 
    float div = 0.5 * (R - L + T - B); 
    gl_FragColor = vec4(div, 0.0, 0.0, 1.0); 
  }
`;

const FLUID_PRESS = `
  uniform sampler2D pressureTex; 
  uniform sampler2D divergenceTex; 
  varying vec2 vUv; 
  void main() { 
    float w = 1.0/512.0; 
    float L = texture2D(pressureTex, vUv - vec2(w, 0.0)).x; 
    float R = texture2D(pressureTex, vUv + vec2(w, 0.0)).x; 
    float T = texture2D(pressureTex, vUv + vec2(0.0, w)).x; 
    float B = texture2D(pressureTex, vUv - vec2(0.0, w)).x; 
    float div = texture2D(divergenceTex, vUv).x; 
    float p = (L + R + T + B - div) * 0.25; 
    gl_FragColor = vec4(p, 0.0, 0.0, 1.0); 
  }
`;

const FLUID_GRAD = `
  uniform sampler2D pressureTex; 
  uniform sampler2D velocityTex; 
  varying vec2 vUv; 
  void main() { 
    float w = 1.0/512.0; 
    float L = texture2D(pressureTex, vUv - vec2(w, 0.0)).x; 
    float R = texture2D(pressureTex, vUv + vec2(w, 0.0)).x; 
    float T = texture2D(pressureTex, vUv + vec2(0.0, w)).x; 
    float B = texture2D(pressureTex, vUv - vec2(0.0, w)).x; 
    vec2 v = texture2D(velocityTex, vUv).xy; 
    v -= vec2(R - L, T - B); 
    gl_FragColor = vec4(v, 0.0, 1.0); 
  }
`;

const FLUID_SPLAT = `
  uniform sampler2D targetTex; 
  uniform vec2 point; 
  uniform vec3 color; 
  uniform float radius; 
  varying vec2 vUv; 
  void main() { 
    vec2 p = vUv - point.xy; 
    // Aspect ratio correction if needed, but assuming square textures for UV
    vec3 splat = exp(-dot(p, p) / radius) * color; 
    vec3 base = texture2D(targetTex, vUv).xyz; 
    gl_FragColor = vec4(base + splat, 1.0); 
  }
`;

// --- NEW SIMULATION SHADERS ---

const REACTION_FRAG = `
  uniform sampler2D tSource;
  uniform vec2 resolution;
  varying vec2 vUv;

  void main() {
    vec2 texel = 1.0 / resolution;
    vec4 uv = texture2D(tSource, vUv);
    
    // Convolution
    vec4 uv_L = texture2D(tSource, vUv + vec2(-texel.x, 0.0));
    vec4 uv_R = texture2D(tSource, vUv + vec2(texel.x, 0.0));
    vec4 uv_T = texture2D(tSource, vUv + vec2(0.0, texel.y));
    vec4 uv_B = texture2D(tSource, vUv + vec2(0.0, -texel.y));
    
    vec4 laplacian = (uv_L + uv_R + uv_T + uv_B - 4.0 * uv);
    
    // Pseudo Gray-Scott applied to RGB channels as chemicals
    // TUNED CONSTANTS FOR ORGANIC GROWTH (Mitosis pattern)
    float dA = 1.0;
    float dB = 0.5;
    float feed = 0.037;
    float k = 0.06;
    
    // Treat R as 'A' and G as 'B'
    float a = uv.r;
    float b = uv.g;
    
    float newA = a + (dA * laplacian.r - a * b * b + feed * (1.0 - a));
    float newB = b + (dB * laplacian.g + a * b * b - (k + feed) * b);
    
    gl_FragColor = vec4(clamp(newA, 0.0, 1.0), clamp(newB, 0.0, 1.0), uv.b * 0.99, uv.a);
  }
`;

const VORTEX_FRAG = `
  uniform sampler2D tSource;
  uniform float time;
  uniform vec2 resolution;
  varying vec2 vUv;

  // Simple Simplex-like noise
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
    
    // Curl
    vec2 vel = vec2(n1, n2) * 0.005;
    
    vec2 coord = vUv - vel;
    gl_FragColor = texture2D(tSource, coord);
  }
`;

const GRAVITY_FRAG = `
  uniform sampler2D tSource;
  uniform float time;
  uniform vec2 resolution;
  varying vec2 vUv;

  void main() {
    vec2 texel = 1.0 / resolution;
    
    // Heaviness based on color intensity
    vec4 above = texture2D(tSource, vUv + vec2(0.0, texel.y));
    float heaviness = length(above.rgb) * above.a;
    
    // Jitter x to make drips meandering
    float jitter = sin(vUv.y * 50.0 + time) * 0.0005;
    
    // Calculate offset to sample from
    // Heavier pixels flow faster
    vec2 offset = vec2(jitter, 0.002 * heaviness);
    
    vec4 flowColor = texture2D(tSource, vUv + offset);
    gl_FragColor = flowColor;
  }
`;

const RIVULET_FRAG = `
  uniform sampler2D tSource;
  uniform float time;
  uniform vec2 resolution;
  varying vec2 vUv;

  // Simple noise for flow variation
  float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
  float noise(vec2 p) {
      vec2 i = floor(p); vec2 f = fract(p); f = f*f*(3.0-2.0*f);
      return mix(mix(hash(i + vec2(0.0,0.0)), hash(i + vec2(1.0,0.0)), f.x),
                 mix(hash(i + vec2(0.0,1.0)), hash(i + vec2(1.0,1.0)), f.x), f.y);
  }

  void main() {
    vec2 texel = 1.0 / resolution;
    
    // Sample texture to see where paint exists
    vec4 self = texture2D(tSource, vUv);
    
    // Flow Field Generation
    // We want flow to be primarily DOWN (y-axis), but disturbed by noise
    // The noise should stretch vertically to create "streams"
    float n = noise(vec2(vUv.x * 20.0, vUv.y * 5.0 + time * 0.5));
    
    // Flow vector: X is wobbly, Y is strong down
    vec2 flow = vec2((n - 0.5) * 0.004, 0.005); 
    
    // Advect: Look "up stream" (uv - flow)
    // If the pixel above has paint, pull it down
    vec4 incoming = texture2D(tSource, vUv + flow);
    
    // Thresholding to sharpen lines (Rivulet effect)
    // If incoming paint is weak, ignore it to prevent blur. 
    // If it's strong, pull it.
    float strength = length(incoming.rgb);
    vec4 result = incoming;
    
    if (strength < 0.1) result = self; // Don't smear empty space
    
    // Decay slightly to prevent infinite accumulation? No, paint builds up.
    gl_FragColor = result;
  }
`;

const GROWTH_FRAG = `
  uniform sampler2D tSource;
  uniform vec2 resolution;
  uniform float time;
  varying vec2 vUv;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }

  void main() {
    vec2 texel = 1.0 / resolution;
    vec4 self = texture2D(tSource, vUv);
    
    // If I already have paint, stay painted
    if (self.a > 0.1) {
        gl_FragColor = self;
        return;
    }
    
    // Check 8 neighbors
    vec4 n1 = texture2D(tSource, vUv + vec2(-texel.x, texel.y));
    vec4 n2 = texture2D(tSource, vUv + vec2(0.0, texel.y));
    vec4 n3 = texture2D(tSource, vUv + vec2(texel.x, texel.y));
    vec4 n4 = texture2D(tSource, vUv + vec2(-texel.x, 0.0));
    vec4 n5 = texture2D(tSource, vUv + vec2(texel.x, 0.0));
    vec4 n6 = texture2D(tSource, vUv + vec2(-texel.x, -texel.y));
    vec4 n7 = texture2D(tSource, vUv + vec2(0.0, -texel.y));
    vec4 n8 = texture2D(tSource, vUv + vec2(texel.x, -texel.y));
    
    // Growth Probability
    float chance = 0.0;
    vec4 grower = vec4(0.0);
    
    if(n1.a > 0.5) { chance += 1.0; grower = n1; }
    if(n2.a > 0.5) { chance += 1.0; grower = n2; }
    if(n3.a > 0.5) { chance += 1.0; grower = n3; }
    if(n4.a > 0.5) { chance += 1.0; grower = n4; }
    if(n5.a > 0.5) { chance += 1.0; grower = n5; }
    if(n6.a > 0.5) { chance += 1.0; grower = n6; }
    if(n7.a > 0.5) { chance += 1.0; grower = n7; }
    if(n8.a > 0.5) { chance += 1.0; grower = n8; }
    
    float rnd = hash(vUv * 100.0 + time);
    
    // If enough neighbors, spawn
    if (chance > 0.0 && rnd > 0.95) {
        gl_FragColor = grower;
    } else {
        gl_FragColor = self; // Empty
    }
  }
`;

export class PaintLayer {
    id: string;
    name: string;
    channels: { [key: string]: THREE.WebGLRenderTarget[] }; // Ping-Pong Buffers
    
    // Fluid Physics Buffers (Half-Res for performance)
    fluid: {
        velocity: THREE.WebGLRenderTarget[];
        pressure: THREE.WebGLRenderTarget[];
        divergence: THREE.WebGLRenderTarget;
    };

    visible: boolean;
    opacity: number;
    
    constructor(id: string, name: string, width: number, height: number) {
        this.id = id;
        this.name = name;
        this.visible = true;
        this.opacity = 1.0;
        
        const options = {
            minFilter: THREE.LinearFilter,
            magFilter: THREE.LinearFilter,
            type: THREE.HalfFloatType,
            format: THREE.RGBAFormat,
            depthBuffer: false,
            stencilBuffer: false,
            premultiplyAlpha: false 
        };

        this.channels = {
            albedo: [new THREE.WebGLRenderTarget(width, height, options), new THREE.WebGLRenderTarget(width, height, options)],
            normal: [new THREE.WebGLRenderTarget(width, height, options), new THREE.WebGLRenderTarget(width, height, options)],
            roughness: [new THREE.WebGLRenderTarget(width, height, options), new THREE.WebGLRenderTarget(width, height, options)],
            metalness: [new THREE.WebGLRenderTarget(width, height, options), new THREE.WebGLRenderTarget(width, height, options)],
            emission: [new THREE.WebGLRenderTarget(width, height, options), new THREE.WebGLRenderTarget(width, height, options)]
        };

        // Initialize Fluid Buffers
        const fOpt = { type: THREE.HalfFloatType, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, format: THREE.RGBAFormat };
        this.fluid = {
            velocity: [new THREE.WebGLRenderTarget(FLUID_SIZE, FLUID_SIZE, fOpt), new THREE.WebGLRenderTarget(FLUID_SIZE, FLUID_SIZE, fOpt)],
            pressure: [new THREE.WebGLRenderTarget(FLUID_SIZE, FLUID_SIZE, fOpt), new THREE.WebGLRenderTarget(FLUID_SIZE, FLUID_SIZE, fOpt)],
            divergence: new THREE.WebGLRenderTarget(FLUID_SIZE, FLUID_SIZE, fOpt)
        };
    }

    getRead(channel: string) { return this.channels[channel][0]; }
    getWrite(channel: string) { return this.channels[channel][1]; }
    swap(channel: string) { 
        const temp = this.channels[channel][0]; 
        this.channels[channel][0] = this.channels[channel][1]; 
        this.channels[channel][1] = temp; 
    }
    
    dispose() {
        Object.values(this.channels).forEach(pair => pair.forEach(rt => rt.dispose()));
        this.fluid.velocity.forEach(rt => rt.dispose());
        this.fluid.pressure.forEach(rt => rt.dispose());
        this.fluid.divergence.dispose();
    }
}

export class PaintEngine {
    renderer: THREE.WebGLRenderer;
    paintScene: THREE.Scene;
    paintCamera: THREE.OrthographicCamera;
    
    brushMesh: THREE.Mesh;
    brushMaterial: THREE.ShaderMaterial;
    
    copyScene: THREE.Scene;
    copyCamera: THREE.OrthographicCamera;
    copyMesh: THREE.Mesh;
    copyMaterial: THREE.ShaderMaterial;
    
    fillMaterial: THREE.ShaderMaterial;

    // Simulation Materials
    simMaterials: {
        advect: THREE.ShaderMaterial;
        div: THREE.ShaderMaterial;
        press: THREE.ShaderMaterial;
        grad: THREE.ShaderMaterial;
        splat: THREE.ShaderMaterial;
        reaction: THREE.ShaderMaterial;
        vortex: THREE.ShaderMaterial;
        gravity: THREE.ShaderMaterial;
        rivulet: THREE.ShaderMaterial;
        growth: THREE.ShaderMaterial;
    };

    clock: THREE.Clock;

    constructor(renderer: THREE.WebGLRenderer) {
        this.renderer = renderer;
        this.clock = new THREE.Clock();
        
        this.paintScene = new THREE.Scene();
        this.paintCamera = new THREE.OrthographicCamera(0, 1, 1, 0, 0, 10);
        this.paintCamera.position.z = 1;

        this.brushMaterial = new THREE.ShaderMaterial({
            uniforms: {
                uColor: { value: new THREE.Color(1, 1, 1) }, 
                uOpacity: { value: 1.0 },
                uHardness: { value: 0.5 },
                uAngle: { value: 0.0 },
                uBrushAlpha: { value: null },
                uUseBrushAlpha: { value: false },
                uSrcTex: { value: null },
                uUseSrcTex: { value: false },
                uTexScale: { value: 3.0 }
            },
            vertexShader: BRUSH_VERT,
            fragmentShader: BRUSH_FRAG,
            transparent: true,
            blending: THREE.NormalBlending,
            depthTest: false,
            depthWrite: false
        });
        
        this.brushMesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), this.brushMaterial);
        this.brushMesh.visible = false;
        this.paintScene.add(this.brushMesh);

        this.copyScene = new THREE.Scene();
        this.copyCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
        
        this.copyMaterial = new THREE.ShaderMaterial({
            uniforms: {
                tDiffuse: { value: null },
                uOpacity: { value: 1.0 }
            },
            vertexShader: COPY_VERT,
            fragmentShader: COPY_FRAG,
            transparent: true,
            blending: THREE.NormalBlending,
            depthTest: false,
            depthWrite: false
        });
        
        this.copyMesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.copyMaterial);
        this.copyScene.add(this.copyMesh);

        this.fillMaterial = new THREE.ShaderMaterial({
            uniforms: {
                tSource: { value: null },
                uUseTexture: { value: false },
                uColor: { value: new THREE.Color(0,0,0) },
                uAlpha: { value: 1.0 }
            },
            vertexShader: COPY_VERT,
            fragmentShader: FILL_FRAG,
            depthTest: false,
            depthWrite: false,
            blending: THREE.NoBlending 
        });

        // Initialize Fluid Sim Materials
        this.simMaterials = {
            // Updated dissipation to 0.998 for more "viscous" liquid feel
            advect: new THREE.ShaderMaterial({ uniforms: { velocityTex: {value:null}, sourceTex: {value:null}, dt: {value:0.016}, dissipation: {value:0.998} }, vertexShader: SIM_VERT, fragmentShader: FLUID_ADVECT }),
            div: new THREE.ShaderMaterial({ uniforms: { velocityTex: {value:null} }, vertexShader: SIM_VERT, fragmentShader: FLUID_DIV }),
            press: new THREE.ShaderMaterial({ uniforms: { pressureTex: {value:null}, divergenceTex: {value:null} }, vertexShader: SIM_VERT, fragmentShader: FLUID_PRESS }),
            grad: new THREE.ShaderMaterial({ uniforms: { pressureTex: {value:null}, velocityTex: {value:null} }, vertexShader: SIM_VERT, fragmentShader: FLUID_GRAD }),
            splat: new THREE.ShaderMaterial({ uniforms: { targetTex: {value:null}, point: {value: new THREE.Vector2()}, color: {value: new THREE.Vector3()}, radius: {value: 0.001} }, vertexShader: SIM_VERT, fragmentShader: FLUID_SPLAT }),
            reaction: new THREE.ShaderMaterial({ uniforms: { tSource: {value:null}, resolution: {value: new THREE.Vector2(TEXTURE_SIZE, TEXTURE_SIZE)} }, vertexShader: SIM_VERT, fragmentShader: REACTION_FRAG }),
            vortex: new THREE.ShaderMaterial({ uniforms: { tSource: {value:null}, time: {value: 0}, resolution: {value: new THREE.Vector2(TEXTURE_SIZE, TEXTURE_SIZE)} }, vertexShader: SIM_VERT, fragmentShader: VORTEX_FRAG }),
            gravity: new THREE.ShaderMaterial({ uniforms: { tSource: {value:null}, time: {value: 0}, resolution: {value: new THREE.Vector2(TEXTURE_SIZE, TEXTURE_SIZE)} }, vertexShader: SIM_VERT, fragmentShader: GRAVITY_FRAG }),
            rivulet: new THREE.ShaderMaterial({ uniforms: { tSource: {value:null}, time: {value: 0}, resolution: {value: new THREE.Vector2(TEXTURE_SIZE, TEXTURE_SIZE)} }, vertexShader: SIM_VERT, fragmentShader: RIVULET_FRAG }),
            growth: new THREE.ShaderMaterial({ uniforms: { tSource: {value:null}, time: {value: 0}, resolution: {value: new THREE.Vector2(TEXTURE_SIZE, TEXTURE_SIZE)} }, vertexShader: SIM_VERT, fragmentShader: GROWTH_FRAG }),
        };
    }

    clearLayer(layer: PaintLayer) {
        this.fillLayer(layer, { albedo: [0,0,0,0], normal: [0.5,0.5,1,0], roughness: [0.5,0,0,0], metalness: [0,0,0,0], emission: [0,0,0,0] });
        const clearFluid = (rt: THREE.WebGLRenderTarget) => {
            this.renderer.setRenderTarget(rt);
            this.renderer.clear();
        };
        layer.fluid.velocity.forEach(clearFluid);
        layer.fluid.pressure.forEach(clearFluid);
        clearFluid(layer.fluid.divergence);
    }

    fillLayer(layer: PaintLayer, defaults = { albedo: [0.5,0.5,0.5,0], normal: [0.5,0.5,1,0], roughness: [0.5,0,0,0], metalness: [0,0,0,0], emission: [0,0,0,0] }) {
        const fill = (r, g, b, a, channel) => {
            this.fillMaterial.uniforms.uUseTexture.value = false;
            this.fillMaterial.uniforms.uColor.value.setRGB(r, g, b);
            this.fillMaterial.uniforms.uAlpha.value = a;
            this.copyMesh.material = this.fillMaterial;
            this.renderer.setRenderTarget(layer.getRead(channel));
            this.renderer.render(this.copyScene, this.copyCamera);
            this.renderer.setRenderTarget(layer.getWrite(channel));
            this.renderer.render(this.copyScene, this.copyCamera);
        };
        fill(defaults.albedo[0], defaults.albedo[1], defaults.albedo[2], defaults.albedo[3], 'albedo');
        fill(defaults.normal[0], defaults.normal[1], defaults.normal[2], defaults.normal[3], 'normal');
        fill(defaults.roughness[0], defaults.roughness[1], defaults.roughness[2], defaults.roughness[3], 'roughness');
        fill(defaults.metalness[0], defaults.metalness[1], defaults.metalness[2], defaults.metalness[3], 'metalness');
        fill(defaults.emission[0], defaults.emission[1], defaults.emission[2], defaults.emission[3], 'emission');
        this.renderer.setRenderTarget(null);
    }

    fillLayerWithTextures(layer: PaintLayer, materialTextures: any, color: string) {
        const fillChannel = (channel: string, tex: THREE.Texture | null, solidColor: THREE.Color) => {
            const target = layer.getRead(channel);
            this.renderer.setRenderTarget(target);
            if (tex) {
                this.fillMaterial.uniforms.uUseTexture.value = true;
                this.fillMaterial.uniforms.tSource.value = tex;
            } else {
                this.fillMaterial.uniforms.uUseTexture.value = false;
                this.fillMaterial.uniforms.uColor.value = solidColor;
                this.fillMaterial.uniforms.uAlpha.value = 1.0; 
            }
            this.copyMesh.material = this.fillMaterial;
            this.renderer.render(this.copyScene, this.copyCamera);
            this.copyTo(target, layer.getWrite(channel));
        };
        const c = new THREE.Color(color);
        fillChannel('albedo', materialTextures?.albedo, c);
        fillChannel('normal', materialTextures?.normal, new THREE.Color(0.5, 0.5, 1.0));
        fillChannel('roughness', materialTextures?.roughness, new THREE.Color(0.5, 0.5, 0.5));
        fillChannel('metalness', materialTextures?.metalness, new THREE.Color(0, 0, 0));
        fillChannel('emission', materialTextures?.emission, new THREE.Color(0, 0, 0));
        this.renderer.setRenderTarget(null);
    }

    // --- FLUID SIMULATION STEPS ---
    splatVelocity(layer: PaintLayer, uv: THREE.Vector2, motion: THREE.Vector2, size: number) {
        const mats = this.simMaterials;
        const velRead = layer.fluid.velocity[0];
        const velWrite = layer.fluid.velocity[1];
        this.renderer.setRenderTarget(velWrite);
        this.copyMesh.material = mats.splat;
        mats.splat.uniforms.targetTex.value = velRead.texture;
        mats.splat.uniforms.point.value.copy(uv);
        mats.splat.uniforms.color.value.set(motion.x, motion.y, 0);
        mats.splat.uniforms.radius.value = size * 0.0005;
        this.renderer.render(this.copyScene, this.copyCamera);
        const temp = layer.fluid.velocity[0];
        layer.fluid.velocity[0] = layer.fluid.velocity[1];
        layer.fluid.velocity[1] = temp;
    }

    stepFluid(layer: PaintLayer) {
        const mats = this.simMaterials;
        // 1. Advect
        this.copyMesh.material = mats.advect;
        mats.advect.uniforms.velocityTex.value = layer.fluid.velocity[0].texture;
        mats.advect.uniforms.sourceTex.value = layer.fluid.velocity[0].texture;
        // Keep velocity high for longer to simulate thick liquid
        mats.advect.uniforms.dissipation.value = 0.99; 
        this.renderer.setRenderTarget(layer.fluid.velocity[1]);
        this.renderer.render(this.copyScene, this.copyCamera);
        let temp = layer.fluid.velocity[0]; layer.fluid.velocity[0] = layer.fluid.velocity[1]; layer.fluid.velocity[1] = temp;

        // 2. Divergence
        this.copyMesh.material = mats.div;
        mats.div.uniforms.velocityTex.value = layer.fluid.velocity[0].texture;
        this.renderer.setRenderTarget(layer.fluid.divergence);
        this.renderer.render(this.copyScene, this.copyCamera);

        // 3. Pressure
        this.copyMesh.material = mats.press;
        mats.press.uniforms.divergenceTex.value = layer.fluid.divergence.texture;
        for (let i = 0; i < 10; i++) {
            mats.press.uniforms.pressureTex.value = layer.fluid.pressure[0].texture;
            this.renderer.setRenderTarget(layer.fluid.pressure[1]);
            this.renderer.render(this.copyScene, this.copyCamera);
            temp = layer.fluid.pressure[0]; layer.fluid.pressure[0] = layer.fluid.pressure[1]; layer.fluid.pressure[1] = temp;
        }

        // 4. Gradient
        this.copyMesh.material = mats.grad;
        mats.grad.uniforms.pressureTex.value = layer.fluid.pressure[0].texture;
        mats.grad.uniforms.velocityTex.value = layer.fluid.velocity[0].texture;
        this.renderer.setRenderTarget(layer.fluid.velocity[1]);
        this.renderer.render(this.copyScene, this.copyCamera);
        temp = layer.fluid.velocity[0]; layer.fluid.velocity[0] = layer.fluid.velocity[1]; layer.fluid.velocity[1] = temp;

        // 5. Advect Albedo
        this.copyMesh.material = mats.advect;
        mats.advect.uniforms.velocityTex.value = layer.fluid.velocity[0].texture;
        mats.advect.uniforms.sourceTex.value = layer.getRead('albedo').texture;
        // Very low dissipation for paint color to linger
        mats.advect.uniforms.dissipation.value = 0.999; 
        this.renderer.setRenderTarget(layer.getWrite('albedo'));
        this.renderer.render(this.copyScene, this.copyCamera);
        layer.swap('albedo');
        this.renderer.setRenderTarget(null);
    }

    stepReaction(layer: PaintLayer) {
        const mat = this.simMaterials.reaction;
        const target = layer.getWrite('albedo');
        this.renderer.setRenderTarget(target);
        this.copyMesh.material = mat;
        mat.uniforms.tSource.value = layer.getRead('albedo').texture;
        this.renderer.render(this.copyScene, this.copyCamera);
        layer.swap('albedo');
        this.renderer.setRenderTarget(null);
    }

    stepVortex(layer: PaintLayer) {
        const mat = this.simMaterials.vortex;
        const target = layer.getWrite('albedo');
        this.renderer.setRenderTarget(target);
        this.copyMesh.material = mat;
        mat.uniforms.tSource.value = layer.getRead('albedo').texture;
        mat.uniforms.time.value = this.clock.getElapsedTime();
        this.renderer.render(this.copyScene, this.copyCamera);
        layer.swap('albedo');
        this.renderer.setRenderTarget(null);
    }

    stepGravity(layer: PaintLayer) {
        const mat = this.simMaterials.gravity;
        const target = layer.getWrite('albedo');
        this.renderer.setRenderTarget(target);
        this.copyMesh.material = mat;
        mat.uniforms.tSource.value = layer.getRead('albedo').texture;
        mat.uniforms.time.value = this.clock.getElapsedTime();
        this.renderer.render(this.copyScene, this.copyCamera);
        layer.swap('albedo');
        this.renderer.setRenderTarget(null);
    }

    stepRivulet(layer: PaintLayer) {
        const mat = this.simMaterials.rivulet;
        const target = layer.getWrite('albedo');
        this.renderer.setRenderTarget(target);
        this.copyMesh.material = mat;
        mat.uniforms.tSource.value = layer.getRead('albedo').texture;
        mat.uniforms.time.value = this.clock.getElapsedTime();
        this.renderer.render(this.copyScene, this.copyCamera);
        layer.swap('albedo');
        this.renderer.setRenderTarget(null);
    }

    stepGrowth(layer: PaintLayer) {
        const mat = this.simMaterials.growth;
        const target = layer.getWrite('albedo');
        this.renderer.setRenderTarget(target);
        this.copyMesh.material = mat;
        mat.uniforms.tSource.value = layer.getRead('albedo').texture;
        mat.uniforms.time.value = this.clock.getElapsedTime();
        this.renderer.render(this.copyScene, this.copyCamera);
        layer.swap('albedo');
        this.renderer.setRenderTarget(null);
    }

    paint(uv: THREE.Vector2, brushParams: any, layer: PaintLayer, activeChannels: any, targetMesh: THREE.Mesh, materialTextures: any = null) {
        if (!layer) return;
        this.brushMesh.visible = true;
        const brushSizeUV = brushParams.size / TEXTURE_SIZE;
        this.brushMesh.scale.set(brushSizeUV, brushSizeUV, 1);
        this.brushMesh.position.set(uv.x, uv.y, 0);
        
        if (brushParams.alphaMap) {
            this.brushMaterial.uniforms.uUseBrushAlpha.value = true;
            this.brushMaterial.uniforms.uBrushAlpha.value = brushParams.alphaMap;
        } else {
            this.brushMaterial.uniforms.uUseBrushAlpha.value = false;
            this.brushMaterial.uniforms.uBrushAlpha.value = null;
        }

        this.brushMaterial.uniforms.uOpacity.value = brushParams.flow * 0.5;
        this.brushMaterial.uniforms.uHardness.value = brushParams.hardness;
        this.brushMaterial.uniforms.uAngle.value = Math.random() * 0.1; 
        this.brushMaterial.uniforms.uTexScale.value = 5.0;

        const oldAutoClear = this.renderer.autoClear;
        this.renderer.autoClear = false;

        const renderChannel = (channel: string, solidColor: THREE.Color, srcTex: THREE.Texture | null) => {
            if (!activeChannels[channel]) return;
            const writeTarget = layer.getWrite(channel);
            const readTarget = layer.getRead(channel);
            this.renderer.setRenderTarget(writeTarget);
            
            this.copyMaterial.uniforms.tDiffuse.value = readTarget.texture;
            this.copyMaterial.uniforms.uOpacity.value = 1.0;
            this.copyMaterial.blending = THREE.NoBlending; 
            this.copyMesh.material = this.copyMaterial;
            this.renderer.render(this.copyScene, this.copyCamera);

            if (srcTex) {
                this.brushMaterial.uniforms.uColor.value.setHex(0xffffff);
                this.brushMaterial.uniforms.uSrcTex.value = srcTex;
                this.brushMaterial.uniforms.uUseSrcTex.value = true;
                if (srcTex.wrapS !== THREE.RepeatWrapping) {
                    srcTex.wrapS = THREE.RepeatWrapping; srcTex.wrapT = THREE.RepeatWrapping; srcTex.needsUpdate = true;
                }
            } else {
                this.brushMaterial.uniforms.uColor.value.copy(solidColor);
                this.brushMaterial.uniforms.uUseSrcTex.value = false;
                this.brushMaterial.uniforms.uSrcTex.value = null;
            }
            this.brushMaterial.blending = THREE.NormalBlending; 
            this.renderer.render(this.paintScene, this.paintCamera);
            layer.swap(channel);
        };

        const c = new THREE.Color(brushParams.color);
        renderChannel('albedo', c, materialTextures?.albedo);
        const r = brushParams.roughness;
        renderChannel('roughness', new THREE.Color(r,r,r), materialTextures?.roughness);
        const m = brushParams.metalness;
        renderChannel('metalness', new THREE.Color(m,m,m), materialTextures?.metalness);
        renderChannel('normal', new THREE.Color(0.5, 0.5, 1.0), materialTextures?.normal);
        const eVal = brushParams.emission;
        renderChannel('emission', c.clone().multiplyScalar(eVal), materialTextures?.emission);

        this.brushMesh.visible = false;
        this.renderer.setRenderTarget(null);
        this.renderer.autoClear = oldAutoClear;
    }

    compose(layers: PaintLayer[], dest: PaintLayer) {
        const channels = ['albedo', 'normal', 'roughness', 'metalness', 'emission'];
        const oldClearColor = new THREE.Color();
        this.renderer.getClearColor(oldClearColor);
        const oldClearAlpha = this.renderer.getClearAlpha();
        const oldAutoClear = this.renderer.autoClear;
        this.renderer.autoClear = false;

        channels.forEach(ch => {
            const target = dest.getWrite(ch);
            this.renderer.setRenderTarget(target);
            this.renderer.setClearColor(new THREE.Color(0,0,0), 0);
            this.renderer.clear();
            
            layers.forEach((layer) => {
                if(!layer.visible || layer.opacity <= 0.001) return;
                this.copyMaterial.uniforms.tDiffuse.value = layer.getRead(ch).texture;
                this.copyMaterial.uniforms.uOpacity.value = layer.opacity;
                this.copyMaterial.blending = THREE.NormalBlending;
                this.copyMesh.material = this.copyMaterial;
                this.renderer.render(this.copyScene, this.copyCamera);
            });
            dest.swap(ch);
        });

        this.renderer.setRenderTarget(null);
        this.renderer.setClearColor(oldClearColor, oldClearAlpha);
        this.renderer.autoClear = oldAutoClear;
    }

    copyTo(sourceTarget: THREE.WebGLRenderTarget, destTarget: THREE.WebGLRenderTarget) {
        this.renderer.setRenderTarget(destTarget);
        this.copyMaterial.uniforms.tDiffuse.value = sourceTarget.texture;
        this.copyMaterial.uniforms.uOpacity.value = 1.0;
        this.copyMaterial.blending = THREE.NoBlending;
        this.copyMesh.material = this.copyMaterial;
        this.renderer.render(this.copyScene, this.copyCamera);
        this.renderer.setRenderTarget(null);
    }

    snapshotLayer(layer: PaintLayer): { [key: string]: THREE.WebGLRenderTarget } {
        const snapshot: any = {};
        const channels = ['albedo', 'normal', 'roughness', 'metalness', 'emission'];
        const options = { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, type: THREE.HalfFloatType, format: THREE.RGBAFormat, depthBuffer: false, stencilBuffer: false, premultiplyAlpha: false };
        channels.forEach(ch => {
            const target = new THREE.WebGLRenderTarget(layer.getRead(ch).width, layer.getRead(ch).height, options);
            this.copyTo(layer.getRead(ch), target);
            snapshot[ch] = target;
        });
        return snapshot;
    }

    restoreLayer(layer: PaintLayer, snapshot: { [key: string]: THREE.WebGLRenderTarget }) {
        Object.keys(snapshot).forEach(ch => {
            const histTarget = snapshot[ch];
            this.copyTo(histTarget, layer.getRead(ch));
            this.copyTo(histTarget, layer.getWrite(ch));
        });
    }

    disposeSnapshot(snapshot: { [key: string]: THREE.WebGLRenderTarget }) {
        Object.values(snapshot).forEach(rt => rt.dispose());
    }

    dispose() {
        this.brushMesh.geometry.dispose();
        this.brushMaterial.dispose();
        this.copyMesh.geometry.dispose();
        this.copyMaterial.dispose();
        this.fillMaterial.dispose();
        Object.values(this.simMaterials).forEach(m => m.dispose());
    }
}
