
import React, { useState, useEffect, useRef } from 'react';
import {
  Activity, Zap, Download, Settings2, Wind, Box, 
  Sparkles, Palette, Layers, Minimize2, Flame, 
  RotateCcw, Camera, Video, Terminal, 
  Waves, AlertTriangle, Play, Pause, Disc, 
  Monitor, Eye, Hexagon, Image as ImageIcon, Upload, 
  Atom, Infinity as InfinityIcon, Microscope, CircleDot, FileJson, Cpu, Grid, 
  Loader2, Package, Archive, FileText, Maximize, 
  ScanLine, Music, Sliders, Network, Droplet, Binary, 
  Tornado, Heart, ListPlus, Trash2, X, ChevronDown, ChevronRight, 
  Code, Database, Anchor, Save, Aperture, Film, StopCircle, Volume2,
  RefreshCw, Orbit
} from 'lucide-react';
import { useZenControlBindings, useZenModuleBridge, useZenWorkspaceStore } from '../../../core/zen';
import {
  buildChronoQuantumStatePatch,
  CHRONO_QUANTUM_FIELD_LAYER_ID,
  CHRONO_QUANTUM_FIELD_LAYER_NAME,
  CHRONO_QUANTUM_MODULE_IDS,
  ChronoQuantumModuleId,
  coerceChronoQuantumState,
  getChronoQuantumModuleLabel,
  readChronoQuantumModuleState
} from '../chronoquantum/chronoQuantumShared';

// --- PHYSICS MODES ---
const PHYSICS_CATEGORIES = {
    COSMIC: [
        { id: 0, label: "ZERO-POINT FIELD", icon: Grid, desc: "Stable energy grid state (Reset)." },
        { id: 3, label: "GALACTIC SPIRAL", icon: Orbit, desc: "Density wave orbital dynamics." }
    ],
    QUANTUM: [
        { id: 12, label: "NEURAL LATTICE", icon: Network, desc: "Synaptic firing patterns." },
        { id: 6, label: "QUANTUM PILOT", icon: Atom, desc: "Bohmian mechanics trajectories." },
        { id: 8, label: "SCHRODINGER WAVE", icon: Microscope, desc: "Probability density collapse." }
    ],
    ELEMENTAL: [
        { id: 20, label: "HELLFIRE", icon: Flame, desc: "Volumetric buoyancy simulation." },
        { id: 21, label: "PLASMA ARC", icon: Zap, desc: "Magnetic flux tubes." },
        { id: 22, label: "SUPER VORTEX", icon: Tornado, desc: "High-velocity cyclonic flow." }
    ],
    OPTICAL: [
        { id: 5, label: "PHOTO-KINESIS", icon: ImageIcon, desc: "Image-based particle reconstruction." },
        { id: 14, label: "DATAMOSH", icon: Binary, desc: "Compression artifact glitching." },
        { id: 10, label: "TESSERACT", icon: Grid, desc: "4D hypercube projection." }
    ],
    HYDRO: [
        { id: 17, label: "NAVIER-STOKES", icon: Waves, desc: "Fluid dynamics coupling." },
        { id: 13, label: "FERROFLUID", icon: Droplet, desc: "Magnetic liquid simulation." },
        { id: 2, label: "TSUNAMI", icon: Wind, desc: "High velocity wave propagation." }
    ]
};

// --- COLOR PALETTES ---
const COLOR_PALETTES: Record<string, string[]> = {
    COSMIC: ['#000000', '#140024', '#4a00e0', '#8e2de2', '#00ffcc'], 
    INFERNO: ['#000000', '#3d0000', '#ff0000', '#ff8800', '#ffff00'], 
    ARCTIC:  ['#000510', '#001433', '#004488', '#00aaff', '#ffffff'], 
    TOXIC:   ['#000000', '#0a1a0a', '#00ff00', '#ccff00', '#ffffff'], 
    NEON:    ['#000000', '#ff00ff', '#0000ff', '#00ffff', '#ffffff']  
};

// --- MODIFIERS ---
const MODIFIER_CONFIG = {
    RHYTHMIC: [
        { id: 'heartbeat', name: 'Heartbeat', icon: Heart, params: { bpm: { val: 60, min: 30, max: 200, step: 1 }, intensity: { val: 2.0, min: 0, max: 10, step: 0.1 } } },
        { id: 'seismic', name: 'Seismic', icon: Activity, params: { scale: { val: 1.0, min: 0, max: 5, step: 0.1 }, freq: { val: 2.0, min: 0.1, max: 10, step: 0.1 } } }
    ],
    FORCES: [
        { id: 'helix', name: 'Helix Twist', icon: Tornado, params: { speed: { val: 1.0, min: -5, max: 5, step: 0.1 }, tightness: { val: 0.1, min: 0.01, max: 1.0, step: 0.01 } } },
        { id: 'gravity', name: 'Gravity Well', icon: Anchor, params: { force: { val: 5.0, min: -20, max: 20, step: 0.5 }, radius: { val: 10.0, min: 1, max: 50, step: 1 } } }
    ]
};

// --- SHADERS ---
const SIM_VERTEX = `varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position, 1.0); }`;

const FLUID_ADVECT = `uniform sampler2D velocityTex; uniform sampler2D sourceTex; uniform float dt; uniform float dissipation; varying vec2 vUv; void main() { vec2 coord = vUv - dt * texture2D(velocityTex, vUv).xy * 0.01; gl_FragColor = texture2D(sourceTex, coord) * dissipation; }`;
const FLUID_DIV = `uniform sampler2D velocityTex; varying vec2 vUv; void main() { float w = 1.0/128.0; float L = texture2D(velocityTex, vUv - vec2(w, 0.0)).x; float R = texture2D(velocityTex, vUv + vec2(w, 0.0)).x; float T = texture2D(velocityTex, vUv + vec2(0.0, w)).y; float B = texture2D(velocityTex, vUv - vec2(0.0, w)).y; float div = 0.5 * (R - L + T - B); gl_FragColor = vec4(div, 0.0, 0.0, 1.0); }`;
const FLUID_PRESS = `uniform sampler2D pressureTex; uniform sampler2D divergenceTex; varying vec2 vUv; void main() { float w = 1.0/128.0; float L = texture2D(pressureTex, vUv - vec2(w, 0.0)).x; float R = texture2D(pressureTex, vUv + vec2(w, 0.0)).x; float T = texture2D(pressureTex, vUv + vec2(0.0, w)).x; float B = texture2D(pressureTex, vUv - vec2(0.0, w)).x; float div = texture2D(divergenceTex, vUv).x; float p = (L + R + T + B - div) * 0.25; gl_FragColor = vec4(p, 0.0, 0.0, 1.0); }`;
const FLUID_GRAD = `uniform sampler2D pressureTex; uniform sampler2D velocityTex; varying vec2 vUv; void main() { float w = 1.0/128.0; float L = texture2D(pressureTex, vUv - vec2(w, 0.0)).x; float R = texture2D(pressureTex, vUv + vec2(w, 0.0)).x; float T = texture2D(pressureTex, vUv + vec2(0.0, w)).x; float B = texture2D(pressureTex, vUv - vec2(0.0, w)).x; vec2 v = texture2D(velocityTex, vUv).xy; v -= vec2(R - L, T - B); gl_FragColor = vec4(v, 0.0, 1.0); }`;
const FLUID_SPLAT = `uniform sampler2D targetTex; uniform vec2 point; uniform vec3 color; uniform float radius; varying vec2 vUv; void main() { vec2 p = vUv - point.xy; vec3 splat = exp(-dot(p, p) / radius) * color; vec3 base = texture2D(targetTex, vUv).xyz; gl_FragColor = vec4(base + splat, 1.0); }`;

