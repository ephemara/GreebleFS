
export const SIM_VERTEX = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position, 1.0);
  }
`;

export const PHYSICS_FRAGMENT = `
  uniform sampler2D heightMap;
  uniform sampler2D velocityMap; // From Fluid Simulator
  
  uniform vec2 mousePos;
  uniform float brushSize;
  uniform float brushStrength;
  uniform float time;
  uniform int activeEffect; 
  uniform float simSpeed;
  uniform bool doReset;
  uniform bool isSimulating;
  uniform bool blending;
  uniform float blendFactor;
  uniform sampler2D blendTargetA;
  uniform sampler2D blendTargetB;
  uniform vec2 res;
  
  varying vec2 vUv;

  // Simplex Noise
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
    if (blending) {
       float hA = texture2D(blendTargetA, vUv).r;
       float hB = texture2D(blendTargetB, vUv).r;
       float h = mix(hA, hB, blendFactor);
       gl_FragColor = vec4(h, 0.0, 0.0, 1.0);
       return;
    }

    if (doReset) {
        float n = snoise(vUv * 3.0) * 0.3 + 0.3;
        n += snoise(vUv * 10.0) * 0.05;
        gl_FragColor = vec4(n, 0.0, 0.0, 1.0);
        return;
    }

    vec4 data = texture2D(heightMap, vUv);
    float h = data.r;

    if (isSimulating) {
        vec2 uv = vUv;
        float texel = 1.0 / res.x;
        
        // 0. MAGMA (Fluid Advection)
        if (activeEffect == 6) {
            vec2 vel = texture2D(velocityMap, uv).xy;
            vec2 coord = uv - (vel * 0.005 * simSpeed); // Backtrace
            h = texture2D(heightMap, coord).r;
            // Add some cooling/hardening noise
            h += snoise(uv * 50.0 + time) * 0.001 * simSpeed;
        }

        // 3. WARP
        else if (activeEffect == 3) {
            float n = snoise(uv * 8.0 + time * 0.1);
            uv += vec2(n, n) * 0.001 * brushStrength * simSpeed; 
            h = texture2D(heightMap, uv).r;
        }
        
        // 7. HYDRO-THERMAL VENTS (Deposition)
        else if (activeEffect == 7) {
             vec2 vel = texture2D(velocityMap, uv).xy;
             float speed = length(vel);
             // Deposit mass where fluid energy is high
             if (speed > 0.1) {
                 h += 0.005 * speed * simSpeed; 
             }
             // General cooling/sinking
             h -= 0.0005 * simSpeed;
        }

        float hL = texture2D(heightMap, uv + vec2(-texel, 0.0)).r;
        float hR = texture2D(heightMap, uv + vec2(texel, 0.0)).r;
        float hU = texture2D(heightMap, uv + vec2(0.0, texel)).r;
        float hD = texture2D(heightMap, uv + vec2(0.0, -texel)).r;
        
        float delta = 0.0;

        // 1. THERMAL (Diffusion)
        if (activeEffect == 1) {
            float diff = (hL + hR + hU + hD) * 0.25 - h;
            if (abs(diff) > 0.001) delta += diff * simSpeed * 0.5;
        }

        // 2. HYDRAULIC (Simplified)
        if (activeEffect == 2) {
            // Find lowest neighbor
            float minH = min(min(hL, hR), min(hU, hD));
            float diff = h - minH;
            
            if (diff > 0.0) {
                // Erode peak
                delta -= diff * 0.2 * simSpeed;
            } else {
                // Deposit (sedimentation)
                delta += 0.001 * simSpeed; 
            }
        }
        
        // 4. SHATTER (Seismic)
        if (activeEffect == 4) {
            float crack = abs(snoise(uv * 20.0));
            if (crack < 0.05) delta -= 0.02 * simSpeed; 
            // Uplift
            if (crack > 0.9) delta += 0.01 * simSpeed;
        }

        // 5. STRATIFY (Terrace)
        if (activeEffect == 5) {
            float steps = 15.0;
            float target = floor(h * steps) / steps;
            delta += (target - h) * simSpeed * 0.1;
        }
        
        // Stability Clamp
        delta = clamp(delta, -0.05, 0.05);
        h += delta;
    }

    gl_FragColor = vec4(clamp(h, 0.0, 1.0), 0.0, 0.0, 1.0);
  }
