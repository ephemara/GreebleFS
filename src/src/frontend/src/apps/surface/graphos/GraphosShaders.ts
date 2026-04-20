
export const QUAD_VERT = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position, 1.0);
  }
`;

export const GEN_NOISE_FRAG = `
  uniform float uScale;
  uniform float uDetail;
  uniform float uSeed;
  uniform vec3 uColorA;
  uniform vec3 uColorB;
  varying vec2 vUv;

  vec3 permute(vec3 x) { return mod(((x*34.0)+1.0)*x, 289.0); }
  float snoise(vec2 v){
    const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
    vec2 i  = floor(v + dot(v, C.yy) );
    vec2 x0 = v - i + dot(i, C.xx);
    vec2 i1;
    i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
    vec4 x12 = x0.xyxy + C.xxzz;
    x12.xy -= i1;
    i = mod(i, 289.0);
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
      float n = 0.0;
      float amp = 1.0;
      float freq = uScale;
      float maxAmp = 0.0;
      
      for(int i=0; i<4; i++) {
          if (float(i) >= uDetail) break;
          n += snoise(vUv * freq + uSeed) * amp;
          maxAmp += amp;
          amp *= 0.5;
          freq *= 2.0;
      }
      
      n = (n / maxAmp) * 0.5 + 0.5;
      vec3 col = mix(uColorA, uColorB, n);
      gl_FragColor = vec4(col, 1.0);
  }
`;

export const GEN_FBM_FRAG = `
  uniform float uScale;
  uniform float uSeed;
  uniform vec3 uColorA;
  uniform vec3 uColorB;
  uniform float uTime;
  varying vec2 vUv;

  float random (in vec2 st) { return fract(sin(dot(st.xy, vec2(12.9898,78.233)))*43758.5453123); }
  float noise (in vec2 st) {
      vec2 i = floor(st); vec2 f = fract(st);
      float a = random(i); float b = random(i + vec2(1.0, 0.0));
      float c = random(i + vec2(0.0, 1.0)); float d = random(i + vec2(1.0, 1.0));
      vec2 u = f * f * (3.0 - 2.0 * f);
      return mix(a, b, u.x) + (c - a)* u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
  }
  #define OCTAVES 6
  float fbm (in vec2 st) {
      float value = 0.0; float amplitude = .5;
      for (int i = 0; i < OCTAVES; i++) { value += amplitude * noise(st); st *= 2.; amplitude *= .5; }
      return value;
  }
  void main() {
      vec2 st = vUv * uScale;
      vec2 q = vec2(0.); q.x = fbm( st + 0.00*uTime); q.y = fbm( st + vec2(1.0));
      vec2 r = vec2(0.); r.x = fbm( st + 1.0*q + vec2(1.7,9.2)+ 0.15*uTime ); r.y = fbm( st + 1.0*q + vec2(8.3,2.8)+ 0.126*uTime);
      float f = fbm(st+r);
      vec3 color = mix(uColorA, uColorB, clamp((f*f)*4.0, 0.0, 1.0));
      gl_FragColor = vec4(color, 1.0);
  }
`;

export const GEN_PATTERN_FRAG = `
  uniform float uScale;
  uniform int uMode; 
  uniform vec3 uColorA;
  uniform vec3 uColorB;
  varying vec2 vUv;
  float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
  void main() {
      vec2 st = vUv * uScale; float mask = 0.0;
      if (uMode == 0) { vec2 f = fract(st); if (f.x < 0.05 || f.y < 0.05) mask = 1.0; } 
      else if (uMode == 1) { vec2 f = floor(st); mask = mod(f.x + f.y, 2.0); } 
      else if (uMode == 2) { vec2 f = fract(st) - 0.5; if (length(f) < 0.25) mask = 1.0; } 
      else if (uMode == 3) { vec2 ipos = floor(st); vec2 fpos = fract(st); float rnd = hash(ipos); if (rnd > 0.5) fpos.x = 1.0 - fpos.x; float d = abs(fpos.x - fpos.y); if (d < 0.1) mask = 1.0; if (length(fpos - 0.5) < 0.1 && rnd > 0.8) mask = 1.0; }
      gl_FragColor = vec4(mix(uColorA, uColorB, mask), 1.0);
  }
