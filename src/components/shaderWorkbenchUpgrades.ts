/**
 * shaderWorkbenchUpgrades.ts
 *
 * Extracted rendering utilities for the shader workbench preview host.
 * Covers: expanded uniform buffer, orbit camera, torus/cube mesh generators,
 * lookAt view matrix, and upgraded host shader modules with N·L + rim lighting.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ShaderWorkbenchScene = "sphere" | "fullscreen" | "torus" | "cube";

export type PreviewUniformState = {
  timeSeconds: number;
  deltaTime: number;
  frameCount: number;
  aspect: number;
  resolutionX: number;
  resolutionY: number;
  mouseX: number;
  mouseY: number;
  cameraPosition: [number, number, number];
  model: Float32Array;
  view: Float32Array;
  projection: Float32Array;
  mvp: Float32Array;
};

export type OrbitCameraState = {
  yaw: number;
  pitch: number;
  distance: number;
  autoRotate: boolean;
  mouseX: number;
  mouseY: number;
  dragging: boolean;
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * 48 floats = 192 bytes.  Layout (std140-like):
 *   [0]  timeSeconds   [1] deltaTime    [2] sceneMode  [3] frameCount
 *   [4]  resolutionX   [5] resolutionY  [6] mouseX     [7] mouseY
 *   [8]  aspect        [9] cameraX      [10] cameraY   [11] cameraZ
 *   [12..15]  padding
 *   [16..31]  modelViewProjection mat4x4
 *   [32..47]  modelMatrix mat4x4
 */
export const PREVIEW_UNIFORM_FLOATS = 48;
export const PREVIEW_UNIFORM_BYTES = PREVIEW_UNIFORM_FLOATS * 4;

const I4 = new Float32Array([1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]);

// ---------------------------------------------------------------------------
// Matrix math
// ---------------------------------------------------------------------------

function mul4(a: Float32Array, b: Float32Array) {
  const o = new Float32Array(16);
  for (let r = 0; r < 4; r++)
    for (let c = 0; c < 4; c++) {
      let s = 0;
      for (let k = 0; k < 4; k++) s += a[k*4+r] * b[c*4+k];
      o[c*4+r] = s;
    }
  return o;
}

export function buildPerspectiveMatrix(aspect: number, fovRad: number) {
  const f = 1 / Math.tan(fovRad / 2), near = 0.1, far = 100;
  return new Float32Array([
    f/aspect,0,0,0, 0,f,0,0, 0,0,far/(near-far),-1, 0,0,(near*far)/(near-far),0,
  ]);
}

function lookAt(eye: [number,number,number], tgt: [number,number,number]) {
  const fx=tgt[0]-eye[0],fy=tgt[1]-eye[1],fz=tgt[2]-eye[2];
  const fl=Math.sqrt(fx*fx+fy*fy+fz*fz)||1;
  const f=[fx/fl,fy/fl,fz/fl];
  const sx=f[1]*0-f[2]*1,sy=f[2]*0-f[0]*0,sz=f[0]*1-f[1]*0;
  // up = [0,1,0]
  const sx2=f[1]*0-f[2]*1, sy2=f[2]*0-f[0]*0, sz2=f[0]*1-f[1]*0;
  const sl=Math.sqrt(sx2*sx2+sy2*sy2+sz2*sz2)||1;
  const s=[sx2/sl,sy2/sl,sz2/sl];
  const u=[s[1]*f[2]-s[2]*f[1], s[2]*f[0]-s[0]*f[2], s[0]*f[1]-s[1]*f[0]];
  return new Float32Array([
    s[0],u[0],-f[0],0,
    s[1],u[1],-f[1],0,
    s[2],u[2],-f[2],0,
    -(s[0]*eye[0]+s[1]*eye[1]+s[2]*eye[2]),
    -(u[0]*eye[0]+u[1]*eye[1]+u[2]*eye[2]),
    (f[0]*eye[0]+f[1]*eye[1]+f[2]*eye[2]),
    1,
  ]);
}

export function orbitCameraEye(cam: OrbitCameraState): [number,number,number] {
  const cp=Math.cos(cam.pitch),sp=Math.sin(cam.pitch);
  const cy=Math.cos(cam.yaw),sy=Math.sin(cam.yaw);
  return [cam.distance*cp*sy, cam.distance*sp, cam.distance*cp*cy];
}

// ---------------------------------------------------------------------------
// Uniform state
// ---------------------------------------------------------------------------

export function sceneModeFloat(scene: ShaderWorkbenchScene): number {
  switch(scene){case"sphere":return 1;case"torus":return 2;case"cube":return 3;default:return 0;}
}

