export const SIM_VERTEX = `varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position, 1.0); }`;

// 1. VELOCITY KERNEL (THE BRAIN - INJECTABLE)
export const VELOCITY_TEMPLATE = `
  uniform sampler2D velocityTexture;
  uniform sampler2D positionTexture;
  uniform sampler2D originTexture;
  
  uniform float time;
  uniform float dt;
  uniform float speed;
  uniform float chaos;
  uniform int mode;
  
  uniform float uScriptActive;
  
  // MOUSE
  uniform vec3 mousePos;
  
  // PHYSICS PARAMS
  uniform float uDamping;
  uniform float uLimit;
  
  varying vec2 vUv;

  // NOISE FUNCTIONS
  vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec3 permute(vec3 x) { return mod289(((x*34.0)+1.0)*x); }
  float snoise(vec2 v) { const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439); vec2 i = floor(v + dot(v, C.yy) ); vec2 x0 = v - i + dot(i, C.xx); vec2 i1; i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0); vec4 x12 = x0.xyxy + C.xxzz; x12.xy -= i1; i = mod289(i); vec3 p = permute( permute( i.y + vec3(0.0, i1.y, 1.0 )) + i.x + vec3(0.0, i1.x, 1.0 )); vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0); m = m*m ; m = m*m ; vec3 x = 2.0 * fract(p * C.www) - 1.0; vec3 h = abs(x) - 0.5; vec3 ox = floor(x + 0.5); vec3 a0 = x - ox; m *= 1.79284291400159 - 0.85373472095314 * ( a0*a0 + h*h ); vec3 g; g.x = a0.x * x0.x + h.x * x0.y; g.yz = a0.yz * x12.xz + h.yz * x12.yw; return 130.0 * dot(m, g); }
  vec3 curl(float x, float y, float z) { float eps = 0.1; float n1 = snoise(vec2(x, y)); float n2 = snoise(vec2(y, z)); float n3 = snoise(vec2(z, x)); return vec3(n2 - n3, n3 - n1, n1 - n2); }

  // UTILS
  float rand(vec2 co){ return fract(sin(dot(co.xy ,vec2(12.9898,78.233))) * 43758.5453); }

  // USER INJECTION SLOT
  vec3 customForce(vec3 p, vec3 v, float t) { 
      vec3 force = vec3(0.0); 
      /*_INJECT_*/ 
      return force; 
  }

  void main() {
    vec2 uv = vUv;
    vec3 pos = texture2D(positionTexture, uv).xyz;
    vec3 vel = texture2D(velocityTexture, uv).xyz;
    vec3 origin = texture2D(originTexture, uv).xyz;

    // --- FORCE ACCUMULATOR ---
    vec3 acc = vec3(0.0);

    // K-SCRIPT INJECTION
    if (uScriptActive > 0.5) {
        acc += customForce(pos, vel, time);
    }

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

    // MODE 2: TORNADO
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

    // MODE 3: GALAXY DENSITY WAVE
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

    // MODE 5: VAN ALLEN BELT
    else if (mode == 5) {
        vec3 m = vec3(0.0, 50.0, 0.0); 
        vec3 p = pos;
        float r = length(p);
        float dotMR = dot(m, p);
        vec3 B = (3.0 * p * dotMR - m * (r*r)) / pow(r, 5.0);
        vec3 B_dir = normalize(B);
        acc += B_dir * 20.0 * speed;
        if (r < 5.0) acc += normalize(p) * 50.0;
        acc += curl(pos.x*0.1, pos.y*0.1, pos.z*0.1) * chaos;
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

    // MODE 7: BINARY STAR (ROCHE)
    else if (mode == 7) {
        vec3 star1 = vec3(-10.0, 0.0, 0.0);
        vec3 star2 = vec3(10.0, 0.0, 0.0);
        float m1 = 1.0; float m2 = 0.8;
        float angle = time * 0.5 * speed;
        float ca = cos(angle); float sa = sin(angle);
        vec3 rStar1 = vec3(star1.x*ca - star1.z*sa, 0.0, star1.x*sa + star1.z*ca);
        vec3 rStar2 = vec3(star2.x*ca - star2.z*sa, 0.0, star2.x*sa + star2.z*ca);
        vec3 d1 = rStar1 - pos; vec3 d2 = rStar2 - pos;
        float dist1 = length(d1); float dist2 = length(d2);
        vec3 f1 = normalize(d1) * (m1 / (dist1*dist1 + 0.1)) * 100.0;
        vec3 f2 = normalize(d2) * (m2 / (dist2*dist2 + 0.1)) * 100.0;
        vec3 centrifugal = vec3(pos.x, 0.0, pos.z) * 0.1; 
        acc += (f1 + f2 + centrifugal) * speed;
        acc += curl(pos.x*0.1, pos.y*0.1, pos.z*0.1) * chaos * 2.0;
        acc.y -= pos.y * 0.1;
    }

    // MODE 8: QUASAR JET
    else if (mode == 8) {
        vec3 centerDir = -normalize(pos);
        float r = length(pos);
        float gForce = 20.0 / (r*r + 0.1);
        acc += centerDir * gForce;
        vec3 up = vec3(0.0, 1.0, 0.0);
        vec3 spin = cross(centerDir, up);
        acc += spin * 10.0 / (r + 1.0);
        float cone = length(pos.xz);
        if (cone < 5.0 && abs(pos.y) > 2.0) {
            float jetForce = 50.0 * speed;
            acc.y += sign(pos.y) * jetForce;
            acc.x -= pos.x * 2.0; 
            acc.z -= pos.z * 2.0;
            acc += spin * 20.0;
        }
        acc += curl(pos.x*0.2, pos.y*0.05, time*2.0) * chaos;
    }

    // MODE 9: SUPERNOVA REMNANT (Blast Wave + Rayleigh-Taylor)
    else if (mode == 9) {
        vec3 dir = normalize(pos);
        float r = length(pos);
        
        // Blast wave expands
        float blastSpeed = 20.0 * speed / (r * 0.1 + 1.0); 
        acc += dir * blastSpeed;
        
        // Rayleigh-Taylor Turbulence (fingering effect) at the shockfront
        vec3 turbulence = curl(pos.x*0.2, pos.y*0.2, pos.z*0.2) * chaos * 5.0;
        
        // Apply turbulence mostly at the "shell"
        float shellStart = 20.0 + time * 5.0;
        if (r > shellStart - 5.0 && r < shellStart + 5.0) {
            acc += turbulence;
        }
        
        // Drag force (Interstellar Medium resistance)
        acc -= vel * 0.1; 
    }

    // MODE 10: ALCUBIERRE WARP (Metric Distortion)
    else if (mode == 10) {
        // Ship direction: +Z
        // Contract space in front (+Z), expand behind (-Z)
        float z = pos.z;
        
        // Warp Bubble Function
        float r = length(pos.xy); // Distance from central axis
        float bubble = 1.0 - (tanh(r - 10.0) + 1.0) * 0.5; // 1 inside bubble, 0 outside
        
        vec3 warpField = vec3(0.0);
        
        // Contraction/Expansion gradient
        if (z > 0.0) warpField.z = -10.0; // Pull towards ship from front
        else warpField.z = 10.0; // Push away behind
        
        // Apply warp only within the bubble walls
        acc += warpField * bubble * speed * 5.0;
        
        // Flat space in center (the ship)
        if (r < 5.0 && abs(z) < 5.0) {
            acc *= 0.0; 
            vel *= 0.5; // Dampen inside the ship
        }
        
        acc += curl(pos.x*0.1, pos.y*0.1, z*0.1 + time) * chaos;
    }

    // MODE 11: SOLAR PROMINENCE (Magnetic Reconnection)
    else if (mode == 11) {
        // Surface at Y = -20
        if (pos.y < -20.0) {
            acc.y += 10.0; // Buoyancy
        }
        
        // Magnetic Loop Math
        // Field lines curve from x = -20 to x = +20
        float xNorm = pos.x / 20.0;
        float arcHeight = cos(xNorm * 1.57) * 30.0;
        float targetY = -20.0 + arcHeight;
        
        // Guide to field line
        vec3 fieldTarget = vec3(pos.x, targetY, 0.0);
        vec3 magneticForce = (fieldTarget - pos) * 2.0;
        
        // Twist (Flux tube torsion)
        vec3 tangent = normalize(vec3(1.0, -sin(xNorm * 1.57), 0.0));
        vec3 twist = cross(tangent, normalize(pos - fieldTarget)) * 10.0;
        
        acc += (magneticForce + twist) * speed;
        
        // Reconnection Event (Chaos trigger)
        if (chaos > 0.8 && abs(pos.x) < 5.0) {
            acc += normalize(pos) * 100.0; // CME Blast
        }
    }

    // MODE 12: QUANTUM FOAM
    else if (mode == 12) {
        vec3 disp = curl(pos.x*0.5, pos.y*0.5, time*0.5) * chaos * 5.0;
        float expansion = sin(length(pos)*0.5 - time*2.0);
        acc += disp;
        acc += normalize(pos) * expansion * speed * 2.0;
        if (length(pos) > 50.0) acc -= normalize(pos) * 10.0;
        if (length(vel) < 0.1) acc += (vec3(rand(vec2(time)), rand(vec2(time+1.0)), rand(vec2(time+2.0)))-0.5) * 10.0;
    }

    // MODE 13: CYBERPUNK CITY
    else if (mode == 13) {
        // Grid Movement
        vec3 grid = floor(pos / 5.0) * 5.0;
        vec3 diff = pos - grid;
        // Traffic logic
        vec3 flow = vec3(0.0);
        float tVal = sin(time*0.5 + grid.x + grid.z);
        if (abs(diff.x) < 0.5) flow.z = sign(sin(grid.x))*10.0;
        if (abs(diff.z) < 0.5) flow.x = sign(sin(grid.z))*10.0;
        if (abs(diff.y) < 0.5) {
             flow.y = 0.0;
             if (length(flow) < 1.0) flow.y = sin(time + grid.x)*2.0; // Elevators
        }
        
        acc += (flow * speed - vel) * 0.5;
        acc += curl(pos.x*0.2, pos.y*0.2, time*0.5) * chaos;
        if (length(pos) > 60.0) acc -= normalize(pos) * 5.0;
    }

    // MODE 14: DNA HELIX
    else if (mode == 14) {
        float helixRad = 10.0;
        float rise = pos.y * 0.2 + time;
        vec3 strand1 = vec3(cos(rise)*helixRad, pos.y, sin(rise)*helixRad);
        vec3 strand2 = vec3(cos(rise + 3.14)*helixRad, pos.y, sin(rise + 3.14)*helixRad);
        
        vec3 d1 = strand1 - pos;
        vec3 d2 = strand2 - pos;
        
        if (length(d1) < length(d2)) acc += d1 * 5.0 * speed;
        else acc += d2 * 5.0 * speed;
        
        acc += curl(pos.x*0.1, pos.y*0.1, pos.z*0.1) * chaos * 2.0;
        acc.y += sin(pos.x * 0.1) * 0.5;
    }
    
    // MODE 15: BLACK HOLE ACCRETION (V2 - High Fidelity)
    else if (mode == 15) {
        float r = length(pos);
        vec3 dir = -normalize(pos);
        float eventHorizon = 5.0;
        
        // Strong Gravity
        float g = 1000.0 * speed / (r*r + 0.1);
        if (r < eventHorizon) g = 0.0; // Inside falls forever (visual hack)
        acc += dir * g;
        
        // Accretion Disk Spin
        vec3 up = vec3(0,1,0);
        vec3 tangent = normalize(cross(dir, up));
        float orb = sqrt(500.0/r) * speed; // Keplerian-ish
        if (r > eventHorizon) acc += tangent * orb * 0.2; // Nudge to orbit
        
        // Flatten to disk
        if (r > eventHorizon) acc.y -= pos.y * 5.0;
        
        // Relativistic Jets
        float polar = abs(dot(normalize(pos), up));
        if (polar > 0.9 && r < 20.0) {
            acc += up * sign(pos.y) * 100.0 * speed;
            acc += curl(pos.x*2.0, pos.y*2.0, pos.z*2.0) * chaos * 10.0;
        }
        
        acc += curl(pos.x*0.05, pos.y*0.05, time*0.1) * chaos;
    }

    // MOUSE INTERACTION (Physics Based)
    float dist = distance(pos.xy, mousePos.xy);
    if (dist < 10.0 && mousePos.z != 0.0) {
        vec3 mDir = normalize(pos - mousePos);
        acc += mDir * 5.0;
    }

    // INTEGRATION
    vel += acc * dt;
    
    // DAMPING
    vel *= uDamping;
    
    // LIMIT
    if (length(vel) > uLimit) vel = normalize(vel) * uLimit;

    gl_FragColor = vec4(vel, 1.0);
  }
`;