`;

export const GEN_VORONOI_FRAG = `
  uniform float uScale; uniform float uSeed; uniform vec3 uColorA; uniform vec3 uColorB; varying vec2 vUv;
  vec2 random2( vec2 p ) { return fract(sin(vec2(dot(p,vec2(127.1,311.7)),dot(p,vec2(269.5,183.3))))*43758.5453); }
  void main() {
      vec2 st = vUv * uScale; vec2 i_st = floor(st); vec2 f_st = fract(st); float m_dist = 1.0;
      for (int y= -1; y <= 1; y++) { for (int x= -1; x <= 1; x++) { vec2 neighbor = vec2(float(x),float(y)); vec2 point = random2(i_st + neighbor + uSeed); point = 0.5 + 0.5*sin(uSeed + 6.2831*point); vec2 diff = neighbor + point - f_st; float dist = length(diff); m_dist = min(m_dist, dist); } }
      gl_FragColor = vec4(mix(uColorA, uColorB, m_dist), 1.0);
  }
`;

export const FILTER_BLUR_FRAG = `
  uniform sampler2D tInput; uniform vec2 uResolution; uniform float uStrength; uniform vec2 uDirection; varying vec2 vUv;
  void main() {
      vec4 sum = vec4(0.0); vec2 off = uDirection * uStrength / uResolution;
      sum += texture2D(tInput, vUv - 4.0 * off) * 0.0162; sum += texture2D(tInput, vUv - 3.0 * off) * 0.0540; sum += texture2D(tInput, vUv - 2.0 * off) * 0.1216; sum += texture2D(tInput, vUv - 1.0 * off) * 0.1945;
      sum += texture2D(tInput, vUv) * 0.2270;
      sum += texture2D(tInput, vUv + 1.0 * off) * 0.1945; sum += texture2D(tInput, vUv + 2.0 * off) * 0.1216; sum += texture2D(tInput, vUv + 3.0 * off) * 0.0540; sum += texture2D(tInput, vUv + 4.0 * off) * 0.0162;
      gl_FragColor = sum;
  }
`;

export const FILTER_NORMAL_FRAG = `
  uniform sampler2D tInput; uniform float uStrength; uniform vec2 uResolution; varying vec2 vUv;
  float getVal(vec2 uv) { return length(texture2D(tInput, uv).rgb); }
  void main() {
      vec2 step = 1.0 / uResolution;
      float tl = abs(getVal(vUv + vec2(-step.x, -step.y))); float l = abs(getVal(vUv + vec2(-step.x, 0.0))); float bl = abs(getVal(vUv + vec2(-step.x, step.y)));
      float t = abs(getVal(vUv + vec2(0.0, -step.y))); float b = abs(getVal(vUv + vec2(0.0, step.y)));
      float tr = abs(getVal(vUv + vec2(step.x, -step.y))); float r = abs(getVal(vUv + vec2(step.x, 0.0))); float br = abs(getVal(vUv + vec2(step.x, step.y)));
      float dX = (tr + 2.0*r + br) - (tl + 2.0*l + bl); float dY = (bl + 2.0*b + br) - (tl + 2.0*t + tr); float dZ = 1.0 / uStrength;
      vec3 n = normalize(vec3(dX, dY, dZ)); gl_FragColor = vec4(n * 0.5 + 0.5, 1.0);
  }
`;

export const FILTER_LEVELS_FRAG = `
  uniform sampler2D tInput; uniform float uMin; uniform float uMax; uniform float uGamma; uniform bool uInvert; varying vec2 vUv;
  void main() {
      vec4 tex = texture2D(tInput, vUv); vec3 col = tex.rgb;
      col = (col - uMin) / (uMax - uMin); col = clamp(col, 0.0, 1.0); col = pow(col, vec3(1.0 / uGamma));
      if (uInvert) col = 1.0 - col; gl_FragColor = vec4(col, tex.a);
  }
`;

export const FILTER_PIXEL_SORT_FRAG = `
  uniform sampler2D tInput; uniform vec2 uResolution; uniform float uThreshold; varying vec2 vUv;
  void main() {
      vec2 texel = 1.0 / uResolution; vec4 color = texture2D(tInput, vUv); float luma = dot(color.rgb, vec3(0.299, 0.587, 0.114));
      if (luma > uThreshold) { vec4 neighbor = texture2D(tInput, vUv + vec2(0.0, -texel.y * 20.0)); gl_FragColor = mix(color, neighbor, 0.5); } else { gl_FragColor = color; }
  }