`;

export const SCULPT_FRAGMENT = `
  uniform sampler2D heightMap;
  uniform vec2 brushPos;
  uniform float brushRadius;
  uniform float brushStrength;
  uniform int mode; // 0=Raise, 1=Lower, 2=Flatten, 3=Noise, 4=Smooth, 5=Terrace, 6=Crater, 7=Sharpen, 8=Pinch, 9=Twist
  uniform float noiseSeed;
  uniform vec2 res;
  
  varying vec2 vUv;

  float rand(vec2 co){ return fract(sin(dot(co.xy ,vec2(12.9898,78.233))) * 43758.5453); }

  void main() {
      vec4 data = texture2D(heightMap, vUv);
      float h = data.r;
      
      float dist = distance(vUv, brushPos);
      
      // Brush Radius is passed in 0..1 UV space here
      if (dist < brushRadius) {
          // Cosine falloff
          float falloff = 0.5 * (1.0 + cos(3.14159 * (dist / brushRadius)));
          float force = brushStrength * falloff * 0.02; // Strength scaling
          float hardForce = brushStrength * falloff; // Stronger for shape brushes

          // 0: RAISE
          if (mode == 0) h += force;
          
          // 1: LOWER
          else if (mode == 1) h -= force;
          
          // 2: FLATTEN (Towards average of area ideally, but here 0.5 or current)
          else if (mode == 2) { 
              float target = 0.5; // Todo: Pass sampled height at brush center?
              h = mix(h, target, force * 5.0); 
          }
          
          // 3: NOISE
          else if (mode == 3) { 
              float n = (rand(vUv * 100.0 + noiseSeed) - 0.5) * 2.0; 
              h += n * force; 
          }

          // 4: SMOOTH (Blur)
          else if (mode == 4) {
              vec2 texel = vec2(1.0/res.x, 1.0/res.y);
              float sum = 0.0;
              sum += texture2D(heightMap, vUv + vec2(-texel.x, 0.0)).r;
              sum += texture2D(heightMap, vUv + vec2(texel.x, 0.0)).r;
              sum += texture2D(heightMap, vUv + vec2(0.0, -texel.y)).r;
              sum += texture2D(heightMap, vUv + vec2(0.0, texel.y)).r;
              float avg = sum * 0.25;
              h = mix(h, avg, force * 10.0);
          }

          // 5: TERRACE (Quantize)
          else if (mode == 5) {
               float steps = 20.0;
               float target = floor(h * steps) / steps;
               h = mix(h, target, force * 10.0);
          }

          // 6: CRATER
          else if (mode == 6) {
              // Normalized distance 0..1
              float d = dist / brushRadius;
              // Crater profile: -1 at center, +0.5 at rim (d~0.7), 0 at 1.0
              float shape = -1.0 * exp(-10.0 * d * d) + 0.5 * exp(-10.0 * (d - 0.7) * (d - 0.7));
              h += shape * hardForce * 0.05;
          }

          // 7: SHARPEN (Contrast/Inverse Smooth)
          else if (mode == 7) {
              vec2 texel = vec2(1.0/res.x, 1.0/res.y);
              float sum = 0.0;
              sum += texture2D(heightMap, vUv + vec2(-texel.x, 0.0)).r;
              sum += texture2D(heightMap, vUv + vec2(texel.x, 0.0)).r;
              sum += texture2D(heightMap, vUv + vec2(0.0, -texel.y)).r;
              sum += texture2D(heightMap, vUv + vec2(0.0, texel.y)).r;
              float avg = sum * 0.25;
              float diff = h - avg;
              h += diff * force * 20.0; // Exaggerate difference
          }

          // 8: PINCH (Warp UV towards center)
          else if (mode == 8) {
              // Calculate displacement vector towards center
              vec2 dir = brushPos - vUv;
              // Warp strength depends on distance (bell curve)
              float warp = -0.5 * (cos(3.14159 * (dist / brushRadius)) + 1.0);
              vec2 offset = dir * warp * force * 2.0;
              h = texture2D(heightMap, vUv + offset).r;
          }

          // 9: TWIST (Rotate UV around center)
          else if (mode == 9) {
              float angle = force * 10.0 * (1.0 - (dist / brushRadius));
              float s = sin(angle);
              float c = cos(angle);
              vec2 dir = vUv - brushPos;
              vec2 rotated = vec2(dir.x * c - dir.y * s, dir.x * s + dir.y * c);
              h = texture2D(heightMap, brushPos + rotated).r;
          }
      }
      
      gl_FragColor = vec4(clamp(h, 0.0, 1.0), data.gba);
  }
`;

export const RENDER_VERTEX = `
  uniform sampler2D heightMap;
  uniform float heightScale;
  varying float vHeight;
  varying vec2 vUv;
  varying vec3 vWorldPosition;
  varying vec3 vViewPosition;

  void main() {
    vUv = uv;
    vec4 heightData = texture2D(heightMap, uv);
    vHeight = heightData.r;
    
    vec3 newPosition = position;
    
    // CORRECTION: PlaneGeometry is rotated -90 on X to be flat.
    // The vertex attribute 'position' (local space) still has Z=0 and varies X,Y.
    // However, when we want to displace it 'up' in World Space (which is World Y),
    // we must displace along the LOCAL axis that corresponds to World Y.
    // 
    // If geometry.rotateX(-PI/2) was applied CPU side, vertices are:
    // (x, 0, -y). The Normal is (0, 1, 0).
    // So we must displace Y.
    
    newPosition.y += vHeight * heightScale;
    
    vec4 worldPosition = modelMatrix * vec4(newPosition, 1.0);
    vWorldPosition = worldPosition.xyz;
    
    vec4 mvPosition = viewMatrix * worldPosition;
    vViewPosition = -mvPosition.xyz;
    gl_Position = projectionMatrix * mvPosition;
  }