// 2. POSITION KERNEL
export const POSITION_FRAG = `
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

    // Euler Integration
    pos += vel * dt;

    // RESPAWN LOGIC (Hard boundaries)
    bool respawn = false;
    float r = length(pos);
    
    // Mode specific bounds
    if (mode == 1 || mode == 8 || mode == 15) { // Black Holes / Quasar
        if (r < 1.0 || r > 100.0) respawn = true;
    }
    else if (mode == 2) { // Tornado
        if (pos.y > 40.0 || abs(pos.x) > 40.0) respawn = true;
    }
    else if (mode == 3 || mode == 7) { // Galaxy / Binary
        if (r > 80.0) respawn = true;
    }
    else if (mode == 4 || mode == 6) { // Attractors
        if (r > 100.0) respawn = true;
    }
    else if (mode == 5) { // Van Allen
        if (r > 60.0 || r < 2.0) respawn = true;
    }
    else if (mode == 9 || mode == 12) { // Supernova / Quantum
        if (r > 80.0) respawn = true;
    }
    else if (mode == 10) { // Alcubierre
        if (abs(pos.z) > 60.0 || length(pos.xy) > 40.0) respawn = true;
    }
    else if (mode == 11) { // Solar
        if (pos.y < -30.0 || pos.y > 40.0 || abs(pos.x) > 40.0) respawn = true;
    }
    else if (mode == 13) { // Cyber City
        if (abs(pos.x) > 60.0 || abs(pos.z) > 60.0 || abs(pos.y) > 30.0) respawn = true;
    }
    else if (mode == 14) { // DNA
        if (abs(pos.y) > 60.0) respawn = true;
    }
    else {
        if (r > 80.0) respawn = true;
    }

    if (respawn) {
        // Mode specific spawn shapes
        if (mode == 1 || mode == 3 || mode == 8 || mode == 15) { // Disk Spawns
            float angle = rand(uv + time) * 6.28;
            float rad = 20.0 + rand(uv + time + 1.0) * 40.0;
            pos = vec3(cos(angle)*rad, (rand(uv)-0.5)*1.0, sin(angle)*rad);
        } 
        else if (mode == 2) { // Tornado Base
            float angle = rand(uv + time) * 6.28;
            float rad = 20.0 + rand(uv) * 20.0;
            pos = vec3(cos(angle)*rad, -40.0, sin(angle)*rad);
        }
        else if (mode == 4) { // Lorenz Origin
            pos = vec3(0.1, 0.1, 0.1) + (vec3(rand(uv), rand(uv+1.0), rand(uv+2.0)) - 0.5) * 2.0;
        }
        else if (mode == 6) { // Aizawa Origin (X Axis line)
            pos = vec3((rand(uv)-0.5)*2.0, 0.0, 0.0);
        }
        else if (mode == 7) { // Binary: Spawn near L1 or generally around
             float angle = rand(uv) * 6.28;
             float rad = 30.0 + rand(uv+1.0) * 10.0;
             pos = vec3(cos(angle)*rad, (rand(uv)-0.5)*1.0, sin(angle)*rad);
        }
        else if (mode == 5) { // Magnetic Shell
            float rad = 10.0 + rand(uv)*20.0;
            float theta = rand(uv+1.0) * 6.28;
            float phi = rand(uv+2.0) * 3.14;
            pos = vec3(rad*sin(phi)*cos(theta), rad*sin(phi)*sin(theta), rad*cos(phi));
        }
        else if (mode == 9 || mode == 12) { // Center Spawn
            pos = (vec3(rand(uv), rand(uv+1.0), rand(uv+2.0)) - 0.5) * 2.0;
        }
        else if (mode == 10) { // Warp Grid (Front plane)
            pos = vec3((rand(uv)-0.5)*40.0, (rand(uv+1.0)-0.5)*40.0, 50.0);
        }
        else if (mode == 11) { // Solar Surface
            pos = vec3((rand(uv)-0.5)*40.0, -20.0, (rand(uv+1.0)-0.5)*10.0);
        }
        else if (mode == 13) { // City Floor
            pos = vec3((rand(uv)-0.5)*100.0, -20.0, (rand(uv+1.0)-0.5)*100.0);
        }
        else if (mode == 14) { // DNA Bottom
            pos = vec3((rand(uv)-0.5)*20.0, -50.0, (rand(uv+1.0)-0.5)*20.0);
        }
        else {
            pos = origin; // Reset to grid
        }
    }

    gl_FragColor = vec4(pos, 1.0); // Alpha channel unused for now
  }
`;