const VELOCITY_TEMPLATE = `
  uniform sampler2D velocityTexture; uniform sampler2D positionTexture; uniform sampler2D fluidTexture; uniform sampler2D originTexture;
  uniform vec3 mousePos; uniform float time; uniform float speed; uniform float chaos; uniform int mode;
  uniform float audioLevel; uniform float audioBass; uniform float audioHigh;
  uniform float uDamping; // FRICTION CONTROL
  
  uniform float uHeartbeatActive; uniform float uHeartbeatBPM; uniform float uHeartbeatIntensity;
  uniform float uHelixActive; uniform float uHelixSpeed; uniform float uHelixTightness;
  uniform float uSeismicActive; uniform float uSeismicScale; uniform float uSeismicFreq;
  uniform float uGravityActive; uniform float uGravityForce; uniform float uGravityRadius;

  varying vec2 vUv;

  vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; } vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; } vec3 permute(vec3 x) { return mod289(((x*34.0)+1.0)*x); }
  float snoise(vec2 v) { const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439); vec2 i = floor(v + dot(v, C.yy) ); vec2 x0 = v - i + dot(i, C.xx); vec2 i1; i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0); vec4 x12 = x0.xyxy + C.xxzz; x12.xy -= i1; i = mod289(i); vec3 p = permute( permute( i.y + vec3(0.0, i1.y, 1.0 )) + i.x + vec3(0.0, i1.x, 1.0 )); vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0); m = m*m ; m = m*m ; vec3 x = 2.0 * fract(p * C.www) - 1.0; vec3 h = abs(x) - 0.5; vec3 ox = floor(x + 0.5); vec3 a0 = x - ox; m *= 1.79284291400159 - 0.85373472095314 * ( a0*a0 + h*h ); vec3 g; g.x = a0.x * x0.x + h.x * x0.y; g.yz = a0.yz * x12.xz + h.yz * x12.yw; return 130.0 * dot(m, g); }
  vec3 curl(float x, float y, float z) { float eps = 0.1; float n1 = snoise(vec2(x, y)); float n2 = snoise(vec2(y, z)); float n3 = snoise(vec2(z, x)); return vec3(n2 - n3, n3 - n1, n1 - n2); }
  float rand(vec2 co){ return fract(sin(dot(co.xy ,vec2(12.9898,78.233))) * 43758.5453); }

  vec3 applyCustomScripts(vec3 p, vec3 v, float t) {
      vec3 force = vec3(0.0);
      //_USER_CODE_INJECTION_
      return force;
  }

  void main() {
    vec2 uv = vUv; 
    vec3 pos = texture2D(positionTexture, uv).xyz; 
    vec3 vel = texture2D(velocityTexture, uv).xyz;
    vec3 origin = texture2D(originTexture, uv).xyz;
    
    // KINETIX STACK
    if (uHeartbeatActive > 0.5) { float beatT = mod(time * (uHeartbeatBPM / 60.0), 1.0); float pulse = 0.0; if(beatT<0.1) pulse=sin(beatT*31.4); else if(beatT<0.3&&beatT>0.1) pulse=-0.5; vel += normalize(pos) * pulse * uHeartbeatIntensity * 0.2; }
    if (uHelixActive > 0.5) { vec3 up = vec3(0,1,0); vec3 tan = cross(normalize(pos), up); float tq = sin(pos.y * uHelixTightness + time * uHelixSpeed); vel += tan * tq * 0.1; vel -= normalize(pos) * 0.05 * abs(tq); }
    if (uSeismicActive > 0.5) { float s = snoise(vec2(time * uSeismicFreq, pos.x*0.01)); vel.y += s * uSeismicScale * 0.05; }
    if (uGravityActive > 0.5) { float d = length(pos); if(d < uGravityRadius) { vel -= normalize(pos) * (uGravityForce / (d*d+0.1)) * 0.5; } }
    
    // AUDIO REACTIVITY
    if (audioBass > 0.05) { vec3 centerDir = normalize(pos); vel += centerDir * audioBass * 0.8 * chaos; vel += cross(centerDir, vec3(0,1,0)) * audioBass * 0.4; }

    // MODE 0: ZERO-POINT (Reset/Stable)
    if (mode == 0) {
        vec3 diff = origin - pos;
        vel += diff * 0.1 * speed; // Spring force to origin
        vel += curl(pos.x * 0.05, pos.y * 0.05, time * 0.1) * chaos * 0.05;
        vel *= uDamping;
        gl_FragColor = vec4(vel, 1.0);
        return;
    }

    // MODE 3: GALACTIC SPIRAL
    if (mode == 3) {
        vec3 d = pos; d.y *= 2.0; // Flatten galaxy
        float r = length(d.xz);
        float angle = atan(d.z, d.x);
        float spiral = 3.0 * log(r + 1.0);
        float phase = angle + spiral;
        float dens = cos(phase * 2.0 - time * speed * 0.5);
        
        vec3 tan = cross(vec3(0,1,0), normalize(d));
        float orb = 10.0 * speed / sqrt(r + 0.1);
        
        vel += (tan * orb - vel) * 0.05; // Orbital entrainment
        vel -= normalize(d) * (5.0 / (r*r+1.0)); // Central gravity
        vel += curl(pos.x*0.1, pos.y*0.1, time*0.5) * chaos * 0.2;
        
        vel *= uDamping;
        gl_FragColor = vec4(vel, 1.0);
        return;
    }

    // MODE 5: PHOTO-KINESIS (Kaleidoscope)
    if (mode == 5) {
       vec3 target = vec3((uv.x - 0.5) * 60.0, (uv.y - 0.5) * 60.0, 0.0); 
       vel += (target - pos) * 0.05 * speed + curl(pos.x*0.1, pos.y*0.1, time*0.5) * 0.05 * chaos;
       vel *= uDamping;
       gl_FragColor = vec4(vel, 1.0); return;
    }

    // ELEMENTAL MODES
    if (mode == 20) { // Hellfire
       vel.y += 0.5 * speed; 
       if (pos.y < -10.0) { vel.x -= pos.x * 0.05; vel.z -= pos.z * 0.05; }
       vel += curl(pos.x * 0.1, pos.y * 0.1 + time * 2.0, pos.z * 0.1) * 0.5 * chaos;
       vel *= uDamping; gl_FragColor = vec4(vel, 1.0); return;
    }
    if (mode == 21) { // Plasma Arc
       vec3 center = vec3(0.0); vec3 dir = center - pos;
       vec3 tangent = cross(normalize(dir), vec3(0,1,0));
       vel += normalize(dir) * 0.5 * speed; 
       vel += tangent * 1.0 * speed;        
       vel += curl(pos.x * 0.5, pos.y * 0.5, time * 5.0) * 2.0 * chaos;
       vel *= uDamping; gl_FragColor = vec4(vel, 1.0); return;
    }
    if (mode == 22) { // Super Vortex
       float twist = pos.y * 0.1;
       vec3 flow = curl(pos.x * 0.1 + twist, pos.y * 0.05, pos.z * 0.1 + twist);
       vel.y += 0.1 * speed;
       vec3 centerDir = -normalize(vec3(pos.x, 0.0, pos.z));
       vec3 spin = cross(centerDir, vec3(0,1,0));
       vel += spin * 2.0 * speed; vel += centerDir * 0.5; 
       vel += flow * chaos;
       vel *= uDamping; gl_FragColor = vec4(vel, 1.0); return;
    }

    // SPECIAL MODES
    if (mode == 17) { 
        vec2 fUV = (pos.xy+40.0)/80.0; 
        if(fUV.x>0.0&&fUV.x<1.0&&fUV.y>0.0&&fUV.y<1.0) { 
            vec3 f = texture2D(fluidTexture, fUV).xyz; 
            vel += f * 5.0 * speed; 
            vel += curl(pos.x*0.2, pos.y*0.2, pos.z*0.2)*0.5*chaos; 
        } 
        vel *= uDamping; gl_FragColor = vec4(vel, 1.); return; 
    }
    
    // K-SCRIPT
    vel += applyCustomScripts(pos, vel, time) * 0.05;

    // STANDARD MODES
    if (mode == 14) { float g = 2.0 + audioHigh * 5.0; vec3 q = floor(pos/g)*g; vel += (q-pos)*0.5*speed; if(chaos>0.5) vel += curl(pos.x,pos.y,time)*chaos*2.0; vel*=0.85; gl_FragColor=vec4(vel,1.); return; }
    if (mode == 13) { float s = pow(abs(sin(pos.x*0.5)*sin(pos.y*0.5)*sin(pos.z*0.5)), 4.0)*50.0; vel += (-normalize(pos))*0.5*speed + normalize(pos)*s*0.05*chaos + curl(pos.x*0.1,pos.y*0.1,time)*0.1; vel*=0.92; gl_FragColor=vec4(vel,1.); return; }
    if (mode == 12) { vec3 p = curl(pos.x*0.1, pos.y*0.1, pos.z*0.1); vec3 m = curl(pos.x*0.5, pos.y*0.5, pos.z*0.5); vel += p*0.2*speed + m*0.05*chaos; if(length(pos)>40.0) vel -= normalize(pos); vel*=0.96; gl_FragColor=vec4(vel,1.); return; }
    
    // Fallback Logic
    float dist = distance(pos.xy, mousePos.xy);
    if(mode != 11 && mode != 5 && dist < 10.0 && mousePos.z != 0.0) vel += normalize(pos - mousePos) * 1.0;
    
    if(mode == 11) { vec3 t = texture2D(originTexture, uv).xyz; vec3 diff = t - pos; float jitter = audioHigh * 3.0; vel += diff * (0.08 + audioLevel * 0.05) * speed; vel += curl(t.x, t.y, time) * (0.15 + jitter) * chaos; vel *= 0.94; gl_FragColor = vec4(vel, 1.0); return; }
    
    vel *= uDamping;
    gl_FragColor = vec4(vel, 1.0);
  }
`;

const POSITION_FRAGMENT = `
  uniform sampler2D positionTexture; uniform sampler2D velocityTexture; uniform sampler2D originTexture; 
  uniform float time; uniform float dt; uniform int mode; varying vec2 vUv;
  float rand(vec2 co){ return fract(sin(dot(co.xy ,vec2(12.9898,78.233))) * 43758.5453); }
  void main() {
    vec2 uv = vUv; vec3 pos = texture2D(positionTexture, uv).xyz; vec3 vel = texture2D(velocityTexture, uv).xyz; vec3 origin = texture2D(originTexture, uv).xyz;
    pos += vel * dt; float life = texture2D(positionTexture, uv).w - 0.005 * (1.0 + rand(uv)*0.5);
    bool respawn = false; if(life <= 0.0 || length(pos) > 100.0) respawn = true;
    
    // Special respawn bounds
    if (mode == 5) { life = 1.0; } // Photo-Kinesis persistent
    if (mode == 0) { respawn = false; life = 1.0; } // Zero Point Stable
    
    if(respawn) {
        life = 1.0;
        if(mode==11 || mode==0) pos = origin;
        else if(mode==5) pos = (vec3(rand(uv), rand(uv+0.1), 0.0)-0.5)*60.0;
        else if(mode==3) { 
             float angle = rand(uv + time) * 6.28;
             float r = 2.0 + rand(uv + time + 1.0) * 40.0;
             pos = vec3(cos(angle)*r, (rand(uv)-0.5)*2.0, sin(angle)*r);
        }
        else if(mode==17) pos = (vec3(rand(uv), rand(uv+0.1), 0.0)-0.5)*80.0;
        else pos = (vec3(rand(uv), rand(uv+1.0), rand(uv+2.0))-0.5)*60.0;
    }
    gl_FragColor = vec4(pos, life);
  }
`;

const RENDER_VERT = `
  uniform sampler2D positionTexture; uniform sampler2D velocityTexture; uniform float pixelRatio; uniform float sizeMult; uniform float audioLevel;
  attribute vec2 reference; varying float vLife; varying float vSpeed; varying vec3 vVel; varying vec2 vUv; varying vec3 vPos;
  void main() {
    vUv = reference;
    vec4 posData = texture2D(positionTexture, reference); vec3 pos = posData.xyz; vLife = posData.w; vPos = pos;
    vec3 vel = texture2D(velocityTexture, reference).xyz; vSpeed = length(vel); vVel = vel;
    vec4 mv = viewMatrix * modelMatrix * vec4(pos, 1.0); gl_Position = projectionMatrix * mv;
    float boost = 1.0 + audioLevel * 3.0;
    // RAW GEO FIX: Hard clamp, no blur scaling
    gl_PointSize = clamp((14.0 * pixelRatio * sizeMult * boost * vLife) * (50.0 / -mv.z), 1.0, 50.0);
  }
`;

const RENDER_FRAG = `
  varying float vLife; varying float vSpeed; varying vec3 vVel; varying vec2 vUv; varying vec3 vPos;
  uniform vec3 color; uniform int colorMode; uniform bool forceDoppler; uniform sampler2D imageTexture; uniform bool useImageColor; uniform sampler2D paletteTexture; uniform float opacityFactor;
  void main() {
    // RAW GEO FIX: No soft circle. Hard cut.
    vec2 c = 2.0 * gl_PointCoord - 1.0; 
    if(dot(c,c) > 1.0) discard;

    vec3 fC = color;
    
    if(colorMode == 1) { 
        float t = clamp(vSpeed * 0.05, 0.0, 1.0);
        fC = texture2D(paletteTexture, vec2(t, 0.5)).rgb;
    } 
    
    if(colorMode == 3) { 
        vec3 nPos = normalize(vPos) * 0.5 + 0.5;
        fC = nPos;
    }

    if(colorMode == 2) { 
        if(useImageColor) {
            fC = texture2D(imageTexture, vUv).rgb;
        } else {
            fC = color; 
        }
    } 
    
    if(forceDoppler && (colorMode != 2 || !useImageColor)) { float shift = dot(normalize(vVel), vec3(0,0,1)); fC += vec3(0.5, 0.2, 0.2) * shift; }
    gl_FragColor = vec4(fC, vLife * opacityFactor);
  }
`;