`;

export const FILTER_EDGE_FRAG = `
  uniform sampler2D tInput; uniform vec2 uResolution; varying vec2 vUv;
  void main() {
      vec2 texel = 1.0 / uResolution; float gx = 0.0; float gy = 0.0; vec3 t = texture2D(tInput, vUv).rgb;
      gx += -1.0 * length(texture2D(tInput, vUv + vec2(-texel.x, -texel.y)).rgb); gx += -2.0 * length(texture2D(tInput, vUv + vec2(-texel.x, 0.0)).rgb); gx += -1.0 * length(texture2D(tInput, vUv + vec2(-texel.x, texel.y)).rgb);
      gx += 1.0 * length(texture2D(tInput, vUv + vec2(texel.x, -texel.y)).rgb); gx += 2.0 * length(texture2D(tInput, vUv + vec2(texel.x, 0.0)).rgb); gx += 1.0 * length(texture2D(tInput, vUv + vec2(texel.x, texel.y)).rgb);
      gy += -1.0 * length(texture2D(tInput, vUv + vec2(-texel.x, -texel.y)).rgb); gy += -2.0 * length(texture2D(tInput, vUv + vec2(0.0, -texel.y)).rgb); gy += -1.0 * length(texture2D(tInput, vUv + vec2(texel.x, -texel.y)).rgb);
      gy += 1.0 * length(texture2D(tInput, vUv + vec2(-texel.x, texel.y)).rgb); gy += 2.0 * length(texture2D(tInput, vUv + vec2(0.0, texel.y)).rgb); gy += 1.0 * length(texture2D(tInput, vUv + vec2(texel.x, texel.y)).rgb);
      float edge = sqrt(gx*gx + gy*gy); gl_FragColor = vec4(mix(t, vec3(edge), 0.8), 1.0);
  }
`;

// --- SIMULATION KERNELS ---

export const SIM_DRIP_FRAG = `
  uniform sampler2D tInput; uniform vec2 uResolution; uniform float uSpeed; uniform float uThreshold; varying vec2 vUv;
  void main() {
      vec4 self = texture2D(tInput, vUv); vec2 texel = 1.0 / uResolution;
      vec4 above = texture2D(tInput, vUv + vec2(0.0, texel.y));
      float heavy = above.a; float jitter = sin(vUv.y * 50.0) * 0.0001;
      vec2 offset = vec2(jitter, uSpeed * heavy * 0.005);
      vec4 dripSource = texture2D(tInput, vUv + offset);
      vec4 result = mix(self, dripSource, 0.1); result.a = max(self.a, dripSource.a * 0.99); 
      gl_FragColor = result;
  }
`;

export const SIM_BLEED_FRAG = `
  uniform sampler2D tInput; uniform vec2 uResolution; uniform float uSpeed; varying vec2 vUv;
  void main() {
      vec2 texel = 1.0 / uResolution; vec4 c = texture2D(tInput, vUv);
      vec4 l = texture2D(tInput, vUv + vec2(-texel.x, 0.0)); vec4 r = texture2D(tInput, vUv + vec2(texel.x, 0.0));
      vec4 t = texture2D(tInput, vUv + vec2(0.0, texel.y)); vec4 b = texture2D(tInput, vUv + vec2(0.0, -texel.y));
      vec4 avg = (l + r + t + b) * 0.25; vec4 result = mix(c, avg, uSpeed * 0.1); result.a = max(c.a, avg.a * 0.9);
      gl_FragColor = result;
  }
`;

export const SIM_LIQUIFY_FRAG = `
  uniform sampler2D tInput; uniform sampler2D tVelocity; uniform float uSpeed; varying vec2 vUv;
  void main() {
      vec2 vel = texture2D(tVelocity, vUv).xy; vec2 coord = vUv - vel * uSpeed * 0.01;
      gl_FragColor = texture2D(tInput, coord);
  }