export function createPreviewUniformState(
  w: number, h: number, aspect: number, scene: ShaderWorkbenchScene,
  t: number, dt: number, frame: number, cam: OrbitCameraState,
): PreviewUniformState {
  if (scene === "fullscreen") {
    return {
      timeSeconds:t,deltaTime:dt,frameCount:frame,aspect,
      resolutionX:w,resolutionY:h,mouseX:cam.mouseX,mouseY:cam.mouseY,
      cameraPosition:[0,0,1],model:I4,view:I4,projection:I4,mvp:I4,
    };
  }
  const eye = orbitCameraEye(cam);
  const proj = buildPerspectiveMatrix(aspect, Math.PI/3);
  const view = lookAt(eye,[0,0,0]);
  return {
    timeSeconds:t,deltaTime:dt,frameCount:frame,aspect,
    resolutionX:w,resolutionY:h,mouseX:cam.mouseX,mouseY:cam.mouseY,
    cameraPosition:eye,model:I4,view,projection:proj,
    mvp:mul4(proj,mul4(view,I4)),
  };
}

export function writePreviewUniformBuffer(
  device: GPUDevice, buf: GPUBuffer, s: PreviewUniformState, scene: ShaderWorkbenchScene,
) {
  const u = new Float32Array(PREVIEW_UNIFORM_FLOATS);
  u[0]=s.timeSeconds;u[1]=s.deltaTime;u[2]=sceneModeFloat(scene);u[3]=s.frameCount;
  u[4]=s.resolutionX;u[5]=s.resolutionY;u[6]=s.mouseX;u[7]=s.mouseY;
  u[8]=s.aspect;u[9]=s.cameraPosition[0];u[10]=s.cameraPosition[1];u[11]=s.cameraPosition[2];
  u.set(s.mvp,16);u.set(s.model,32);
  device.queue.writeBuffer(buf,0,u.buffer);
}

// ---------------------------------------------------------------------------
// Mesh generators
// ---------------------------------------------------------------------------

type Mesh = { vertices: Float32Array; indices: Uint16Array };

export function createPlaneMesh(): Mesh {
  return {
    vertices: new Float32Array([-1,-1,0,0,0,1,0,0, 1,-1,0,0,0,1,1,0, 1,1,0,0,0,1,1,1, -1,1,0,0,0,1,0,1]),
    indices: new Uint16Array([0,1,2,0,2,3]),
  };
}

export function createSphereMesh(seg=32,rings=18): Mesh {
  const v:number[]=[],idx:number[]=[];
  for(let r=0;r<=rings;r++){const vr=r/rings,phi=vr*Math.PI,y=Math.cos(phi),rad=Math.sin(phi);
    for(let s=0;s<=seg;s++){const u=s/seg,th=u*Math.PI*2,x=Math.cos(th)*rad,z=Math.sin(th)*rad;
      v.push(x,y,z,x,y,z,u,1-vr);}}
  for(let r=0;r<rings;r++)for(let s=0;s<seg;s++){const a=r*(seg+1)+s,b=a+seg+1;idx.push(a,b,a+1,b,b+1,a+1);}
  return{vertices:new Float32Array(v),indices:new Uint16Array(idx)};
}

export function createTorusMesh(majSeg=32,minSeg=16,R=1.0,r=0.38): Mesh {
  const v:number[]=[],idx:number[]=[];
  for(let i=0;i<=majSeg;i++){const u=i/majSeg,th=u*Math.PI*2,ct=Math.cos(th),st=Math.sin(th);
    for(let j=0;j<=minSeg;j++){const vv=j/minSeg,ph=vv*Math.PI*2,cp=Math.cos(ph),sp=Math.sin(ph);
      v.push((R+r*cp)*ct,r*sp,(R+r*cp)*st,cp*ct,sp,cp*st,u,vv);}}
  for(let i=0;i<majSeg;i++)for(let j=0;j<minSeg;j++){const a=i*(minSeg+1)+j,b=a+minSeg+1;idx.push(a,b,a+1,b,b+1,a+1);}
  return{vertices:new Float32Array(v),indices:new Uint16Array(idx)};
}

export function createCubeMesh(): Mesh {
  const F:any[]=[
    [[-1,-1,1],[1,-1,1],[1,1,1],[-1,1,1],[0,0,1]],
    [[1,-1,-1],[-1,-1,-1],[-1,1,-1],[1,1,-1],[0,0,-1]],
    [[1,-1,1],[1,-1,-1],[1,1,-1],[1,1,1],[1,0,0]],
    [[-1,-1,-1],[-1,-1,1],[-1,1,1],[-1,1,-1],[-1,0,0]],
    [[-1,1,1],[1,1,1],[1,1,-1],[-1,1,-1],[0,1,0]],
    [[-1,-1,-1],[1,-1,-1],[1,-1,1],[-1,-1,1],[0,-1,0]],
  ];
  const uvs=[[0,0],[1,0],[1,1],[0,1]];
  const vt:number[]=[],id:number[]=[];
  for(let fi=0;fi<6;fi++){const f=F[fi],n=f[4],b=fi*4;
    for(let vi=0;vi<4;vi++){const p=f[vi];vt.push(p[0],p[1],p[2],n[0],n[1],n[2],uvs[vi][0],uvs[vi][1]);}
    id.push(b,b+1,b+2,b,b+2,b+3);}
  return{vertices:new Float32Array(vt),indices:new Uint16Array(id)};
}