const FEEDBACK_FRAGMENT = `
  uniform sampler2D tDiffuse; uniform sampler2D tPrev; uniform float decay; uniform float aberration; uniform float distortion;
  varying vec2 vUv;
  void main() {
    vec2 uv = vUv;
    vec2 center = uv - 0.5;
    uv = center * (1.0 - distortion * dot(center, center)) + 0.5;
    
    if(uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) { gl_FragColor = vec4(0.0); return; }

    vec4 newFrame = texture2D(tDiffuse, uv);
    
    vec2 offset = (newFrame.rg - 0.5) * 0.01 * aberration;
    float r = texture2D(tPrev, uv - offset).r;
    float g = texture2D(tPrev, uv).g;
    float b = texture2D(tPrev, uv + offset).b;
    
    vec3 trail = vec3(r, g, b) * min(decay, 0.95); // Clamp decay to prevent whiteout
    gl_FragColor = vec4(max(newFrame.rgb, trail), 1.0);
  }
`;

// --- UTILS ---
const loadScript = (src: string) => new Promise(r => { const s = document.createElement('script'); s.src=src; s.onload=() => r(true); document.body.appendChild(s); });
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
const formatTime = (s: number) => {
    const m = Math.floor(s/60);
    const sec = Math.floor(s%60);
    return `${m}:${sec<10?'0':''}${sec}`;
};

// --- PALETTE GENERATOR ---
const generatePaletteTexture = (colors: string[]) => {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 1;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    const grd = ctx.createLinearGradient(0, 0, 256, 0);
    colors.forEach((c, i) => grd.addColorStop(i / (colors.length - 1), c));
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, 256, 1);
    const texture = new window.THREE.CanvasTexture(canvas);
    texture.minFilter = window.THREE.NearestFilter;
    texture.magFilter = window.THREE.NearestFilter;
    return texture;
};

interface KQuantumProps {
    sharedState?: any;
    zenShellMode?: 'standalone' | 'viewport-host' | 'tool-overlay';
    moduleId?: ChronoQuantumModuleId;
    moduleLabel?: string;
}