`;

export const SIM_WIND_FRAG = `
  uniform sampler2D tInput; uniform vec2 uResolution; uniform float uSpeed; uniform vec2 uWindDir; varying vec2 vUv;
  void main() {
      vec4 self = texture2D(tInput, vUv); vec2 offset = uWindDir * -0.002 * uSpeed;
      vec4 windSource = texture2D(tInput, vUv + offset);
      vec4 result = mix(self, windSource, 0.2 * uSpeed); result.a = max(self.a, windSource.a * 0.98);
      gl_FragColor = result;
  }
`;

export const SIM_MAGNETIC_FRAG = `
  uniform sampler2D tInput; uniform vec2 uResolution; uniform float uSpeed; varying vec2 vUv;
  void main() {
      vec2 texel = 1.0 / uResolution; vec4 self = texture2D(tInput, vUv);
      vec2 center = vec2(0.0); float mass = 0.0;
      for(int y=-2; y<=2; y++) { for(int x=-2; x<=2; x++) { if(x==0 && y==0) continue; vec2 off = vec2(float(x), float(y)) * texel; float val = texture2D(tInput, vUv + off).a; center += off * val; mass += val; } }
      if(mass > 0.0) { center /= mass; vec2 pull = center * uSpeed * 2.0; vec4 neighbor = texture2D(tInput, vUv + pull); gl_FragColor = mix(self, neighbor, 0.1); } else { gl_FragColor = self; }
  }
`;

export const SIM_DATAMOSH_FRAG = `
  uniform sampler2D tInput; uniform vec2 uResolution; uniform float uSpeed; varying vec2 vUv;
  float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
  void main() {
      vec4 self = texture2D(tInput, vUv); float bright = dot(self.rgb, vec3(0.299, 0.587, 0.114));
      float drift = (bright - 0.5) * 0.01 * uSpeed;
      if (hash(vUv * 100.0) > 0.99) drift += 0.05 * uSpeed;
      vec2 offset = vec2(drift, 0.0); gl_FragColor = texture2D(tInput, vUv - offset);
  }
`;

export const SIM_NEBULA_FRAG = `
  uniform sampler2D tInput; uniform float uTime; uniform float uSpeed; uniform float uChaos; uniform float uScale; varying vec2 vUv;
  vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec3 permute(vec3 x) { return mod289(((x*34.0)+1.0)*x); }
  float snoise(vec2 v){ const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439); vec2 i  = floor(v + dot(v, C.yy) ); vec2 x0 = v - i + dot(i, C.xx); vec2 i1; i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0); vec4 x12 = x0.xyxy + C.xxzz; x12.xy -= i1; i = mod(i, 289.0); vec3 p = permute( permute( i.y + vec3(0.0, i1.y, 1.0 )) + i.x + vec3(0.0, i1.x, 1.0 )); vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0); m = m*m ; m = m*m ; vec3 x = 2.0 * fract(p * C.www) - 1.0; vec3 h = abs(x) - 0.5; vec3 ox = floor(x + 0.5); vec3 a0 = x - ox; m *= 1.79284291400159 - 0.85373472095314 * ( a0*a0 + h*h ); vec3 g; g.x  = a0.x  * x0.x  + h.x  * x0.y; g.yz = a0.yz * x12.xz + h.yz * x12.yw; return 130.0 * dot(m, g); }
  void main() {
      vec4 c = texture2D(tInput, vUv);
      float n1 = snoise(vUv * uScale + uTime * 0.1);
      float n2 = snoise(vUv * uScale + vec2(100.0) + uTime * 0.1);
      vec2 offset = vec2(n1, n2) * 0.005 * uSpeed;
      vec4 source = texture2D(tInput, vUv - offset);
      gl_FragColor = mix(c, source, 0.5 + uChaos * 0.5);
  }
`;

export const SIM_THERMAL_FRAG = `
  uniform sampler2D tInput; uniform vec2 uResolution; uniform float uSpeed; uniform float uDecay; varying vec2 vUv;
  void main() {
      vec2 texel = 1.0 / uResolution;
      vec4 c = texture2D(tInput, vUv);
      // Heat rises (Y-axis)
      vec4 below = texture2D(tInput, vUv + vec2(0.0, -texel.y));
      // Brightness determines heat
      float heat = length(below.rgb) * uSpeed * 0.01;
      vec2 offset = vec2((fract(sin(dot(vUv, vec2(12.9, 78.2)))*43758.5)-0.5)*0.005, -heat);
      vec4 hotSource = texture2D(tInput, vUv + offset);
      // Diffusion
      vec4 avg = (texture2D(tInput, vUv+vec2(texel.x,0)) + texture2D(tInput, vUv-vec2(texel.x,0))) * 0.5;
      gl_FragColor = mix(c, mix(hotSource, avg, 0.2), 0.5) * uDecay;
  }
