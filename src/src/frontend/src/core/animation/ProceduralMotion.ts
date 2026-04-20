
import * as THREE from 'three';
import { 
  RotateCw, Ghost, Activity, Zap, Maximize, Anchor, Wind, Infinity as InfinityIcon, 
  Heart, AlertTriangle, Video, ArrowUpFromLine, RefreshCcw, Lightbulb, Dna, 
  Snowflake, Waves, ArrowDownCircle, MoveHorizontal, Spline, Rotate3D, Tornado, 
  Radar, Flame, Milestone, RefreshCw, Terminal
} from 'lucide-react';

// --- MATH UTILS ---
const fract = (x: number) => x - Math.floor(x);
const hash = (n: number) => fract(Math.sin(n) * 43758.5453123);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const noise = (x: number) => {
    const i = Math.floor(x);
    const f = fract(x);
    const u = f * f * (3.0 - 2.0 * f);
    return lerp(hash(i), hash(i + 1.0), u);
};

export interface MotionParams {
    speed?: number;
    axis?: 'x' | 'y' | 'z';
    step?: number;
    [key: string]: any;
}

export interface MotionModifier {
    id: string;
    name: string;
    icon: any;
    params: MotionParams;
}

export const MOTION_LIBRARY: Record<string, MotionModifier> = {
  // --- CLASSICS ---
  ORBIT: { id: 'orbit', name: 'Orbit', icon: RotateCw, params: { speed: 0.5, axis: 'y', step: 0.1 } },
  FLOAT: { id: 'float', name: 'Float', icon: Ghost, params: { speed: 1.0, height: 0.5, phase: 0, step: 0.2 } },
  PULSE: { id: 'pulse', name: 'Pulse', icon: Activity, params: { speed: 3.0, scale: 0.1, base: 1.0, step: 0.1 } },
  SHAKE: { id: 'shake', name: 'Shake', icon: Zap, params: { intensity: 0.1, frequency: 10, decay: 0 } },
  ELASTIC: { id: 'elastic', name: 'Elastic', icon: Maximize, params: { speed: 4, amount: 0.15, axis: 'y', step: 0.1 } },
  
  // --- INTERMEDIATE ---
  PENDULUM: { id: 'pendulum', name: 'Pendulum', icon: Anchor, params: { speed: 2.0, angle: 45, axis: 'z', step: 0.1 } },
  WOBBLE: { id: 'wobble', name: 'Wobble', icon: Wind, params: { speed: 1.5, intensity: 0.3, step: 0.2 } },
  FIGURE8: { id: 'figure8', name: 'Figure 8', icon: InfinityIcon, params: { speed: 1.0, width: 1.0, height: 0.5, step: 0.1 } },
  HEARTBEAT: { id: 'heartbeat', name: 'Heartbeat', icon: Heart, params: { bpm: 60, intensity: 0.2, step: 0.0 } },
  GLITCH: { id: 'glitch', name: 'Glitch', icon: AlertTriangle, params: { interval: 0.5, scatter: 0.2 } },
  STEP: { id: 'step', name: 'Stop Motion', icon: Video, params: { fps: 12 } },

  // --- PHYSICS & FX ---
  BOUNCE: { id: 'bounce', name: 'Bounce', icon: ArrowUpFromLine, params: { speed: 2.0, height: 1.0, squash: 0.2, step: 0.1 } },
  TUMBLE: { id: 'tumble', name: 'Tumble', icon: RefreshCcw, params: { speedX: 0.5, speedY: 0.3, speedZ: 0.7, step: 0.05 } },
  STROBE: { id: 'strobe', name: 'Strobe', icon: Lightbulb, params: { speed: 15.0, duty: 0.5, step: 0.1 } },
  CORKSCREW: { id: 'corkscrew', name: 'Corkscrew', icon: Dna, params: { speed: 1.0, height: 1.0, rotations: 2.0, step: 0.1 } },
  SHIVER: { id: 'shiver', name: 'Shiver', icon: Snowflake, params: { intensity: 0.05, frequency: 50.0 } },
  SWAY: { id: 'sway', name: 'Sway', icon: Waves, params: { speed: 0.8, angle: 15.0, step: 0.2 } },
  YOYO: { id: 'yoyo', name: 'Yo-Yo', icon: ArrowDownCircle, params: { speed: 2.0, length: 1.5, step: 0.1 } },
  CRAB: { id: 'crab', name: 'Crab', icon: MoveHorizontal, params: { speed: 2.0, width: 1.0, step: 0.1 } },

  // --- COMPLEX ---
  LISSAJOUS: { id: 'lissajous', name: 'Lissajous', icon: Spline, params: { speed: 1.0, size: 1.0, a: 3, b: 2, step: 0.05 } },
  FLIP: { id: 'flip', name: 'Flip', icon: Rotate3D, params: { interval: 2.0, speed: 5.0, axis: 'x', step: 0.1 } },
  TREMOR: { id: 'tremor', name: 'Tremor', icon: Tornado, params: { intensity: 0.1, speed: 20.0 } },
  SCAN: { id: 'scan', name: 'Scan', icon: Radar, params: { distance: 2.0, speed: 1.0, axis: 'x', step: 0.1 } },
  WARP: { id: 'warp', name: 'Warp', icon: Flame, params: { speed: 2.0, stretch: 0.5, step: 0.1 } },
  DRIFT: { id: 'drift', name: 'Drift', icon: Milestone, params: { speed: 0.2, radius: 0.5 } },
  BOBBLE: { id: 'bobble', name: 'Bobble', icon: Activity, params: { speed: 4.0, amount: 0.3, step: 0.1 } },
  TWIST: { id: 'twist', name: 'Twist', icon: RefreshCw, params: { speed: 2.0, angle: 30, axis: 'y', step: 0.05 } },

  // --- K-SCRIPT ---
  CODE: { 
    id: 'code', name: 'K-SCRIPT', icon: Terminal, 
    params: { 
        code: "p.y += Math.sin(t * v.freq + i * 0.1) * v.amp;", error: null,
        sliders: [ { id: 'amp', label: 'Amplitude', val: 1.0, min: 0, max: 5 }, { id: 'freq', label: 'Frequency', val: 2.0, min: 0, max: 10 } ]
    } 
  }
};