export function meshForScene(scene: ShaderWorkbenchScene, seg: number, rings: number): Mesh {
  switch(scene){
    case"sphere":return createSphereMesh(seg,rings);
    case"torus":return createTorusMesh(seg,rings);
    case"cube":return createCubeMesh();
    default:return createPlaneMesh();
  }
}

// ---------------------------------------------------------------------------
// WGSL host modules
// ---------------------------------------------------------------------------

function uniformBlock() {
  return `struct PreviewUniforms {
  timeSeconds: f32, deltaTime: f32, sceneMode: f32, frameCount: f32,
  resolution: vec2<f32>, mouse: vec2<f32>,
  aspect: f32, cameraPosition: vec3<f32>,
  _pad0: vec4<f32>,
  modelViewProjection: mat4x4<f32>,
  modelMatrix: mat4x4<f32>,
};
@group(0) @binding(0) var<uniform> previewUniforms: PreviewUniforms;
`;
}

export function buildHostVertexModule() {
  return `${uniformBlock()}
struct PVI { @location(0) position: vec3<f32>, @location(1) normal: vec3<f32>, @location(2) uv: vec2<f32>, };
struct PVO { @builtin(position) position: vec4<f32>, @location(0) uv: vec2<f32>, @location(1) normal: vec3<f32>, @location(2) worldPosition: vec3<f32>, };
@vertex fn greeblefs_preview_host_vertex(input: PVI) -> PVO {
  var o: PVO;
  let wp = (previewUniforms.modelMatrix * vec4<f32>(input.position, 1.0)).xyz;
  o.position = previewUniforms.modelViewProjection * vec4<f32>(input.position, 1.0);
  o.uv = input.uv;
  o.normal = normalize((previewUniforms.modelMatrix * vec4<f32>(input.normal, 0.0)).xyz);
  o.worldPosition = wp;
  return o;
}`;
}

export function buildHostFragmentModule() {
  return `${uniformBlock()}
struct HFI { @builtin(position) position: vec4<f32>, @location(0) uv: vec2<f32>, @location(1) normal: vec3<f32>, @location(2) worldPosition: vec3<f32>, };
@fragment fn greeblefs_preview_host_fragment(input: HFI) -> @location(0) vec4<f32> {
  let N = normalize(input.normal);
  let L = normalize(vec3<f32>(0.6, 0.8, 0.5));
  let V = normalize(previewUniforms.cameraPosition - input.worldPosition);
  let H = normalize(L + V);
  let diff = dot(N, L) * 0.5 + 0.5;
  let spec = pow(max(dot(N, H), 0.0), 64.0) * 0.6;
  let rim = pow(1.0 - max(dot(N, V), 0.0), 3.0) * 0.35;
  let base = vec3<f32>(0.72, 0.82, 0.96);
  var c = vec3<f32>(0.08, 0.06, 0.12) + base * diff + vec3<f32>(spec) + vec3<f32>(0.4, 0.6, 1.0) * rim;
  c = c / (c + vec3<f32>(1.0));
  return vec4<f32>(c, 1.0);
}`;
}

export function buildTextureDisplayModule() {
  return `@group(0) @binding(0) var previewTexture: texture_2d<f32>;
struct DVO { @builtin(position) position: vec4<f32>, @location(0) uv: vec2<f32>, };
@vertex fn greeblefs_texture_vertex(@builtin(vertex_index) vi: u32) -> DVO {
  var p = array<vec2<f32>,6>(vec2(-1.0,-1.0),vec2(1.0,-1.0),vec2(1.0,1.0),vec2(-1.0,-1.0),vec2(1.0,1.0),vec2(-1.0,1.0));
  var o: DVO; o.position = vec4<f32>(p[vi], 0.0, 1.0); o.uv = p[vi]*0.5+vec2(0.5); return o;
}
@fragment fn greeblefs_texture_fragment(input: DVO) -> @location(0) vec4<f32> {
  let sz = textureDimensions(previewTexture);
  let c = vec2<i32>(clamp(input.uv*vec2<f32>(sz), vec2(0.0), vec2<f32>(sz)-vec2(1.0)));
  return textureLoad(previewTexture, c, 0);
}`;
}