`;

export const SIM_SORT_FRAG = `
  uniform sampler2D tInput; uniform vec2 uResolution; uniform float uSpeed; uniform float uChaos; varying vec2 vUv;
  void main() {
      vec2 texel = 1.0 / uResolution;
      vec4 self = texture2D(tInput, vUv);
      float luma = dot(self.rgb, vec3(0.299, 0.587, 0.114));
      // Sort vertically or horizontally based on chaos
      vec2 dir = uChaos > 0.5 ? vec2(texel.x, 0.0) : vec2(0.0, texel.y);
      vec4 neighbor = texture2D(tInput, vUv + dir * uSpeed);
      float lumaN = dot(neighbor.rgb, vec3(0.299, 0.587, 0.114));
      // Swap if neighbor brighter
      if (lumaN > luma) gl_FragColor = neighbor;
      else gl_FragColor = self;
  }
`;

export const SIM_LIFE_FRAG = `
  uniform sampler2D tInput; uniform vec2 uResolution; uniform float uSpeed; uniform float uChaos; varying vec2 vUv;
  float get(vec2 offset) { vec4 c = texture2D(tInput, vUv + offset / uResolution); return step(0.5, max(c.r, max(c.g, c.b))); }
  void main() {
      float sum = get(vec2(-1,-1)) + get(vec2(0,-1)) + get(vec2(1,-1)) + get(vec2(-1,0)) + get(vec2(1,0)) + get(vec2(-1,1)) + get(vec2(0,1)) + get(vec2(1,1));
      float self = get(vec2(0,0));
      float next = 0.0;
      if (self > 0.5) { if (sum == 2.0 || sum == 3.0) next = 1.0; } else { if (sum == 3.0) next = 1.0; }
      // Soften / Decay
      vec4 color = texture2D(tInput, vUv);
      if (next > 0.5) color = vec4(1.0); else color *= 0.9 * uChaos;
      gl_FragColor = color;
  }
`;

// --- NEW SHADERS ---
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
    
    // Curl
    vec2 vel = vec2(n1, n2) * 0.005;
    
    vec2 coord = vUv - vel;
    gl_FragColor = texture2D(tSource, coord);
  }
`;

export const BLACK_HOLE_FRAG = `
  uniform sampler2D tVelocity; 
  uniform vec2 uCenter;        
  uniform float uStrength;     
  uniform float uSpin;         
  uniform float uRadius;       
  uniform float uDecay;        
  uniform float uDt;
  varying vec2 vUv;

  void main() {
    vec2 vel = texture2D(tVelocity, vUv).xy;
    vel *= uDecay;
    vec2 dir = uCenter - vUv;
    float dist = length(dir);
    float influence = 1.0 - smoothstep(uRadius * 0.8, uRadius, dist);
    if (influence > 0.001) {
        float effectiveDist = max(dist, 0.001);
        vec2 normDir = normalize(dir);
        float gravity = uStrength / (effectiveDist * 10.0 + 0.1);
        vec2 tangent = vec2(-normDir.y, normDir.x);
        float spin = uSpin / (effectiveDist * 5.0 + 0.1);
        vec2 force = (normDir * gravity) + (tangent * spin);
        vel += force * influence * uDt;
    }
    if (length(vel) > 5.0) vel = normalize(vel) * 5.0;
  gl_FragColor = vec4(vel, 0.0, 1.0);
  }
`;

// ========== NEW GENERATORS ==========

export const GEN_GRADIENT_FRAG = `
  uniform int uMode; // 0=linear, 1=radial, 2=angular
  uniform float uAngle;
  uniform vec3 uColorA;
  uniform vec3 uColorB;
  uniform vec2 uCenter;
  varying vec2 vUv;

  void main() {
    float t = 0.0;
    vec2 uv = vUv - uCenter;

    if (uMode == 0) {
      // Linear gradient
      float rad = uAngle * 3.14159 / 180.0;
      vec2 dir = vec2(cos(rad), sin(rad));
      t = dot(uv + 0.5, dir) + 0.5;
    } else if (uMode == 1) {
      // Radial gradient
      t = length(uv) * 2.0;
    } else if (uMode == 2) {
      // Angular gradient
      t = atan(uv.y, uv.x) / 6.28318 + 0.5;
    }

    t = clamp(t, 0.0, 1.0);
    vec3 color = mix(uColorA, uColorB, t);
    gl_FragColor = vec4(color, 1.0);
  }
`;