`;

export const RENDER_FRAGMENT = `
  uniform sampler2D albedoMap;
  uniform bool useAlbedoMap;
  uniform float detailScale;
  uniform float detailStrength;
  uniform int viewMode;
  uniform vec3 sunDir;
  uniform float sunIntensity;
  
  varying float vHeight;
  varying vec2 vUv;
  varying vec3 vWorldPosition;
  varying vec3 vViewPosition;

  // Modern Dark/High-Contrast Palette
  vec3 colDarkBase = vec3(0.02, 0.02, 0.03);
  vec3 colMid = vec3(0.2, 0.2, 0.25);
  vec3 colHigh = vec3(0.8, 0.8, 0.9);

  // Neon Palette (Cyber)
  vec3 colDeep   = vec3(0.0, 0.02, 0.05); 
  vec3 colGrid   = vec3(0.0, 0.2, 0.2);   
  vec3 colNeon   = vec3(0.0, 1.0, 0.8);   
  vec3 colHot    = vec3(1.0, 0.0, 0.5);   

  // GIS
  vec3 heatStart = vec3(0.0, 1.0, 0.0); 
  vec3 heatEnd = vec3(1.0, 0.0, 0.0);   

  float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }

  void main() {
    vec3 x = dFdx(vWorldPosition);
    vec3 y = dFdy(vWorldPosition);
    vec3 normal = normalize(cross(x, y));
    float slope = 1.0 - normal.y;

    vec3 finalColor = vec3(0.0);

    // MODE 0: DARK MATTER (Standard)
    if (viewMode == 0) {
        if (!useAlbedoMap) {
            // Dark base with highlights on peaks
            finalColor = mix(colDarkBase, colMid, vHeight * 1.2);
            finalColor = mix(finalColor, colHigh, smoothstep(0.7, 1.0, vHeight));
            
            // Subtle noise
            float n = hash(vUv * 500.0) * 0.05;
            finalColor += n;
        } else {
            finalColor = texture2D(albedoMap, vUv).rgb;
        }
        
        vec3 lightDir = normalize(sunDir);
        float diff = max(dot(normal, lightDir), 0.0);
        
        // High contrast lighting
        finalColor = finalColor * (0.1 + diff * sunIntensity);
    }

    // MODE 1: NEON CYBERPUNK
    if (viewMode == 1) { 
        // Grid effect
        float gridX = step(0.98, fract(vUv.x * 50.0));
        float gridY = step(0.98, fract(vUv.y * 50.0));
        float grid = max(gridX, gridY) * 0.3;

        if (!useAlbedoMap) {
            if(vHeight < 0.1) finalColor = colDeep;
            else if(vHeight < 0.4) finalColor = mix(colDeep, colGrid, smoothstep(0.1, 0.4, vHeight));
            else if(vHeight < 0.8) finalColor = mix(colGrid, colNeon, smoothstep(0.4, 0.8, vHeight));
            else finalColor = mix(colNeon, colHot, smoothstep(0.8, 1.0, vHeight));
            
            finalColor += grid * colNeon;
        } else {
            finalColor = texture2D(albedoMap, vUv).rgb * vec3(0.5, 1.0, 1.0); // Tint cyan
        }

        vec3 lightDir = normalize(sunDir);
        float diff = max(dot(normal, lightDir), 0.0);
        float spec = pow(max(dot(normal, normalize(sunDir + normalize(vViewPosition))), 0.0), 16.0);
        
        finalColor = finalColor * (0.2 + diff * sunIntensity) + spec * sunIntensity * 0.8;
    }

    // MODE 2: SLOPE HEATMAP
    if (viewMode == 2) { 
        finalColor = mix(heatStart, heatEnd, slope * 2.0);
    }

    // MODE 3: CONTOUR
    if (viewMode == 3) { 
        float lines = fract(vHeight * 30.0);
        float thickness = 0.05;
        float edge = step(thickness, lines) - step(1.0-thickness, lines);
        vec3 terrainCol = mix(vec3(0.05), vec3(0.2), vHeight);
        finalColor = mix(vec3(0.0, 1.0, 0.5), terrainCol, edge); 
    }

    gl_FragColor = vec4(finalColor, 1.0);
  }
`;

export const CURSOR_VERTEX = `
  uniform sampler2D heightMap;
  uniform float heightScale;
  varying vec2 vUv;
  void main() {
    vUv = uv;
    vec4 hData = texture2D(heightMap, uv);
    float h = hData.r;
    vec3 newPos = position;
    // Displace Y to match Terrain's Y displacement
    newPos.y += h * heightScale + 5.0; 
    gl_Position = projectionMatrix * modelViewMatrix * vec4(newPos, 1.0);
  }
`;

export const CURSOR_FRAGMENT = `
  uniform vec3 color;
  uniform float opacity;
  void main() {
    gl_FragColor = vec4(color, opacity);
  }
`;