// Cache for compiled scripts to avoid recompiling Function every frame
const scriptCache: Record<string, { raw: string, func: Function, valid: boolean, error?: string }> = {};

export interface TransformTarget {
    position: THREE.Vector3;
    rotation: THREE.Euler;
    scale: THREE.Vector3;
}

export const applyMotion = (
    obj: TransformTarget, 
    mod: { type: string, instanceId?: string, params: any }, 
    t: number, 
    index: number = 0
) => {
    const p = mod.params;
    const step = p.step !== undefined ? p.step : 0.1;
    const offset = index * step; 
    const time = t + offset; 

    switch(mod.type) {
      case 'orbit': 
        const rr = (time*p.speed)*(Math.PI*2)*0.1; 
        if(p.axis==='y') obj.rotation.y += rr; 
        else if(p.axis==='x') obj.rotation.x += rr; 
        else obj.rotation.z += rr; 
        break;
      
      case 'code':
        const cacheKey = mod.instanceId || 'temp'; 
        let script = scriptCache[cacheKey]; 
        const v: any = {}; 
        if(p.sliders) p.sliders.forEach((s: any) => { v[s.id] = s.val; });
        
        if (!script || script.raw !== p.code) {
            try { 
                const func = new Function('p', 'r', 's', 't', 'i', 'M', 'v', p.code); 
                scriptCache[cacheKey] = { raw: p.code, func: func, valid: true }; 
                if (p.error) { p.error = null; } 
            } catch (e: any) { 
                scriptCache[cacheKey] = { raw: p.code, func: () => {}, valid: false, error: e.message }; 
                p.error = e.message; 
                return; 
            }
            script = scriptCache[cacheKey];
        }
        if (script && script.valid) { 
            try { 
                script.func(obj.position, obj.rotation, obj.scale, t, index, Math, v); 
            } catch (re: any) { 
                script.valid = false; p.error = "Runtime: " + re.message; 
            } 
        }
        break;

      case 'float': obj.position.y += Math.sin((time * p.speed) + p.phase) * p.height; break;
      case 'pulse': obj.scale.multiplyScalar(1 + Math.sin(time * p.speed) * p.scale); break;
      case 'shake': obj.position.add(new THREE.Vector3((noise(t*p.frequency+index)-0.5)*p.intensity, (noise(t*p.frequency+100+index)-0.5)*p.intensity, (noise(t*p.frequency+200+index)-0.5)*p.intensity)); break;
      case 'elastic': 
        const str = 1+Math.sin(time*p.speed)*p.amount; 
        const sq = 1/Math.sqrt(Math.max(0.1, str)); 
        if(p.axis==='y') obj.scale.set(sq, str, sq); else obj.scale.set(str, sq, sq); 
        break;
      case 'pendulum': 
        const th = Math.sin(time*p.speed)*(p.angle*(Math.PI/180)); 
        if(p.axis==='z') obj.rotation.z+=th; else obj.rotation.x+=th; 
        break;
      case 'wobble': obj.rotation.x += Math.sin(time*p.speed)*p.intensity; obj.rotation.z += Math.cos(time*p.speed*1.3)*p.intensity; break;
      case 'figure8': obj.position.x += Math.cos(time*p.speed)*p.width; obj.position.z += Math.sin(time*p.speed*2)*(p.width*0.5); break;
      case 'heartbeat': 
        const bt=(time*(p.bpm/60))%1; 
        let bi=0; 
        if(bt<0.15) bi=Math.sin(bt*Math.PI/0.15); 
        else if(bt>0.25&&bt<0.4) bi=Math.sin((bt-0.25)*Math.PI/0.15)*0.6; 
        obj.scale.multiplyScalar(1+bi*p.intensity); 
        break;
      case 'bounce': 
        const by=Math.abs(Math.sin(time*p.speed))*p.height; 
        obj.position.y+=by; 
        if(by<0.2) { const sf=1.0+(0.2-by)*p.squash; obj.scale.set(1+sf*0.2, 1/sf, 1+sf*0.2); } 
        break;
      case 'tumble': obj.rotation.x+=time*p.speedX; obj.rotation.y+=time*p.speedY; obj.rotation.z+=time*p.speedZ; break;
      case 'strobe': if(Math.sin(time*p.speed)<=(p.duty*2-1)) obj.scale.set(0,0,0); break;
      case 'corkscrew': obj.position.y+=Math.sin(time*p.speed)*p.height; obj.rotation.y+=time*p.rotations; break;
      case 'shiver': obj.scale.multiplyScalar(1+(hash(t*p.frequency+index)-0.5)*p.intensity); break;
      case 'sway': 
        const sr=p.angle*(Math.PI/180); 
        obj.rotation.z+=Math.sin(time*p.speed)*sr; 
        obj.rotation.x+=Math.cos(time*p.speed*0.7)*(sr*0.5); 
        break;
      case 'yoyo': obj.position.y-=Math.abs(Math.sin(time*p.speed))*p.length; break;
      case 'crab': obj.position.x+=Math.sin(time*p.speed)*p.width; break;
      case 'lissajous': obj.position.add(new THREE.Vector3(p.size*Math.sin(p.a*time*p.speed), p.size*Math.sin(p.b*time*p.speed), p.size*Math.sin(time*p.speed))); break;
      case 'flip': 
        const ft=(time*p.speed)%p.interval; 
        if(ft<1.0) { 
            const ea=ft*ft*(3-2*ft); 
            const an=ea*Math.PI*2; 
            if(p.axis==='x')obj.rotation.x+=an; if(p.axis==='y')obj.rotation.y+=an; if(p.axis==='z')obj.rotation.z+=an; 
        } 
        break;
      case 'tremor': 
        obj.rotation.x+=(noise(t*p.speed+index)-0.5)*p.intensity; 
        obj.rotation.y+=(noise(t*p.speed+100+index)-0.5)*p.intensity; 
        obj.rotation.z+=(noise(t*p.speed+200+index)-0.5)*p.intensity; 
        break;
      case 'scan': 
        const sp=Math.sin(time*p.speed)*p.distance; 
        if(p.axis==='x')obj.position.x+=sp; if(p.axis==='y')obj.position.y+=sp; if(p.axis==='z')obj.position.z+=sp; 
        break;
      case 'warp': 
        const wv=Math.sin(time*p.speed); 
        obj.position.z+=wv*5; 
        const ws=1+Math.abs(Math.cos(time*p.speed))*p.stretch; 
        obj.scale.z*=ws; obj.scale.x/=Math.sqrt(ws); obj.scale.y/=Math.sqrt(ws); 
        break;
      case 'drift': obj.position.add(new THREE.Vector3((noise(t*p.speed+index)-0.5)*p.radius*5, (noise(t*p.speed+50+index)-0.5)*p.radius*5, (noise(t*p.speed+100+index)-0.5)*p.radius*5)); break;
      case 'bobble': 
        const bY=Math.abs(Math.sin(time*p.speed)); 
        obj.position.y+=bY*0.2; 
        obj.rotation.z+=Math.cos(time*p.speed)*p.amount; 
        break;
      case 'twist': 
        const ta=Math.sin(time*p.speed)*(p.angle*Math.PI/180); 
        if(p.axis==='y')obj.rotation.y+=ta; if(p.axis==='x')obj.rotation.x+=ta; if(p.axis==='z')obj.rotation.z+=ta; 
        break;
      default: break;
    }
};