export const GEN_SEAMLESS_FRAG = `
  uniform sampler2D tInput;
  uniform float uBlend;
  varying vec2 vUv;

  void main() {
    vec4 c1 = texture2D(tInput, vUv);
    vec4 c2 = texture2D(tInput, vec2(1.0 - vUv.x, vUv.y));
    vec4 c3 = texture2D(tInput, vec2(vUv.x, 1.0 - vUv.y));
    vec4 c4 = texture2D(tInput, vec2(1.0 - vUv.x, 1.0 - vUv.y));

    // Diamond blend weights
    float bx = smoothstep(0.0, uBlend, vUv.x) * smoothstep(0.0, uBlend, 1.0 - vUv.x);
    float by = smoothstep(0.0, uBlend, vUv.y) * smoothstep(0.0, uBlend, 1.0 - vUv.y);

    vec4 top = mix(c2, c1, bx);
    vec4 bot = mix(c4, c3, bx);
    vec4 result = mix(bot, top, by);

    gl_FragColor = result;
  }
`;

export const GEN_AO_FRAG = `
  uniform sampler2D tInput;
  uniform vec2 uResolution;
  uniform float uRadius;
  uniform float uIntensity;
  varying vec2 vUv;

  float getHeight(vec2 uv) {
    vec3 c = texture2D(tInput, uv).rgb;
    return dot(c, vec3(0.299, 0.587, 0.114));
  }

  void main() {
    vec2 texel = 1.0 / uResolution;
    float centerH = getHeight(vUv);
    float ao = 0.0;
    float samples = 0.0;

    for (float y = -3.0; y <= 3.0; y += 1.0) {
      for (float x = -3.0; x <= 3.0; x += 1.0) {
        if (x == 0.0 && y == 0.0) continue;
        vec2 offset = vec2(x, y) * texel * uRadius;
        float sampleH = getHeight(vUv + offset);
        float diff = centerH - sampleH;
        ao += max(0.0, diff);
        samples += 1.0;
      }
    }

    ao = 1.0 - (ao / samples) * uIntensity;
    ao = clamp(ao, 0.0, 1.0);
    gl_FragColor = vec4(vec3(ao), 1.0);
  }
`;

export const GEN_CURVATURE_FRAG = `
  uniform sampler2D tInput;
  uniform vec2 uResolution;
  uniform float uStrength;
  varying vec2 vUv;

  float getHeight(vec2 uv) {
    vec3 c = texture2D(tInput, uv).rgb;
    return dot(c, vec3(0.299, 0.587, 0.114));
  }

  void main() {
    vec2 texel = 1.0 / uResolution;

    float h = getHeight(vUv);
    float hL = getHeight(vUv - vec2(texel.x, 0.0));
    float hR = getHeight(vUv + vec2(texel.x, 0.0));
    float hT = getHeight(vUv + vec2(0.0, texel.y));
    float hB = getHeight(vUv - vec2(0.0, texel.y));

    // Second derivative (Laplacian) for curvature
    float curvature = (hL + hR + hT + hB - 4.0 * h) * uStrength;

    // Map to 0.5 = flat, <0.5 = concave, >0.5 = convex
    float result = curvature * 0.5 + 0.5;
    gl_FragColor = vec4(vec3(result), 1.0);
  }
`;

// ========== NEW FILTERS ==========