// 3. RENDER SHADER
export const RENDER_VERTEX = `
  uniform sampler2D positionTexture;
  uniform sampler2D velocityTexture;
  uniform float pointSize;
  uniform float sizeMult;
  attribute vec2 reference;
  varying vec3 vVel;
  varying vec3 vPos;
  
  void main() {
    vec3 pos = texture2D(positionTexture, reference).xyz;
    vec3 vel = texture2D(velocityTexture, reference).xyz;
    vVel = vel;
    vPos = pos;
    
    vec4 mvPosition = viewMatrix * modelMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    
    float dist = -mvPosition.z;
    gl_PointSize = (pointSize * sizeMult) * (100.0 / dist);
  }
`;

export const RENDER_FRAG = `
  uniform vec3 color;
  uniform vec3 color2;
  uniform int colorMode; // 0=SOLID, 1=VELOCITY, 2=POSITION, 3=ANGLE
  uniform float gradientStrength;
  uniform float opacity;
  varying vec3 vVel;
  varying vec3 vPos;
  
  void main() {
    vec2 coord = gl_PointCoord - vec2(0.5);
    if (dot(coord, coord) > 0.25) discard;
    
    vec3 finalColor = color;
    
    // Gradient Logic
    float factor = 0.0;
    
    if (colorMode == 1) { // VELOCITY
        float speed = length(vVel);
        factor = smoothstep(0.0, 5.0, speed);
    }
    else if (colorMode == 2) { // POSITION (RADIAL)
        float dist = length(vPos);
        factor = smoothstep(0.0, 50.0, dist);
    }
    else if (colorMode == 3) { // ANGLE (Y Axis)
        factor = (vPos.y + 20.0) / 40.0;
        factor = clamp(factor, 0.0, 1.0);
    }
    
    // Invert factor logic based on preference or just mix
    // Mix Color1 -> Color2 based on factor * strength
    finalColor = mix(color, color2, factor * gradientStrength);
    
    // Add brightness boost from speed regardless of mode
    float speed = length(vVel);
    finalColor += vec3(speed * 0.05);
    
    gl_FragColor = vec4(finalColor, opacity);
  }
`;