export default function KQuantum({
    sharedState,
    zenShellMode = 'standalone',
    moduleId = 'quantum',
    moduleLabel
}: KQuantumProps) {
    const { connectViewport, publishLayers, publishState, publishSelection } = useZenModuleBridge(moduleId);
    const zenModuleState = useZenWorkspaceStore((state) => state.document.moduleState);
    const setZenModuleState = useZenWorkspaceStore((state) => state.setModuleState);
    const chronoQuantumState = coerceChronoQuantumState(readChronoQuantumModuleState(zenModuleState));
    const resolvedModuleLabel = moduleLabel ?? getChronoQuantumModuleLabel(moduleId);
    const exportPrefix = resolvedModuleLabel.replace(/[^A-Z0-9-]+/g, '_');
    const isViewportHost = zenShellMode === 'viewport-host';
    const isToolOverlay = zenShellMode === 'tool-overlay';
    const [status, setStatus] = useState(`${resolvedModuleLabel} NAVIER`);
    const [activeTab, setActiveTab] = useState('sim'); 
    const [rightTab, setRightTab] = useState('optics'); 
    
    // Config
    const [simRes, setSimRes] = useState(chronoQuantumState.simRes); 
    const [mode, setMode] = useState(chronoQuantumState.mode); 
    const [speed, setSpeed] = useState(chronoQuantumState.speed);
    const [chaos, setChaos] = useState(chronoQuantumState.chaos);
    const [damping, setDamping] = useState(chronoQuantumState.damping);
    const [colorHex, setColorHex] = useState(chronoQuantumState.colorHex); 
    const [colorMode, setColorMode] = useState(chronoQuantumState.colorMode); 
    const [pointSize, setPointSize] = useState(chronoQuantumState.pointSize);
    const [doppler, setDoppler] = useState(chronoQuantumState.doppler);
    const [useImageColor, setUseImageColor] = useState(chronoQuantumState.useImageColor);
    const [activePalette, setActivePalette] = useState(chronoQuantumState.activePalette);

    // Optics
    const [aberration, setAberration] = useState(chronoQuantumState.aberration);
    const [distortion, setDistortion] = useState(chronoQuantumState.distortion);
    const [decay, setDecay] = useState(chronoQuantumState.decay);

    // K-Script
    const [scripts, setScripts] = useState<any[]>(chronoQuantumState.scripts); 
    const [newScript, setNewScript] = useState(chronoQuantumState.newScript);

    // Modifiers & Audio
    const [activeModifiers, setActiveModifiers] = useState<string[]>(chronoQuantumState.activeModifiers);
    const [modParams, setModParams] = useState<any>(chronoQuantumState.modParams);
    const [audioFile, setAudioFile] = useState<string|null>(chronoQuantumState.audioFile);
    const [isPlaying, setIsPlaying] = useState(chronoQuantumState.isPlaying);
    const [bassSens, setBassSens] = useState(chronoQuantumState.bassSens);
    const [highSens, setHighSens] = useState(chronoQuantumState.highSens);
    const [audioVolume, setAudioVolume] = useState(chronoQuantumState.audioVolume);
    const [audioSmoothing, setAudioSmoothing] = useState(chronoQuantumState.audioSmoothing);
    const [audioCurrentTime, setAudioCurrentTime] = useState(0);
    const [audioDuration, setAudioDuration] = useState(0);

    // Export State
    const [recResolution, setRecResolution] = useState('WINDOW');
    const [isRecording, setIsRecording] = useState(false);
    const [isVAT, setIsVAT] = useState(false);
    const [isSeq, setIsSeq] = useState(false);
    const [procProgress, setProcProgress] = useState(0);

    // Refs
    const mountRef = useRef<HTMLDivElement>(null);
    const engine = useRef<any>({ 
        scene: null, camera: null, renderer: null, controls: null,
        fbo: null, mats: null, 
        mouse: null,
        lastMouse: null,
        mouseDown: false,
        vatFrames: [],
        audioCtx: null, analyser: null, audioData: null, audioSrc: null, audioEl: null,
        screenA: null, screenB: null, finalQuad: null, fullScreenScene: null,
        paletteTex: null,
        // Optional placeholders for props added later
        simScene: null, simCam: null, quad: null, points: null, THREE: null,
        initPosTex: null, initVelTex: null, fullScreenCam: null, isVAT: false, isSeq: false
    });
    const mediaRecorderRef = useRef<MediaRecorder|null>(null);
    const chunksRef = useRef<Blob[]>([]);
    const vatRef = useRef<any[]>([]);

    useEffect(() => {
        publishLayers([
            {
                id: CHRONO_QUANTUM_FIELD_LAYER_ID,
                name: CHRONO_QUANTUM_FIELD_LAYER_NAME,
                order: 0,
                tags: ['sim']
            }
        ]);
    }, [publishLayers]);

    useEffect(() => {
        publishState({
            status,
            simRes,
            mode,
            isPlaying
        });
    }, [isPlaying, mode, publishState, simRes, status]);

    useEffect(() => {
        if (isToolOverlay) {
            return;
        }

        publishSelection({
            activeAssetId: sharedState?.activeArtifactId ?? null,
            activeLayerId: CHRONO_QUANTUM_FIELD_LAYER_ID
        });
    }, [isToolOverlay, publishSelection, sharedState?.activeArtifactId]);

    useEffect(() => {
        const sharedPatch = buildChronoQuantumStatePatch({
            simRes,
            mode,
            speed,
            chaos,
            damping,
            colorHex,
            colorMode,
            pointSize,
            doppler,
            useImageColor,
            activePalette,
            aberration,
            distortion,
            decay,
            scripts,
            newScript,
            activeModifiers,
            modParams,
            audioFile,
            isPlaying,
            bassSens,
            highSens,
            audioVolume,
            audioSmoothing
        });

        CHRONO_QUANTUM_MODULE_IDS.forEach((targetModuleId) => {
            setZenModuleState(targetModuleId, sharedPatch);
        });
    }, [
        aberration,
        activeModifiers,
        activePalette,
        audioFile,
        audioSmoothing,
        audioVolume,
        bassSens,
        chaos,
        colorHex,
        colorMode,
        damping,
        decay,
        distortion,
        doppler,
        highSens,
        isPlaying,
        mode,
        modParams,
        newScript,
        pointSize,
        scripts,
        setZenModuleState,
        simRes,
        speed,
        useImageColor
    ]);

    // --- ENGINE INITIALIZATION ---
    useEffect(() => {
        if (isToolOverlay) return;
        if(!mountRef.current) return;
        let animationFrameId: number;
        let disconnectZenViewport = () => {};

        const init = async () => {
            if(!window.THREE) await loadScript("https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js");
            if(!window.JSZip) await loadScript("https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js");
            if(!window.THREE.OrbitControls) await loadScript("https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js");
            if(!window.THREE.GLTFExporter) await loadScript("https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/exporters/GLTFExporter.js");
            if(!window.THREE.OBJExporter) await loadScript("https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/exporters/OBJExporter.js");
            
            const THREE = window.THREE;
            // Initialize vectors here safely
            engine.current.mouse = new THREE.Vector3();
            engine.current.lastMouse = new THREE.Vector2();

            const w = mountRef.current!.clientWidth;
            const h = mountRef.current!.clientHeight;
            const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false, preserveDrawingBuffer: true });
            renderer.setSize(w, h);
            renderer.setClearColor(0x000000, 1);
            mountRef.current!.innerHTML = '';
            mountRef.current!.appendChild(renderer.domElement);

            const scene = new THREE.Scene();
            const camera = new THREE.PerspectiveCamera(60, w/h, 0.1, 1000);
            camera.position.set(0, 30, 60);
            const controls = new THREE.OrbitControls(camera, renderer.domElement);
            controls.enableDamping = true;
            controls.autoRotate = false; // DISABLED PER SPEC
            controls.autoRotateSpeed = 0.5;
            disconnectZenViewport = connectViewport({
                element: mountRef.current,
                scene,
                camera,
                controls,
                renderer
            });

            const fullScreenScene = new THREE.Scene();
            const fullScreenCam = new THREE.OrthographicCamera(-1,1,1,-1,0,1);
            const screenA = new THREE.WebGLRenderTarget(w, h, { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter });
            const screenB = new THREE.WebGLRenderTarget(w, h, { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter });
            
            const feedbackMat = new THREE.ShaderMaterial({
                uniforms: {
                    tDiffuse: { value: null }, tPrev: { value: null },
                    decay: { value: 0.9 }, aberration: { value: 0.0 }, distortion: { value: 0.0 }
                },
                vertexShader: SIM_VERTEX, fragmentShader: FEEDBACK_FRAGMENT
            });
            const finalQuad = new THREE.Mesh(new THREE.PlaneGeometry(2,2), feedbackMat);
            fullScreenScene.add(finalQuad);

            const type = THREE.FloatType;
            const createTarget = (sz: number) => new THREE.WebGLRenderTarget(sz, sz, { type, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, format: THREE.RGBAFormat });

            const fbo = {
                pos: { A: createTarget(simRes), B: createTarget(simRes) },
                vel: { A: createTarget(simRes), B: createTarget(simRes) },
                fluid: { A: createTarget(128), B: createTarget(128) },
                div: createTarget(128),
                press: { A: createTarget(128), B: createTarget(128) }
            };

            const pData = new Float32Array(simRes*simRes*4);
            const vData = new Float32Array(simRes*simRes*4);
            for(let i=0; i<simRes*simRes; i++) {
                const i4 = i*4;
                pData[i4] = (Math.random()-0.5)*50; pData[i4+1] = (Math.random()-0.5)*50; pData[i4+2] = (Math.random()-0.5)*50; pData[i4+3] = Math.random(); 
                vData[i4] = 0; vData[i4+1] = 0; vData[i4+2] = 0; vData[i4+3] = 1;
            }
            const initPosTex = new THREE.DataTexture(pData, simRes, simRes, THREE.RGBAFormat, type);
            initPosTex.needsUpdate = true;
            const initVelTex = new THREE.DataTexture(vData, simRes, simRes, THREE.RGBAFormat, type);
            initVelTex.needsUpdate = true;

            const paletteTex = generatePaletteTexture(COLOR_PALETTES['COSMIC']);

            const mats = {
                vel: new THREE.ShaderMaterial({
                    uniforms: {
                        velocityTexture: { value: null }, positionTexture: { value: null }, fluidTexture: { value: null }, originTexture: { value: initPosTex },
                        time: { value: 0 }, speed: { value: 1.0 }, chaos: { value: 1.0 }, mode: { value: mode }, mousePos: { value: new THREE.Vector3() },
                        uDamping: { value: damping },
                        audioLevel: { value: 0 }, audioBass: { value: 0 }, audioHigh: { value: 0 },
                        uHeartbeatActive: { value: 0 }, uHeartbeatBPM: { value: 60 }, uHeartbeatIntensity: { value: 1 },
                        uHelixActive: { value: 0 }, uHelixSpeed: { value: 1 }, uHelixTightness: { value: 0.1 },
                        uSeismicActive: { value: 0 }, uSeismicScale: { value: 1 }, uSeismicFreq: { value: 2 },
                        uGravityActive: { value: 0 }, uGravityForce: { value: 5 }, uGravityRadius: { value: 10 },
                    },
                    vertexShader: SIM_VERTEX, fragmentShader: VELOCITY_TEMPLATE.replace('//_USER_CODE_INJECTION_', '')
                }),
                pos: new THREE.ShaderMaterial({
                    uniforms: { positionTexture: { value: null }, velocityTexture: { value: null }, originTexture: { value: initPosTex }, dt: { value: 0.016 }, mode: { value: mode }, time: { value: 0 } },
                    vertexShader: SIM_VERTEX, fragmentShader: POSITION_FRAGMENT
                }),
                render: new THREE.ShaderMaterial({
                    uniforms: { 
                        positionTexture: { value: null }, velocityTexture: { value: null }, imageTexture: { value: null },
                        color: { value: new THREE.Color(colorHex) }, pixelRatio: { value: window.devicePixelRatio }, sizeMult: { value: 1.0 }, colorMode: { value: 0 }, forceDoppler: { value: false }, audioLevel: { value: 0 }, useImageColor: { value: true },
                        paletteTexture: { value: paletteTex },
                        opacityFactor: { value: 1.0 }
                    },
                    vertexShader: RENDER_VERT, fragmentShader: RENDER_FRAG,
                    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false
                }),
                fluid: {
                    advect: new THREE.ShaderMaterial({ uniforms: { velocityTex: {value:null}, sourceTex: {value:null}, dt: {value:0.016}, dissipation: {value:0.98} }, vertexShader: SIM_VERTEX, fragmentShader: FLUID_ADVECT }),
                    div: new THREE.ShaderMaterial({ uniforms: { velocityTex: {value:null} }, vertexShader: SIM_VERTEX, fragmentShader: FLUID_DIV }),
                    press: new THREE.ShaderMaterial({ uniforms: { pressureTex: {value:null}, divergenceTex: {value:null} }, vertexShader: SIM_VERTEX, fragmentShader: FLUID_PRESS }),
                    grad: new THREE.ShaderMaterial({ uniforms: { pressureTex: {value:null}, velocityTex: {value:null} }, vertexShader: SIM_VERTEX, fragmentShader: FLUID_GRAD }),
                    splat: new THREE.ShaderMaterial({ uniforms: { targetTex: {value:null}, point: {value: new THREE.Vector2()}, color: {value: new THREE.Vector3()}, radius: {value: 0.002} }, vertexShader: SIM_VERTEX, fragmentShader: FLUID_SPLAT }),
                }
            };

            const simScene = new THREE.Scene();
            const simCam = new THREE.OrthographicCamera(-1,1,1,-1,0,1);
            const quad = new THREE.Mesh(new THREE.PlaneGeometry(2,2), mats.fluid.advect);
            simScene.add(quad);
            const partGeo = new THREE.BufferGeometry();
            const refs = new Float32Array(simRes*simRes*2);
            for(let i=0;i<simRes*simRes;i++) { refs[i*2]=(i%simRes)/simRes; refs[i*2+1]=Math.floor(i/simRes)/simRes; }
            partGeo.setAttribute('reference', new THREE.BufferAttribute(refs, 2));
            partGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(simRes*simRes*3), 3));
            const points = new THREE.Points(partGeo, mats.render);
            points.frustumCulled = false; 
            scene.add(points);

            renderer.setRenderTarget(fbo.pos.A); quad.material = mats.pos; mats.pos.uniforms.positionTexture.value = initPosTex; renderer.render(simScene, simCam);
            renderer.setRenderTarget(fbo.vel.A); quad.material = mats.vel; mats.vel.uniforms.velocityTexture.value = initVelTex; renderer.render(simScene, simCam);

            engine.current = { ...engine.current, renderer, scene, camera, controls, fbo, mats, simScene, simCam, quad, points, THREE, initPosTex, initVelTex, screenA, screenB, finalQuad, fullScreenScene, fullScreenCam };

            const animate = () => {
                animationFrameId = requestAnimationFrame(animate);
                const r = engine.current;
                const time = performance.now() * 0.001;
                r.controls.update();

                if (r.analyser && r.audioData) {
                    r.analyser.getByteFrequencyData(r.audioData);
                    let bass=0, high=0, total=0;
                    for(let i=0; i<10; i++) bass += r.audioData[i];
                    for(let i=100; i<200; i++) high += r.audioData[i];
                    for(let i=0; i<r.audioData.length; i++) total += r.audioData[i];
                    r.mats.vel.uniforms.audioBass.value = Math.min((bass/10)/255 * bassSens * 2.0, 2.0);
                    r.mats.vel.uniforms.audioHigh.value = Math.min((high/100)/255 * highSens * 2.0, 2.0);
                    r.mats.vel.uniforms.audioLevel.value = Math.min((total/r.audioData.length)/255, 2.0);
                    r.mats.render.uniforms.audioLevel.value = r.mats.vel.uniforms.audioLevel.value;
                }

                r.quad.material = r.mats.fluid.advect;
                r.mats.fluid.advect.uniforms.velocityTex.value = r.fbo.fluid.A.texture;
                r.mats.fluid.advect.uniforms.sourceTex.value = r.fbo.fluid.A.texture;
                r.renderer.setRenderTarget(r.fbo.fluid.B); r.renderer.render(r.simScene, r.simCam);
                [r.fbo.fluid.A, r.fbo.fluid.B] = [r.fbo.fluid.B, r.fbo.fluid.A];

                if(r.mouseDown) {
                    r.quad.material = r.mats.fluid.splat;
                    r.mats.fluid.splat.uniforms.targetTex.value = r.fbo.fluid.A.texture;
                    r.mats.fluid.splat.uniforms.point.value.set(r.lastMouse.x, r.lastMouse.y);
                    r.mats.fluid.splat.uniforms.color.value.set(r.mouse.z * 5, r.mouse.z * 2, r.mouse.z * 5);
                    r.renderer.setRenderTarget(r.fbo.fluid.B); r.renderer.render(r.simScene, r.simCam);
                    [r.fbo.fluid.A, r.fbo.fluid.B] = [r.fbo.fluid.B, r.fbo.fluid.A];
                }

                r.quad.material = r.mats.fluid.div;
                r.mats.fluid.div.uniforms.velocityTex.value = r.fbo.fluid.A.texture;
                r.renderer.setRenderTarget(r.fbo.div); r.renderer.render(r.simScene, r.simCam);

                r.quad.material = r.mats.fluid.press;
                r.mats.fluid.press.uniforms.divergenceTex.value = r.fbo.div.texture;
                for(let i=0; i<8; i++) {
                    r.mats.fluid.press.uniforms.pressureTex.value = r.fbo.press.A.texture;
                    r.renderer.setRenderTarget(r.fbo.press.B); r.renderer.render(r.simScene, r.simCam);
                    [r.fbo.press.A, r.fbo.press.B] = [r.fbo.press.B, r.fbo.press.A];
                }

                r.quad.material = r.mats.fluid.grad;
                r.mats.fluid.grad.uniforms.pressureTex.value = r.fbo.press.A.texture;
                r.mats.fluid.grad.uniforms.velocityTex.value = r.fbo.fluid.A.texture;
                r.renderer.setRenderTarget(r.fbo.fluid.B); r.renderer.render(r.simScene, r.simCam);
                [r.fbo.fluid.A, r.fbo.fluid.B] = [r.fbo.fluid.B, r.fbo.fluid.A];

                r.mats.vel.uniforms.time.value = time;
                r.mats.pos.uniforms.time.value = time;
                r.mats.vel.uniforms.velocityTexture.value = r.fbo.vel.A.texture;
                r.mats.vel.uniforms.positionTexture.value = r.fbo.pos.A.texture;
                r.mats.vel.uniforms.fluidTexture.value = r.fbo.fluid.A.texture;
                r.mats.vel.uniforms.mousePos.value.copy(r.mouse);

                r.quad.material = r.mats.vel;
                r.renderer.setRenderTarget(r.fbo.vel.B); r.renderer.render(r.simScene, r.simCam);
                [r.fbo.vel.A, r.fbo.vel.B] = [r.fbo.vel.B, r.fbo.vel.A];

                r.quad.material = r.mats.pos;
                r.mats.pos.uniforms.velocityTexture.value = r.fbo.vel.A.texture;
                r.mats.pos.uniforms.positionTexture.value = r.fbo.pos.A.texture;
                r.renderer.setRenderTarget(r.fbo.pos.B); r.renderer.render(r.simScene, r.simCam);
                [r.fbo.pos.A, r.fbo.pos.B] = [r.fbo.pos.B, r.fbo.pos.A];

                if(r.isVAT || r.isSeq) {
                    const buf = new Float32Array(simRes*simRes*4);
                    r.renderer.readRenderTargetPixels(r.fbo.pos.A, 0, 0, simRes, simRes, buf);
                    vatRef.current.push(buf);
                    setProcProgress(prev => prev + 1);
                }

                r.mats.render.uniforms.positionTexture.value = r.fbo.pos.A.texture;
                r.mats.render.uniforms.velocityTexture.value = r.fbo.vel.A.texture;
                r.renderer.setRenderTarget(r.screenA);
                r.renderer.clear();
                r.renderer.render(r.scene, r.camera);

                r.finalQuad.material.uniforms.tDiffuse.value = r.screenA.texture;
                r.finalQuad.material.uniforms.tPrev.value = r.screenB.texture;
                
                r.renderer.setRenderTarget(null);
                r.renderer.render(r.fullScreenScene, r.fullScreenCam);

                r.renderer.setRenderTarget(r.screenB);
                r.renderer.render(r.fullScreenScene, r.fullScreenCam);
            };
            animate();
        };
        init();

        return () => { disconnectZenViewport(); if(animationFrameId) cancelAnimationFrame(animationFrameId); if(engine.current.audioCtx) engine.current.audioCtx.close(); };
    }, [connectViewport, isToolOverlay, simRes]);

    useEffect(() => {
        if(!engine.current.mats) return;
        const r = engine.current;
        r.mats.vel.uniforms.mode.value = mode;
        r.mats.pos.uniforms.mode.value = mode;
        r.mats.vel.uniforms.speed.value = speed;
        r.mats.vel.uniforms.chaos.value = chaos;
        r.mats.vel.uniforms.uDamping.value = damping;
        r.mats.render.uniforms.color.value.set(colorHex);
        r.mats.render.uniforms.sizeMult.value = pointSize;
        r.mats.render.uniforms.colorMode.value = colorMode;
        r.mats.render.uniforms.forceDoppler.value = doppler;
        r.mats.render.uniforms.useImageColor.value = useImageColor;
        
        // RAW GEO FIX: Extreme Opacity Scaling for 4K
        let op = 0.8;
        if(simRes >= 1024) op = 0.15;
        if(simRes >= 2048) op = 0.05;
        if(simRes >= 4096) op = 0.02; 
        r.mats.render.uniforms.opacityFactor.value = op;

        if(r.finalQuad) {
            r.finalQuad.material.uniforms.decay.value = decay;
            r.finalQuad.material.uniforms.aberration.value = aberration;
            r.finalQuad.material.uniforms.distortion.value = distortion;
        }

        if(activePalette && COLOR_PALETTES[activePalette]) {
             const newTex = generatePaletteTexture(COLOR_PALETTES[activePalette]);
             r.mats.render.uniforms.paletteTexture.value = newTex;
        }

        const m = r.mats.vel.uniforms;
        m.uHeartbeatActive.value = activeModifiers.includes('heartbeat') ? 1.0 : 0.0;
        m.uHeartbeatBPM.value = modParams['heartbeat_bpm'] || 60;
        m.uHeartbeatIntensity.value = modParams['heartbeat_intensity'] || 2.0;
        m.uHelixActive.value = activeModifiers.includes('helix') ? 1.0 : 0.0;
        m.uHelixSpeed.value = modParams['helix_speed'] || 1.0;
        m.uHelixTightness.value = modParams['helix_tightness'] || 0.1;
        m.uSeismicActive.value = activeModifiers.includes('seismic') ? 1.0 : 0.0;
        m.uSeismicScale.value = modParams['seismic_scale'] || 1.0;
        m.uSeismicFreq.value = modParams['seismic_freq'] || 2.0;
        m.uGravityActive.value = activeModifiers.includes('gravity') ? 1.0 : 0.0;
        m.uGravityForce.value = modParams['gravity_force'] || 5.0;
        m.uGravityRadius.value = modParams['gravity_radius'] || 10.0;
    }, [mode, speed, chaos, damping, colorHex, pointSize, colorMode, doppler, activeModifiers, modParams, useImageColor, decay, aberration, distortion, activePalette, simRes]);

    useEffect(() => {
        if(!engine.current.mats) return;
        const activeCode = scripts.filter(s => s.active).map(s => `// ${s.name}\n${s.code}`).join('\n');
        const newFrag = VELOCITY_TEMPLATE.replace('//_USER_CODE_INJECTION_', activeCode);
        engine.current.mats.vel.fragmentShader = newFrag;
        engine.current.mats.vel.needsUpdate = true;
        setStatus(`KERNEL RECOMPILED [${scripts.filter(s=>s.active).length} INJECTIONS]`);
    }, [scripts]);

    useEffect(() => {
        const r = engine.current;
        if(r.analyser) r.analyser.smoothingTimeConstant = audioSmoothing;
        if(r.audioEl) r.audioEl.volume = audioVolume;
    }, [audioSmoothing, audioVolume]);

    // --- CORE FUNCTIONS ---
    const initAudio = () => {
        if(!engine.current.audioCtx) {
            const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
            engine.current.audioCtx = new AudioContext();
            engine.current.analyser = engine.current.audioCtx.createAnalyser();
            engine.current.analyser.fftSize = 512;
            engine.current.audioData = new Uint8Array(engine.current.analyser.frequencyBinCount);
        }
        if(engine.current.audioCtx.state === 'suspended') engine.current.audioCtx.resume();
    };

    const handleAudioUpload = (e: any) => {
        const file = e.target.files[0]; if(!file) return;
        initAudio();
        
        // Cleanup previous
        if(engine.current.audioEl) {
            engine.current.audioEl.pause();
            engine.current.audioEl.ontimeupdate = null;
            engine.current.audioEl.onended = null;
            engine.current.audioEl.onloadedmetadata = null;
            engine.current.audioEl = null;
        }
        if(engine.current.audioSrc) {
            engine.current.audioSrc.disconnect();
            engine.current.audioSrc = null;
        }

        const url = URL.createObjectURL(file);
        const audio = new Audio(url);
        audio.crossOrigin = "anonymous";
        audio.loop = true;
        audio.volume = audioVolume;

        audio.onloadedmetadata = () => setAudioDuration(audio.duration);
        audio.ontimeupdate = () => setAudioCurrentTime(audio.currentTime);
        audio.onended = () => setIsPlaying(false);

        const source = engine.current.audioCtx.createMediaElementSource(audio);
        source.connect(engine.current.analyser);
        engine.current.analyser.connect(engine.current.audioCtx.destination);
        
        engine.current.audioSrc = source;
        engine.current.audioEl = audio;
        setAudioFile(file.name);
        setIsPlaying(false);
    };

    const togglePlay = () => {
        if(!engine.current.audioEl) return;
        if(isPlaying) { engine.current.audioEl.pause(); setIsPlaying(false); }
        else { engine.current.audioEl.play(); setIsPlaying(true); }
    };

    const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
        const t = parseFloat(e.target.value);
        setAudioCurrentTime(t);
        if(engine.current.audioEl) engine.current.audioEl.currentTime = t;
    };

    const exportGLB = () => {
        const r = engine.current; if(!r) return;
        setStatus("BAKING GLB...");
        const w = simRes; const h = simRes;
        const buf = new Float32Array(w*h*4);
        r.renderer.readRenderTargetPixels(r.fbo.pos.A, 0, 0, w, h, buf);
        const geoPos = new Float32Array(w*h*3);
        for(let i=0; i<w*h; i++) { geoPos[i*3]=buf[i*4]; geoPos[i*3+1]=buf[i*4+1]; geoPos[i*3+2]=buf[i*4+2]; }
        const geometry = new r.THREE.BufferGeometry();
        geometry.setAttribute('position', new r.THREE.BufferAttribute(geoPos, 3));
        const mesh = new r.THREE.Points(geometry, new r.THREE.PointsMaterial({color: colorHex}));
        const exporter = new r.THREE.GLTFExporter();
        exporter.parse(mesh, (gltf: any) => {
            const blob = new Blob([gltf], { type: 'application/octet-stream' });
            const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `${exportPrefix}_${Date.now()}.glb`; a.click();
            setStatus("GLB EXPORTED");
        }, { binary: true });
    };

    const exportOBJ = () => {
        const r = engine.current; if(!r) return;
        setStatus("BAKING OBJ...");
        const w = simRes; const h = simRes;
        const buf = new Float32Array(w*h*4);
        r.renderer.readRenderTargetPixels(r.fbo.pos.A, 0, 0, w, h, buf);
        const geoPos = new Float32Array(w*h*3);
        for(let i=0; i<w*h; i++) { geoPos[i*3]=buf[i*4]; geoPos[i*3+1]=buf[i*4+1]; geoPos[i*3+2]=buf[i*4+2]; }
        const geometry = new r.THREE.BufferGeometry();
        geometry.setAttribute('position', new r.THREE.BufferAttribute(geoPos, 3));
        const mesh = new r.THREE.Points(geometry);
        const exporter = new r.THREE.OBJExporter();
        const res = exporter.parse(mesh);
        const blob = new Blob([res], { type: 'text/plain' });
        const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `${exportPrefix}_${Date.now()}.obj`; a.click();
        setStatus("OBJ EXPORTED");
    };

    const toggleRecording = () => {
        const r = engine.current; if(!r) return;
        if(isRecording && mediaRecorderRef.current) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
            setStatus("RECORDING SAVED");
        } else {
            let targetW = 1920, targetH = 1080;
            if(recResolution === '4K') { targetW=3840; targetH=2160; }
            if(recResolution === '8K') { targetW=7680; targetH=4320; }
            if(recResolution !== 'WINDOW') {
                r.renderer.setSize(targetW, targetH, false);
                r.camera.aspect = targetW/targetH;
                r.camera.updateProjectionMatrix();
            }

            chunksRef.current = [];
            const stream = r.renderer.domElement.captureStream(60);
            const rec = new MediaRecorder(stream, { mimeType: 'video/webm; codecs=vp9', videoBitsPerSecond: recResolution==='8K'?40000000:12000000 });
            rec.ondataavailable = e => { if(e.data.size>0) chunksRef.current.push(e.data); };
            rec.onstop = () => {
                const blob = new Blob(chunksRef.current, {type: 'video/webm'});
                const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `${exportPrefix}_REC_${recResolution}_${Date.now()}.webm`; a.click();
                if(mountRef.current) {
                    const w = mountRef.current.clientWidth; const h = mountRef.current.clientHeight;
                    r.renderer.setSize(w, h, true);
                    r.camera.aspect = w/h; r.camera.updateProjectionMatrix();
                }
            };
            rec.start();
            mediaRecorderRef.current = rec;
            setIsRecording(true);
            setStatus(`RECORDING ${recResolution}...`);
        }
    };

    const processVATExport = async () => {
        const frames = vatRef.current;
        if (frames.length === 0) { setStatus("VAT ERROR: NO FRAMES"); return; }
        const numFrames = frames.length; const numParticles = simRes * simRes; setStatus(`PROCESSING ${numFrames} FRAMES...`);
        // Explicitly type numbers to prevent arithmetic errors in TS
        let minX: number = Infinity, minY: number = Infinity, minZ: number = Infinity, maxX: number = -Infinity, maxY: number = -Infinity, maxZ: number = -Infinity;
        const stride = 10; 
        for(let f=0; f<numFrames; f+=stride) {
            const d = frames[f];
            for(let i=0; i<numParticles; i+=100) {
                const x=d[i*4], y=d[i*4+1], z=d[i*4+2];
                if(Math.abs(x)<500) { if(x<minX) minX=x; if(x>maxX) maxX=x; if(y<minY) minY=y; if(y>maxY) maxY=y; if(z<minZ) minZ=z; if(z>maxZ) maxZ=z; }
            }
        }
        minX-=5; minY-=5; minZ-=5; maxX+=5; maxY+=5; maxZ+=5;
        const sizeX = maxX-minX, sizeY = maxY-minY, sizeZ = maxZ-minZ;
        const canvas = document.createElement('canvas'); canvas.width = numParticles; canvas.height = numFrames; 
        const ctx = canvas.getContext('2d'); 
        if (!ctx) return;
        const imgData = ctx.createImageData(numParticles, numFrames);
        for(let f=0; f<numFrames; f++) {
            const data = frames[f];
            for(let p=0; p<numParticles; p++) {
                const idx = (f * numParticles + p) * 4; const dIdx = p * 4;
                imgData.data[idx] = Math.floor(((data[dIdx] - minX) / sizeX) * 255); imgData.data[idx+1] = Math.floor(((data[dIdx+1] - minY) / sizeY) * 255); imgData.data[idx+2] = Math.floor(((data[dIdx+2] - minZ) / sizeZ) * 255); imgData.data[idx+3] = 255;
            }
            if(f%10===0) await sleep(1);
        }
        ctx.putImageData(imgData, 0, 0);
        const link = document.createElement('a'); link.download = `${exportPrefix}_VAT_${Date.now()}.png`; link.href = canvas.toDataURL('image/png'); link.click();
        const meta = { bounds: { min: [minX,minY,minZ], max: [maxX,maxY,maxZ] }, frames: numFrames, particles: numParticles };
        const blob = new Blob([JSON.stringify(meta)], {type:'application/json'});
        const ml = document.createElement('a'); ml.href = URL.createObjectURL(blob); ml.download = 'VAT_META.json'; ml.click();
        setStatus("VAT COMPLETE");
    };

    const processSequenceExport = async () => {
        if(!window.JSZip) { setStatus("ERROR: JSZIP MISSING"); return; }
        const frames = vatRef.current; const zip = new window.JSZip(); const r = engine.current; const exporter = new r.THREE.GLTFExporter();
        setStatus(`COMPRESSING ${frames.length} FRAMES...`);
        const geo = new r.THREE.BufferGeometry(); const posAttr = new r.THREE.BufferAttribute(new Float32Array(simRes*simRes*3), 3); geo.setAttribute('position', posAttr); const mesh = new r.THREE.Points(geo);
        for(let f=0; f<frames.length; f++) {
            const d = frames[f]; for(let i=0; i<simRes*simRes; i++) { posAttr.setXYZ(i, d[i*4], d[i*4+1], d[i*4+2]); } posAttr.needsUpdate = true;
            await new Promise<void>(resolve => { exporter.parse(mesh, (gltf: any) => { zip.file(`frame_${String(f).padStart(4,'0')}.glb`, gltf); resolve(); }, { binary: true }); });
            if(f%5===0) await sleep(1);
        }
        const content = await zip.generateAsync({type:"blob"}); const link = document.createElement('a'); link.href = URL.createObjectURL(content); link.download = `${exportPrefix}_SEQ_${Date.now()}.zip`; link.click(); setStatus("SEQUENCE COMPLETE");
    };

    const toggleVAT = () => { if(isVAT) { engine.current.isVAT = false; setIsVAT(false); setTimeout(processVATExport, 100); } else { vatRef.current = []; setProcProgress(0); engine.current.isVAT = true; setIsVAT(true); setStatus("RECORDING VERTEX DATA..."); } };
    const toggleSeq = () => { if(isSeq) { engine.current.isSeq = false; setIsSeq(false); setTimeout(processSequenceExport, 100); } else { vatRef.current = []; setProcProgress(0); engine.current.isSeq = true; setIsSeq(true); setStatus("RECORDING GEOMETRY CACHE..."); } };
    
    const resetCamera = () => { 
        if(!engine.current.camera) return; 
        engine.current.camera.position.set(0, 30, 60); 
        engine.current.controls.target.set(0, 0, 0);
        engine.current.controls?.update();
        setStatus('VIEWPORT FRAMED');
    };

    useZenControlBindings(moduleId, ({ actionId, phase, sourceModuleId }) => {
        if (sourceModuleId !== moduleId || phase !== 'down') {
            return false;
        }

        if (actionId === 'camera.focus') {
            if (isToolOverlay) {
                return false;
            }
            resetCamera();
            return true;
        }

        return false;
    });
    
    const resetSim = () => { 
        if(!engine.current.fbo) return; 
        const r = engine.current; 
        r.renderer.setRenderTarget(r.fbo.pos.A); 
        r.quad.material = r.mats.pos; 
        r.mats.pos.uniforms.positionTexture.value = r.initPosTex; 
        r.renderer.render(r.simScene, r.simCam); 
        r.renderer.setRenderTarget(r.fbo.vel.A); 
        r.quad.material = r.mats.vel; 
        r.mats.vel.uniforms.velocityTexture.value = r.initVelTex; 
        r.renderer.render(r.simScene, r.simCam); 
        setStatus("SIMULATION REBOOTED"); 
    };
    
    const handleImageUpload = (e: any) => {
        const file = e.target.files[0]; if(!file) return;
        const reader = new FileReader();
        reader.onload = (evt) => {
            if (evt.target && typeof evt.target.result === 'string') {
                const img = new Image(); img.src = evt.target.result;
                img.onload = () => {
                    const r = engine.current; const tex = new r.THREE.Texture(img); tex.needsUpdate = true;
                    r.mats.render.uniforms.imageTexture.value = tex;
                    setColorMode(2); setMode(5); setStatus("IMAGE TEXTURE INJECTED");
                };
            }
        };
        reader.readAsDataURL(file);
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if(!engine.current.camera || !engine.current.mouse || !mountRef.current) return;
        const rect = mountRef.current.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        const y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
        
        const vec = new window.THREE.Vector3(x, y, 0.5);
        vec.unproject(engine.current.camera);
        const dir = vec.sub(engine.current.camera.position).normalize();
        const distance = -engine.current.camera.position.z / dir.z;
        const pos = engine.current.camera.position.clone().add(dir.multiplyScalar(distance));
        
        engine.current.mouse.set(pos.x, pos.y, engine.current.mouseDown ? 1 : 0);
        engine.current.lastMouse.set((x+1)/2, (y+1)/2);
    };

    return (
        <div className={`flex h-screen text-[#00ffcc] font-mono overflow-hidden select-none ${isToolOverlay ? 'pointer-events-none bg-transparent' : 'bg-[#020204]'}`}>
            {/* LEFT PANEL */}
            {!isViewportHost && (
            <div className={`w-80 flex flex-col border-r border-[#00ffcc]/20 bg-[#050505]/95 backdrop-blur z-20 ${isToolOverlay ? 'pointer-events-auto' : ''}`}>
                <div className="p-4 border-b border-[#00ffcc]/20"><h1 className="font-bold text-lg italic">{resolvedModuleLabel} <span className="text-[10px] opacity-50">NAVIER</span></h1></div>
                <div className="flex text-[9px] font-bold border-b border-[#00ffcc]/20">
                    <button onClick={()=>setActiveTab('sim')} className={`flex-1 py-2 ${activeTab==='sim'?'bg-[#00ffcc]/10 text-[#00ffcc]':'text-gray-500'}`}>SIMULATION</button>
                    <button onClick={()=>setActiveTab('script')} className={`flex-1 py-2 ${activeTab==='script'?'bg-[#00ffcc]/10 text-[#00ffcc]':'text-gray-500'}`}>K-SCRIPT</button>
                </div>
                <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
                    {activeTab === 'sim' && (
                        <div className="space-y-6">
                            {/* GLOBAL PARAMETERS */}
                            <div className="p-3 border border-[#00ffcc]/30 rounded bg-[#00ffcc]/5 space-y-3">
                                <div className="text-[9px] text-[#00ffcc]/40 font-bold mb-2 uppercase tracking-widest flex items-center gap-2"><Sliders size={10}/> Global Parameters</div>
                                
                                <div><div className="flex justify-between text-[9px] text-[#00ffcc]/60 mb-1">VELOCITY</div><input type="range" min="0" max="5" step="0.1" value={speed} onChange={e=>setSpeed(parseFloat(e.target.value))} className="w-full h-1 bg-[#222] rounded appearance-none accent-[#00ffcc]"/></div>
                                
                                <div><div className="flex justify-between text-[9px] text-[#00ffcc]/60 mb-1">ENTROPY</div><input type="range" min="0" max="3" step="0.1" value={chaos} onChange={e=>setChaos(parseFloat(e.target.value))} className="w-full h-1 bg-[#222] rounded appearance-none accent-[#00ffcc]"/></div>
                                
                                <div><div className="flex justify-between text-[9px] text-[#00ffcc]/60 mb-1">FRICTION</div><input type="range" min="0.8" max="0.999" step="0.001" value={damping} onChange={e=>setDamping(parseFloat(e.target.value))} className="w-full h-1 bg-[#222] rounded appearance-none accent-[#00ffcc]"/></div>
                                
                                <div><div className="flex justify-between text-[9px] text-[#00ffcc]/60 mb-1">PARTICLE SIZE</div><input type="range" min="0.1" max="5.0" step="0.1" value={pointSize} onChange={e=>setPointSize(parseFloat(e.target.value))} className="w-full h-1 bg-[#222] rounded appearance-none accent-[#00ffcc]"/></div>
                            </div>

                            {/* RESOLUTION */}
                            <div className="p-2 border border-[#00ffcc]/30 rounded bg-[#00ffcc]/5">
                                <div className="text-[9px] text-[#00ffcc]/40 font-bold mb-2 uppercase tracking-widest">Resolution Scaling</div>
                                <div className="grid grid-cols-3 gap-1">
                                    {[128, 256, 512, 1024, 2048, 4096].map(res => (
                                        <button key={res} onClick={()=>setSimRes(res)} className={`py-1 text-[8px] border rounded ${simRes===res ? 'bg-[#00ffcc] text-black border-[#00ffcc]' : 'border-[#00ffcc]/30 text-[#00ffcc] hover:bg-[#00ffcc]/10'}`}>
                                            {res===1024?'1K':res===2048?'2K':res===4096?'4K':res}
                                        </button>
                                    ))}
                                </div>
                                <div className="text-[8px] text-center mt-1 text-gray-500">{(simRes*simRes).toLocaleString()} PARTICLES</div>
                            </div>
                            
                            {/* PHOTO-KINESIS */}
                            <div className="p-2 border border-[#00ffcc]/30 rounded bg-[#00ffcc]/5">
                                <div className="text-[9px] text-[#00ffcc]/40 font-bold mb-2 tracking-widest uppercase">Photo-Kinesis</div>
                                <div className="relative w-full h-12 border border-dashed border-[#00ffcc]/30 rounded flex flex-col items-center justify-center text-[#00ffcc]/50 hover:border-[#00ffcc] hover:text-[#00ffcc] transition-all cursor-pointer">
                                    <input type="file" onChange={handleImageUpload} accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer"/><ImageIcon size={14} className="mb-1"/><span className="text-[8px] uppercase">Inject Texture</span>
                                </div>
                                {mode === 5 && (
                                    <button onClick={()=>setUseImageColor(!useImageColor)} className={`w-full mt-2 py-1 text-[9px] border rounded font-bold ${useImageColor ? 'bg-[#00ffcc] text-black' : 'border-[#333] text-gray-500'}`}>
                                        USE IMAGE COLORS
                                    </button>
                                )}
                            </div>

                            {Object.entries(PHYSICS_CATEGORIES).map(([cat, modes]) => (
                                <div key={cat}><div className="text-[9px] text-[#00ffcc]/40 font-bold mb-1 pl-1 tracking-widest">{cat}</div><div className="grid grid-cols-1 gap-1">{modes.map(m=>(<button key={m.id} onClick={()=>setMode(m.id)} className={`p-2 rounded border flex items-center gap-3 text-left ${mode===m.id?'border-[#00ffcc] bg-[#00ffcc]/10':'border-[#222] hover:border-[#444]'}`}><div className={`p-2 rounded ${mode===m.id?'bg-[#00ffcc] text-black':'bg-[#111]'}`}><m.icon size={14}/></div><div><div className="text-[10px] font-bold">{m.label}</div><div className="text-[8px] text-gray-600">{m.desc}</div></div></button>))}</div></div>
                            ))}
                        </div>
                    )}
                    {activeTab === 'script' && (
                        <div className="space-y-4 pt-2">
                            <div className="bg-[#00ffcc]/5 border border-[#00ffcc]/20 rounded overflow-hidden">
                                <div className="p-2 flex items-center justify-between bg-black/40 border-b border-[#00ffcc]/20"><div className="flex items-center gap-2 text-[#00ffcc] text-[10px] font-bold"><Terminal size={12}/> K-SCRIPT (GLSL)</div></div>
                                <textarea className="w-full bg-black text-[#00ffcc] text-[10px] font-mono p-3 h-32 outline-none border-none resize-none" value={newScript} onChange={e=>setNewScript(e.target.value)} spellCheck={false}/>
                                <div className="p-2 bg-black/40 border-t border-[#00ffcc]/20 flex items-center justify-between"><div className="text-[8px] text-gray-500 font-mono">VARS: <span className="text-white">p, v, t</span></div><button onClick={() => setScripts([...scripts, { id: Date.now(), name: `Patch_${scripts.length}`, code: newScript, active: true }])} className="px-4 py-1 bg-[#00ffcc]/10 hover:bg-[#00ffcc]/30 border border-[#00ffcc]/50 hover:text-white text-[#00ffcc] text-[9px] font-bold rounded flex items-center gap-2"><Zap size={10}/> INJECT</button></div>
                                <div className="flex gap-1 p-2 bg-black border-t border-[#333] overflow-x-auto no-scrollbar"><button onClick={()=>setNewScript("force.y += sin(p.x * 0.5 + t) * 2.0;")} className="px-2 py-1 text-[8px] border border-[#333] bg-[#111] text-gray-400 hover:text-white hover:border-white rounded whitespace-nowrap">WAVE</button><button onClick={()=>setNewScript("force -= normalize(p) * (sin(t*10.0)*2.0);")} className="px-2 py-1 text-[8px] border border-[#333] bg-[#111] text-gray-400 hover:text-white hover:border-white rounded whitespace-nowrap">PULSE</button><button onClick={()=>setNewScript("force.y += 5.0;")} className="px-2 py-1 text-[8px] border border-[#333] bg-[#111] text-gray-400 hover:text-white hover:border-white rounded whitespace-nowrap">GRAVITY</button><button onClick={()=>setNewScript("force += cross(normalize(p), vec3(0,1,0));")} className="px-2 py-1 text-[8px] border border-[#333] bg-[#111] text-gray-400 hover:text-white hover:border-white rounded whitespace-nowrap">VORTEX</button></div>
                                <div className="p-2 text-[8px] text-gray-600 italic border-t border-[#333] bg-black">WARNING: Raw GLSL. Syntax errors may crash the engine. Use floats (1.0 not 1).</div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
            )}

            {/* VIEWPORT */}
            <div className={`flex-1 relative cursor-crosshair overflow-hidden group ${isToolOverlay ? 'pointer-events-none bg-transparent' : 'bg-black'}`}>
                <div ref={mountRef} className={`absolute inset-0 ${isToolOverlay ? 'opacity-0 pointer-events-none' : ''}`} onMouseMove={handleMouseMove} onMouseDown={()=>{engine.current.mouseDown=true}} onMouseUp={()=>{engine.current.mouseDown=false}} onMouseLeave={()=>{engine.current.mouseDown=false}}/>
                {!isViewportHost && !isToolOverlay && (
                <div className="absolute top-4 left-4 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-500"><div className="text-[10px] text-[#00ffcc] font-mono bg-black/50 p-2 border border-[#00ffcc]/30 backdrop-blur-sm">FPS: 60 // P: {(simRes*simRes).toLocaleString()}</div></div>
                )}
                {!isViewportHost && !isToolOverlay && (
                <div className="absolute top-4 right-4 flex gap-2">
                    <button onClick={resetCamera} className="p-2 bg-black/50 border border-[#00ffcc]/30 hover:bg-[#00ffcc] hover:text-black transition-colors rounded backdrop-blur-sm"><Camera size={16} /></button>
                    <button onClick={resetSim} className="p-2 bg-black/50 border border-[#00ffcc]/30 hover:bg-[#00ffcc] hover:text-black transition-colors rounded backdrop-blur-sm"><RefreshCw size={16} /></button>
                </div>
                )}
            </div>

            {/* RIGHT PANEL */}
            {!isViewportHost && (
            <div className={`w-72 flex flex-col border-l border-[#00ffcc]/20 bg-[#050505]/95 backdrop-blur z-20 ${isToolOverlay ? 'pointer-events-auto' : ''}`}>
                <div className="flex text-[9px] font-bold border-b border-[#00ffcc]/20"><button onClick={()=>setRightTab('optics')} className={`flex-1 py-3 ${rightTab==='optics'?'text-[#00ffcc] bg-[#00ffcc]/10':'text-gray-500'}`}>OPTICS</button><button onClick={()=>setRightTab('audio')} className={`flex-1 py-3 ${rightTab==='audio'?'text-[#00ffcc] bg-[#00ffcc]/10':'text-gray-500'}`}>AUDIO</button><button onClick={()=>setRightTab('export')} className={`flex-1 py-3 ${rightTab==='export'?'text-[#00ffcc] bg-[#00ffcc]/10':'text-gray-500'}`}>OUTPUT</button></div>
                <div className="flex-1 overflow-y-auto custom-scrollbar p-3">
                    {rightTab === 'optics' && (
                        <div className="space-y-6">
                            <div className="p-3 border border-[#00ffcc]/30 rounded bg-[#00ffcc]/5 text-[9px] text-[#00ffcc]/80 italic">Warning: High levels of prismatic feedback may cause visual hallucinations.</div>
                            <div className="space-y-4">
                                <div><div className="flex justify-between text-[9px] text-[#00ffcc]/60"><span>PRISMATIC SEPARATION</span><span>{aberration}</span></div><input type="range" min="0" max="10" step="0.1" value={aberration} onChange={e=>setAberration(parseFloat(e.target.value))} className="w-full h-1 bg-[#222] rounded accent-[#00ffcc]"/></div>
                                <div><div className="flex justify-between text-[9px] text-[#00ffcc]/60"><span>LENS DISTORTION</span><span>{distortion}</span></div><input type="range" min="-0.5" max="0.5" step="0.01" value={distortion} onChange={e=>setDistortion(parseFloat(e.target.value))} className="w-full h-1 bg-[#222] rounded accent-[#00ffcc]"/></div>
                                <div><div className="flex justify-between text-[9px] text-[#00ffcc]/60"><span>SIGNAL DECAY</span><span>{decay}</span></div><input type="range" min="0.8" max="0.99" step="0.001" value={decay} onChange={e=>setDecay(parseFloat(e.target.value))} className="w-full h-1 bg-[#222] rounded accent-[#00ffcc]"/></div>
                            </div>
                            <div className="p-3 border border-[#333] rounded bg-[#080808]">
                                <div className="flex justify-between mb-2 text-[9px] font-bold text-[#00ffcc]"><span>SPECTRA ENGINE</span><Palette size={12}/></div>
                                <div className="grid grid-cols-2 gap-1 mb-3">
                                    <button onClick={()=>setColorMode(0)} className={`py-1 text-[8px] border rounded ${colorMode===0?'bg-[#00ffcc] text-black':'text-gray-500'}`}>SOLID</button>
                                    <button onClick={()=>setColorMode(1)} className={`py-1 text-[8px] border rounded ${colorMode===1?'bg-[#00ffcc] text-black':'text-gray-500'}`}>SPECTRAL</button>
                                    <button onClick={()=>setColorMode(3)} className={`py-1 text-[8px] border rounded ${colorMode===3?'bg-[#00ffcc] text-black':'text-gray-500'}`}>SPATIAL</button>
                                    <button onClick={()=>{setColorMode(2); setMode(5)}} className={`py-1 text-[8px] border rounded ${colorMode===2?'bg-[#00ffcc] text-black':'text-gray-500'}`}>PHOTO</button>
                                </div>
                                
                                {colorMode === 0 && (
                                    <div className="space-y-2">
                                        <div className="text-[8px] text-gray-500">BASE COLOR</div>
                                        <input type="color" value={colorHex} onChange={e=>setColorHex(e.target.value)} className="w-full h-6 bg-transparent border border-[#333] cursor-pointer"/>
                                    </div>
                                )}

                                {colorMode === 1 && (
                                    <div className="space-y-2">
                                        <div className="text-[8px] text-gray-500">VELOCITY GRADIENT</div>
                                        <div className="grid grid-cols-1 gap-1">
                                            {Object.keys(COLOR_PALETTES).map(p => (
                                                <button key={p} onClick={()=>setActivePalette(p)} className={`flex items-center gap-2 p-1 border rounded ${activePalette===p?'border-[#00ffcc]':'border-[#333]'}`}>
                                                    <div className="w-full h-2 rounded" style={{background: `linear-gradient(to right, ${COLOR_PALETTES[p].join(',')})`}}/>
                                                    <span className="text-[7px] text-[#00ffcc] w-10">{p}</span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="flex items-center justify-between p-3 border border-[#00ffcc]/30 rounded bg-black"><div className="text-[9px] font-bold text-[#00ffcc]">RELATIVISTIC DOPPLER</div><button onClick={()=>setDoppler(!doppler)} className={`w-8 h-4 rounded-full border flex items-center px-0.5 ${doppler?'bg-[#00ffcc] border-[#00ffcc]':'border-gray-600'}`}><div className={`w-2.5 h-2.5 bg-black rounded-full transition-all ${doppler?'ml-4':'ml-0'}`}/></button></div>
                        </div>
                    )}
                    {rightTab === 'audio' && (
                        <div className="space-y-6">
                            <div className="p-4 border border-[#00ffcc]/30 rounded bg-[#00ffcc]/5">
                                {/* Header */}
                                <div className="flex items-center justify-between mb-4">
                                    <div className="flex items-center gap-2 text-xs font-bold text-[#00ffcc]"><Music size={14}/> AUDIO ENGINE</div>
                                </div>

                                {/* Upload / Track Info */}
                                {!audioFile ? (
                                    <div className="relative w-full h-20 border-2 border-dashed border-[#00ffcc]/30 rounded flex flex-col items-center justify-center text-[#00ffcc]/50 hover:border-[#00ffcc] hover:text-[#00ffcc] transition-all cursor-pointer mb-4">
                                        <input type="file" onChange={handleAudioUpload} accept=".mp3,.wav,.ogg" className="absolute inset-0 opacity-0 cursor-pointer"/>
                                        <Upload size={20} className="mb-1"/><span className="text-[9px] uppercase">Load Waveform</span>
                                    </div>
                                ) : (
                                    <div className="space-y-3 mb-4">
                                         <div className="flex items-center justify-between">
                                            <div className="text-[9px] text-[#00ffcc] truncate max-w-[150px]">{audioFile}</div>
                                            <div className="relative overflow-hidden cursor-pointer group">
                                                 <input type="file" onChange={handleAudioUpload} accept=".mp3,.wav,.ogg" className="absolute inset-0 opacity-0 cursor-pointer z-10"/>
                                                 <div className="text-[8px] border border-[#00ffcc] px-2 py-1 rounded hover:bg-[#00ffcc] hover:text-black transition-colors">EJECT</div>
                                            </div>
                                         </div>
                                         
                                         {/* Scrubber */}
                                         <div className="space-y-1">
                                            <div className="flex justify-between text-[8px] text-[#00ffcc]/50 font-mono">
                                                <span>{formatTime(audioCurrentTime)}</span>
                                                <span>{formatTime(audioDuration)}</span>
                                            </div>
                                            <input type="range" min="0" max={audioDuration || 1} step="0.1" value={audioCurrentTime} onChange={handleSeek} className="w-full h-1 bg-[#222] rounded appearance-none accent-[#00ffcc] cursor-pointer"/>
                                         </div>

                                         {/* Controls */}
                                         <div className="flex items-center gap-2 justify-center pt-2">
                                            <button onClick={togglePlay} className="p-3 bg-[#00ffcc] text-black rounded-full hover:bg-white transition-all shadow-[0_0_15px_rgba(0,255,204,0.4)]">
                                                 {isPlaying ? <Pause size={16} fill="black"/> : <Play size={16} fill="black" className="ml-1"/>}
                                            </button>
                                         </div>
                                    </div>
                                )}
                                
                                {/* Settings */}
                                 <div className="space-y-3 pt-3 border-t border-[#00ffcc]/20">
                                    <div className="text-[9px] font-bold text-[#00ffcc]/50 uppercase tracking-widest mb-2">Mixer Config</div>
                                    
                                    {/* Volume */}
                                    <div className="space-y-1">
                                        <div className="flex justify-between text-[8px] text-[#00ffcc]/70"><span>MASTER GAIN</span><span>{(audioVolume*100).toFixed(0)}%</span></div>
                                        <input type="range" min="0" max="1" step="0.01" value={audioVolume} onChange={e=>setAudioVolume(parseFloat(e.target.value))} className="w-full h-1 bg-[#222] rounded accent-[#00ffcc]"/>
                                    </div>

                                    {/* Sensitivity */}
                                    <div className="space-y-1">
                                        <div className="flex justify-between text-[8px] text-[#00ffcc]/70"><span>BASS REACTIVITY</span><span>{bassSens.toFixed(1)}</span></div>
                                        <input type="range" min="0" max="5" step="0.1" value={bassSens} onChange={e=>setBassSens(parseFloat(e.target.value))} className="w-full h-1 bg-[#222] rounded accent-[#00ffcc]"/>
                                    </div>
                                     <div className="space-y-1">
                                        <div className="flex justify-between text-[8px] text-[#00ffcc]/70"><span>TREBLE REACTIVITY</span><span>{highSens.toFixed(1)}</span></div>
                                        <input type="range" min="0" max="5" step="0.1" value={highSens} onChange={e=>setHighSens(parseFloat(e.target.value))} className="w-full h-1 bg-[#222] rounded accent-[#00ffcc]"/>
                                    </div>

                                    {/* Smoothing */}
                                    <div className="space-y-1">
                                        <div className="flex justify-between text-[8px] text-[#00ffcc]/70"><span>FFT SMOOTHING</span><span>{audioSmoothing.toFixed(2)}</span></div>
                                        <input type="range" min="0.1" max="0.99" step="0.01" value={audioSmoothing} onChange={e=>setAudioSmoothing(parseFloat(e.target.value))} className="w-full h-1 bg-[#222] rounded accent-[#00ffcc]"/>
                                    </div>
                                 </div>
                            </div>
                        </div>
                    )}
                    {rightTab === 'export' && (
                        <div className="space-y-4">
                            <div className="p-3 border border-[#00ffcc]/30 rounded bg-[#00ffcc]/5 space-y-3">
                                <div className="text-[9px] text-[#00ffcc]/50 uppercase tracking-widest font-bold">Cinema</div>
                                <div className="flex gap-2">
                                    {['WINDOW','1080p','4K','8K'].map(r=><button key={r} onClick={()=>setRecResolution(r)} className={`flex-1 py-1 text-[8px] border rounded ${recResolution===r?'bg-[#00ffcc] text-black':'text-[#00ffcc] border-[#00ffcc]/30'}`}>{r}</button>)}
                                </div>
                                <button onClick={toggleRecording} className={`w-full py-2 border font-bold text-[9px] flex items-center justify-center gap-2 ${isRecording?'border-red-500 text-red-500 animate-pulse':'border-[#00ffcc] text-[#00ffcc]'}`}>{isRecording?<StopCircle size={12}/>:<Film size={12}/>} {isRecording?'STOP REC':'CAPTURE VIDEO'}</button>
                            </div>
                            <div className="p-3 border border-[#333] rounded bg-[#080808] space-y-3">
                                <div className="text-[9px] text-gray-500 uppercase tracking-widest font-bold">Geometry Cache</div>
                                <div className="grid grid-cols-2 gap-2">
                                    <button onClick={exportGLB} className="py-2 border border-[#333] hover:border-[#00ffcc] text-[#00ffcc] text-[8px]">GLB SNAPSHOT</button>
                                    <button onClick={exportOBJ} className="py-2 border border-[#333] hover:border-[#00ffcc] text-[#00ffcc] text-[8px]">OBJ SNAPSHOT</button>
                                </div>
                                <button onClick={toggleVAT} className={`w-full py-2 border font-bold text-[8px] flex items-center justify-center gap-2 ${isVAT?'border-orange-500 text-orange-500':'border-[#00ffcc] text-[#00ffcc] hover:bg-[#00ffcc] hover:text-black'}`}>
                                    {isVAT ? `CAPTURING ${procProgress} FRAMES` : <><FileJson size={12}/> RECORD VAT (TEXTURE)</>}
                                </button>
                                <button onClick={toggleSeq} className={`w-full py-2 border font-bold text-[8px] flex items-center justify-center gap-2 ${isSeq?'border-orange-500 text-orange-500':'border-[#00ffcc] text-[#00ffcc] hover:bg-[#00ffcc] hover:text-black'}`}>
                                    {isSeq ? `CAPTURING ${procProgress} FRAMES` : <><Package size={12}/> RECORD GEOMETRY CACHE (GLB)</>}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
            )}
            
            <style>{`
                .custom-scrollbar::-webkit-scrollbar { width: 4px; }
                .custom-scrollbar::-webkit-scrollbar-track { bg: #000; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: #00ffcc; opacity: 0.2; }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #fff; }
            `}</style>
        </div>
    );
}