export const FILTER_SHARPEN_FRAG = `
  uniform sampler2D tInput;
  uniform vec2 uResolution;
  uniform float uStrength;
  varying vec2 vUv;

  void main() {
    vec2 texel = 1.0 / uResolution;
    vec4 center = texture2D(tInput, vUv);

    vec4 blur = (
      texture2D(tInput, vUv + vec2(-texel.x, -texel.y)) +
      texture2D(tInput, vUv + vec2(0.0, -texel.y)) +
      texture2D(tInput, vUv + vec2(texel.x, -texel.y)) +
      texture2D(tInput, vUv + vec2(-texel.x, 0.0)) +
      texture2D(tInput, vUv + vec2(texel.x, 0.0)) +
      texture2D(tInput, vUv + vec2(-texel.x, texel.y)) +
      texture2D(tInput, vUv + vec2(0.0, texel.y)) +
      texture2D(tInput, vUv + vec2(texel.x, texel.y))
    ) / 8.0;

    vec4 sharp = center + (center - blur) * uStrength;
    gl_FragColor = clamp(sharp, 0.0, 1.0);
  }
`;

export const FILTER_HSL_FRAG = `
  uniform sampler2D tInput;
  uniform float uHue;
  uniform float uSaturation;
  uniform float uLightness;
  varying vec2 vUv;

  vec3 rgb2hsl(vec3 c) {
    float maxC = max(max(c.r, c.g), c.b);
    float minC = min(min(c.r, c.g), c.b);
    float l = (maxC + minC) / 2.0;
    float s = 0.0;
    float h = 0.0;

    if (maxC != minC) {
      float d = maxC - minC;
      s = l > 0.5 ? d / (2.0 - maxC - minC) : d / (maxC + minC);
      if (maxC == c.r) h = (c.g - c.b) / d + (c.g < c.b ? 6.0 : 0.0);
      else if (maxC == c.g) h = (c.b - c.r) / d + 2.0;
      else h = (c.r - c.g) / d + 4.0;
      h /= 6.0;
    }
    return vec3(h, s, l);
  }

  float hue2rgb(float p, float q, float t) {
    if (t < 0.0) t += 1.0;
    if (t > 1.0) t -= 1.0;
    if (t < 1.0/6.0) return p + (q - p) * 6.0 * t;
    if (t < 1.0/2.0) return q;
    if (t < 2.0/3.0) return p + (q - p) * (2.0/3.0 - t) * 6.0;
    return p;
  }

  vec3 hsl2rgb(vec3 c) {
    float h = c.x, s = c.y, l = c.z;
    if (s == 0.0) return vec3(l);
    float q = l < 0.5 ? l * (1.0 + s) : l + s - l * s;
    float p = 2.0 * l - q;
    return vec3(hue2rgb(p, q, h + 1.0/3.0), hue2rgb(p, q, h), hue2rgb(p, q, h - 1.0/3.0));
  }

  void main() {
    vec4 tex = texture2D(tInput, vUv);
    vec3 hsl = rgb2hsl(tex.rgb);

    hsl.x = fract(hsl.x + uHue);
    hsl.y = clamp(hsl.y * uSaturation, 0.0, 1.0);
    hsl.z = clamp(hsl.z + uLightness, 0.0, 1.0);

    vec3 rgb = hsl2rgb(hsl);
    gl_FragColor = vec4(rgb, tex.a);
  }
`;

export const FILTER_POSTERIZE_FRAG = `
  uniform sampler2D tInput;
  uniform float uLevels;
  varying vec2 vUv;

  void main() {
    vec4 tex = texture2D(tInput, vUv);
    vec3 col = floor(tex.rgb * uLevels + 0.5) / uLevels;
    gl_FragColor = vec4(col, tex.a);
  }
`;

export const FILTER_EMBOSS_FRAG = `
  uniform sampler2D tInput;
  uniform vec2 uResolution;
  uniform float uStrength;
  varying vec2 vUv;

  void main() {
    vec2 texel = 1.0 / uResolution;

    vec3 tl = texture2D(tInput, vUv + vec2(-texel.x, -texel.y)).rgb;
    vec3 br = texture2D(tInput, vUv + vec2(texel.x, texel.y)).rgb;

    vec3 emboss = (br - tl) * uStrength + 0.5;
    gl_FragColor = vec4(emboss, 1.0);
  }
`;

export const FILTER_THRESHOLD_FRAG = `
  uniform sampler2D tInput;
  uniform float uThreshold;
  varying vec2 vUv;

  void main() {
    vec4 tex = texture2D(tInput, vUv);
    float luma = dot(tex.rgb, vec3(0.299, 0.587, 0.114));
    float bw = step(uThreshold, luma);
    gl_FragColor = vec4(vec3(bw), tex.a);
  }
`;
