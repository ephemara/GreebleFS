
/**
 * K-QUANTUM CORE SHADERS
 * High-performance GPGPU particle physics kernels.
 */

export const PARTICLE_SIM_VERT = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position, 1.0);
  }
`;

export const VELOCITY_FRAGMENT = `
  uniform sampler2D velocityTexture;
  uniform sampler2D positionTexture;
  uniform sampler2D fluidTexture; // Optional link to FluidSimulator
  uniform sampler2D originTexture;
  
  uniform float time;
  uniform float dt;
  uniform float speed;
  uniform float chaos;
  uniform int mode;
  
  // Interaction
  uniform vec3 mousePos;
  uniform float uDamping;
  
  // Audio / Modifiers
  uniform float audioLevel;
  uniform float audioBass;
  uniform float audioHigh;
  
  varying vec2 vUv;

  // --- NOISE FUNCTIONS ---
  vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec3 permute(vec3 x) { return mod289(((x*34.0)+1.0)*x); }
  float snoise(vec2 v) { const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439); vec2 i = floor(v + dot(v, C.yy) ); vec2 x0 = v - i + dot(i, C.xx); vec2 i1; i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0); vec4 x12 = x0.xyxy + C.xxzz; x12.xy -= i1; i = mod289(i); vec3 p = permute( permute( i.y + vec3(0.0, i1.y, 1.0 )) + i.x + vec3(0.0, i1.x, 1.0 )); vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0); m = m*m ; m = m*m ; vec3 x = 2.0 * fract(p * C.www) - 1.0; vec3 h = abs(x) - 0.5; vec3 ox = floor(x + 0.5); vec3 a0 = x - ox; m *= 1.79284291400159 - 0.85373472095314 * ( a0*a0 + h*h ); vec3 g; g.x = a0.x * x0.x + h.x * x0.y; g.yz = a0.yz * x12.xz + h.yz * x12.yw; return 130.0 * dot(m, g); }
  vec3 curl(float x, float y, float z) { float eps = 0.1; float n1 = snoise(vec2(x, y)); float n2 = snoise(vec2(y, z)); float n3 = snoise(vec2(z, x)); return vec3(n2 - n3, n3 - n1, n1 - n2); }

  void main() {
    vec2 uv = vUv;
    vec3 pos = texture2D(positionTexture, uv).xyz;
    vec3 vel = texture2D(velocityTexture, uv).xyz;
    vec3 origin = texture2D(originTexture, uv).xyz;

    vec3 acc = vec3(0.0);

    // --- PHYSICS MODES ---

    // MODE 0: ZERO-POINT (Stable Grid)
    if (mode == 0) {
        vec3 diff = origin - pos;
        acc += diff * 0.1 * speed; 
        acc += curl(pos.x * 0.1, pos.y * 0.1, time * 0.1) * chaos * 0.1; 
    }
    
    // MODE 1: KERR BLACK HOLE
    else if (mode == 1) {
        acc.y -= pos.y * 0.5; 
        vec3 dir = -normalize(pos);
        float r = length(pos);
        float gravity = 50.0 * speed / (r * r + 0.1);
        if (r < 2.0) gravity = 0.0; 
        acc += dir * gravity;
        vec3 up = vec3(0.0, 1.0, 0.0);
        vec3 tangent = cross(dir, up);
        float spin = 20.0 * speed / (r + 1.0);
        acc += tangent * spin;
        acc += curl(pos.x*0.1, pos.y*0.1, time*0.1) * chaos * 0.5;
    }

    // MODE 2: TORNADO / ION STORM
    else if (mode == 2) {
        vec3 diff = pos - vec3(0, pos.y, 0);
        vec3 centerDir = -normalize(diff);
        vec3 up = vec3(0, 1, 0);
        vec3 spin = cross(centerDir, up);
        acc += spin * 2.0 * speed;
        acc += centerDir * 0.5 * speed; 
        acc.y += 0.5 * speed; 
        acc += curl(pos.x*0.1, pos.y*0.1, time*0.2) * chaos;
    }

    // MODE 3: GALAXY SPIRAL
    else if (mode == 3) {
        acc.y -= pos.y * 0.5;
        float r = length(pos.xz);
        float angle = atan(pos.z, pos.x);
        float spiralOffset = 2.0 * log(r + 1.0); 
        float armPhase = angle + spiralOffset;
        float density = cos(armPhase * 2.0); 
        vec3 tangent = cross(vec3(0,1,0), normalize(pos));
        float orbSpeed = 15.0 * speed / sqrt(r + 0.1);
        if (density > 0.0) orbSpeed *= 0.6; 
        acc += (tangent * orbSpeed - vel) * 0.5; 
        acc += -normalize(pos) * (10.0 / (r*r + 1.0)); 
        acc += curl(pos.x*0.05, pos.y*0.05, time*0.05) * chaos * 0.2;
    }

    // MODE 4: LORENZ ATTRACTOR
    else if (mode == 4) {
        float sigma = 10.0; float rho = 28.0; float beta = 8.0/3.0;
        vec3 p = pos * 1.0; 
        vec3 d;
        d.x = sigma * (p.y - p.x);
        d.y = p.x * (rho - p.z) - p.y;
        d.z = p.x * p.y - beta * p.z;
        acc += (d * 0.5 * speed - vel) * 0.5; 
    }

    // MODE 6: AIZAWA ATTRACTOR
    else if (mode == 6) {
        float a = 0.95; float b = 0.7; float c = 0.6; float d = 3.5; float e = 0.25; float f = 0.1;
        vec3 p = pos * 2.0; 
        float dx = (p.z - b) * p.x - d * p.y;
        float dy = d * p.x + (p.z - b) * p.y;
        float dz = c + a * p.z - (p.z * p.z * p.z) / 3.0 - (p.x * p.x + p.y * p.y) * (1.0 + e * p.z) + f * p.z * (p.x * p.x * p.x);
        vec3 flow = vec3(dx, dy, dz);
        acc += (flow * 0.5 * speed - vel) * 0.5;
    }

    // MODE 12: NEURAL LATTICE (Quantum Pilot)
    else if (mode == 12) { 
        vec3 p = curl(pos.x*0.1, pos.y*0.1, pos.z*0.1); 
        vec3 m = curl(pos.x*0.5, pos.y*0.5, pos.z*0.5); 
        acc += p*2.0*speed + m*5.0*chaos; 
        if(length(pos)>40.0) acc -= normalize(pos); 
    }

    // MODE 13: FERROFLUID (Magnetic Liquid)
    else if (mode == 13) { 
        float s = pow(abs(sin(pos.x*0.5)*sin(pos.y*0.5)*sin(pos.z*0.5)), 4.0)*50.0; 
        acc += (-normalize(pos))*0.5*speed;
        acc += normalize(pos)*s*0.5*chaos; 
        acc += curl(pos.x*0.1,pos.y*0.1,time)*1.0; 
    }

    // MODE 17: FLUID COUPLING (Navier-Stokes)
    else if (mode == 17) {
        vec2 fUV = (pos.xy + 20.0) / 40.0; // Map world pos to 0-1 texture space
        if (fUV.x > 0.0 && fUV.x < 1.0 && fUV.y > 0.0 && fUV.y < 1.0) {
            vec3 fluidForce = texture2D(fluidTexture, fUV).xyz;
            acc += fluidForce * 50.0 * speed;
        }
        acc += curl(pos.x*0.2, pos.y*0.2, pos.z*0.2) * chaos;
        // Gravity/Centering
        if (length(pos) > 20.0) acc -= normalize(pos) * 1.0;
    }

    // General Damping & Integration
    vel += acc * dt;
    vel *= uDamping;

    // Mouse Interaction
    float dist = distance(pos.xy, mousePos.xy);
    if (dist < 5.0 && mousePos.z > 0.5) {
        vel += normalize(pos - mousePos) * 2.0;
    }

    gl_FragColor = vec4(vel, 1.0);
  }
`;

export const POSITION_FRAGMENT = `
  uniform sampler2D positionTexture;
  uniform sampler2D velocityTexture;
  uniform sampler2D originTexture;
  uniform float dt;
  uniform float time;
  uniform int mode;
  varying vec2 vUv;

  float rand(vec2 co){ return fract(sin(dot(co.xy ,vec2(12.9898,78.233))) * 43758.5453); }

  void main() {
    vec2 uv = vUv;
    vec3 pos = texture2D(positionTexture, uv).xyz;
    vec3 vel = texture2D(velocityTexture, uv).xyz;
    vec3 origin = texture2D(originTexture, uv).xyz;

    pos += vel * dt;
    
    // Life/Respawn Logic
    float life = texture2D(positionTexture, uv).w - 0.005 * (1.0 + rand(uv)*0.5);
    bool respawn = false;
    
    if (life <= 0.0 || length(pos) > 100.0) respawn = true;
    
    // Mode specific bounds
    if (mode == 0) { respawn = false; life = 1.0; } 
    if (mode == 13 && length(pos) > 50.0) respawn = true;

    if (respawn) {
        life = 1.0;
        if (mode == 0 || mode == 13) pos = origin;
        else if (mode == 3) {
             float angle = rand(uv + time) * 6.28;
             float r = 2.0 + rand(uv + time + 1.0) * 40.0;
             pos = vec3(cos(angle)*r, (rand(uv)-0.5)*2.0, sin(angle)*r);
        }
        else if (mode == 17) {
             pos = (vec3(rand(uv), rand(uv+0.1), 0.0)-0.5) * 40.0;
        }
        else {
             pos = (vec3(rand(uv), rand(uv+1.0), rand(uv+2.0))-0.5) * 60.0;
        }
    }

    gl_FragColor = vec4(pos, life);
  }
`;

export const RENDER_VERT = `
  uniform sampler2D positionTexture;
  uniform sampler2D velocityTexture;
  uniform float pointSize;
  attribute vec2 reference;
  varying vec3 vVel;
  varying float vLife;
  
  void main() {
    vec4 posData = texture2D(positionTexture, reference);
    vec3 pos = posData.xyz;
    vLife = posData.w;
    vVel = texture2D(velocityTexture, reference).xyz;
    
    vec4 mvPosition = viewMatrix * modelMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    
    gl_PointSize = pointSize * (100.0 / -mvPosition.z);
  }
`;

export const RENDER_FRAG = `
  uniform vec3 color;
  uniform float opacity;
  varying vec3 vVel;
  varying float vLife;
  
  void main() {
    vec2 coord = gl_PointCoord - vec2(0.5);
    if(dot(coord, coord) > 0.25) discard;
    
    float speed = length(vVel);
    vec3 finalColor = color + vec3(speed * 0.1); // Speed glow
    
    gl_FragColor = vec4(finalColor, opacity * vLife);
  }
`;
