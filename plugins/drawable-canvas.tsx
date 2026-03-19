import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { definePlugin } from 'overlayterm-plugin';

/* ─── types ─────────────────────────────────────────────────────────────── */
type Point = { x: number; y: number; pressure: number; time: number };
type Size  = { width: number; height: number };
type Rect  = { x: number; y: number; width: number; height: number };

type OverlayPluginStorageApi = {
  rootDir: string;
  ensureDir: (relativePath?: string) => Promise<string>;
  readTextFile: (relativePath: string) => Promise<string>;
  writeTextFile: (relativePath: string, data: string) => Promise<void>;
  writeFile: (relativePath: string, data: Uint8Array) => Promise<void>;
};
type OverlayPluginApi   = { storage?: OverlayPluginStorageApi };
type OverlayAppearance  = { theme: { palette?: { accent?: string; textMuted?: string } } };
type HostContext        = { width: number; height: number; compact: boolean; density: 'compact' | 'regular' };
type PluginProps        = { plugin: { id: string; name: string }; api?: OverlayPluginApi; appearance: OverlayAppearance; host?: HostContext };

type BrushPreset = {
  id: string; label: string; icon: string; color: string;
  size: number; opacity: number; softness: number; spacing: number;
  scatter: number; flow: number; blendMode: GlobalCompositeOperation;
  stampNoise: number; texture: 'smooth' | 'rough' | 'bristle' | 'splat' | 'neon';
  hardness: number;
};
type TextEntry = { x: number; y: number; text: string; color: string; size: number; font: string };
type SaveStatus = { kind: 'idle' | 'saving' | 'success' | 'error'; message: string };
type SketchEntry = { id: string; savedAt: string; dataUrl: string };

/* ─── constants ──────────────────────────────────────────────────────────── */
const MIN_STAGE: Size = { width: 280, height: 180 };
const INIT_STAGE: Size = { width: 960, height: 540 };
const EFX_PAD = 18;

const SWATCHES = [
  '#f8fafc','#7dd3fc','#34d399','#f97316','#f472b6',
  '#facc15','#60a5fa','#a78bfa','#fb7185','#4ade80',
];

const BRUSH_PRESETS: BrushPreset[] = [
  { id:'ink',        label:'Ink',        icon:'✒️', color:'#c4b5fd', size:5,  opacity:0.96, softness:0.08, spacing:0.12, scatter:0.01, flow:0.1,  blendMode:'source-over',      stampNoise:0.03, texture:'smooth',  hardness:0.9  },
  { id:'pencil',     label:'Pencil',     icon:'✏️', color:'#cbd5e1', size:4,  opacity:0.72, softness:0.22, spacing:0.09, scatter:0.06, flow:0.15, blendMode:'source-over',      stampNoise:0.12, texture:'rough',   hardness:0.75 },
  { id:'charcoal',   label:'Charcoal',   icon:'🖊️', color:'#64748b', size:18, opacity:0.38, softness:0.55, spacing:0.07, scatter:0.18, flow:0.3,  blendMode:'source-over',      stampNoise:0.28, texture:'rough',   hardness:0.4  },
  { id:'marker',     label:'Marker',     icon:'🖍️', color:'#34d399', size:20, opacity:0.28, softness:0.44, spacing:0.08, scatter:0.04, flow:0.4,  blendMode:'source-over',      stampNoise:0.06, texture:'smooth',  hardness:0.65 },
  { id:'paint',      label:'Paint',      icon:'🖌️', color:'#f97316', size:30, opacity:0.20, softness:0.72, spacing:0.07, scatter:0.14, flow:0.82, blendMode:'source-over',      stampNoise:0.18, texture:'bristle', hardness:0.3  },
  { id:'airbrush',   label:'Airbrush',   icon:'💨', color:'#7dd3fc', size:48, opacity:0.10, softness:0.92, spacing:0.05, scatter:0.08, flow:0.6,  blendMode:'source-over',      stampNoise:0.05, texture:'smooth',  hardness:0.08 },
  { id:'calligraphy',label:'Callig.',    icon:'🪶', color:'#f8fafc', size:8,  opacity:0.88, softness:0.12, spacing:0.10, scatter:0.0,  flow:0.12, blendMode:'source-over',      stampNoise:0.02, texture:'smooth',  hardness:0.95 },
  { id:'splatter',   label:'Splatter',   icon:'💥', color:'#fb7185', size:22, opacity:0.55, softness:0.38, spacing:0.22, scatter:0.82, flow:0.5,  blendMode:'source-over',      stampNoise:0.45, texture:'splat',   hardness:0.5  },
  { id:'neon',       label:'Neon',       icon:'⚡', color:'#a78bfa', size:10, opacity:0.70, softness:0.06, spacing:0.11, scatter:0.0,  flow:0.2,  blendMode:'lighter',          stampNoise:0.04, texture:'neon',    hardness:0.85 },
  { id:'eraser',     label:'Eraser',     icon:'⬜', color:'#ffffff', size:30, opacity:0.90, softness:0.78, spacing:0.08, scatter:0.0,  flow:0.0,  blendMode:'destination-out',  stampNoise:0.0,  texture:'smooth',  hardness:0.5  },
];

const EFFECT_PRESETS = [
  { id:'none',   label:'Flat',   description:'Direct paint.' },
  { id:'sculpt', label:'Sculpt', description:'Relief lighting.' },
  { id:'flow',   label:'Flow',   description:'Wet smear.' },
];

const TEXT_FONTS = ['Inter, sans-serif','Georgia, serif','Courier New, monospace','Pacifico, cursive'];

/* ─── math helpers ───────────────────────────────────────────────────────── */
const clamp  = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const lerp   = (a: number, b: number, t: number)    => a + (b - a) * t;
const noise  = (x: number, y: number, s: number)    => { const v = Math.sin(x * 12.9898 + y * 78.233 + s * 37.719) * 43758.5453; return v - Math.floor(v); };

function normalizeSize(s: Size): Size { return { width: Math.max(Math.floor(s.width), MIN_STAGE.width), height: Math.max(Math.floor(s.height), MIN_STAGE.height) }; }
function createSurface(s: Size): HTMLCanvasElement { const c = document.createElement('canvas'); c.width = s.width; c.height = s.height; return c; }
function scaleSurface(src: HTMLCanvasElement | null, s: Size): HTMLCanvasElement {
  const next = createSurface(s);
  if (src && src.width > 0 && src.height > 0) { const ctx = next.getContext('2d'); ctx?.drawImage(src, 0, 0, src.width, src.height, 0, 0, s.width, s.height); }
  return next;
}
function rectFromCenter(x: number, y: number, r: number, s: Size, pad = 8): Rect | null {
  const l = clamp(Math.floor(x - r - pad), 0, s.width), ri = clamp(Math.ceil(x + r + pad), 0, s.width);
  const t = clamp(Math.floor(y - r - pad), 0, s.height), b = clamp(Math.ceil(y + r + pad), 0, s.height);
  return ri <= l || b <= t ? null : { x: l, y: t, width: ri - l, height: b - t };
}
function mergeRects(a: Rect, b: Rect): Rect {
  const x1 = Math.min(a.x, b.x), y1 = Math.min(a.y, b.y);
  const x2 = Math.max(a.x + a.width, b.x + b.width), y2 = Math.max(a.y + a.height, b.y + b.height);
  return { x: x1, y: y1, width: x2 - x1, height: y2 - y1 };
}
function expandRect(r: Rect, s: Size, pad: number): Rect {
  const l = clamp(r.x - pad, 0, s.width), t = clamp(r.y - pad, 0, s.height);
  const ri = clamp(r.x + r.width + pad, 0, s.width), b = clamp(r.y + r.height + pad, 0, s.height);
  return { x: l, y: t, width: Math.max(ri - l, 1), height: Math.max(b - t, 1) };
}
function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = name; a.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function getFallback(id: string): BrushPreset { return BRUSH_PRESETS.find(b => b.id === id) ?? BRUSH_PRESETS[0]; }

/* ─── sketch library helpers ─────────────────────────────────────────────── */
const LIBRARY_INDEX = 'sketches/index.json';
async function loadLibrary(storage: OverlayPluginStorageApi): Promise<SketchEntry[]> {
  try { return JSON.parse(await storage.readTextFile(LIBRARY_INDEX)); } catch { return []; }
}
async function saveLibrary(storage: OverlayPluginStorageApi, entries: SketchEntry[]) {
  await storage.ensureDir('sketches');
  await storage.writeTextFile(LIBRARY_INDEX, JSON.stringify(entries, null, 2));
}

/* ─── icon button ────────────────────────────────────────────────────────── */
function IconBtn({ title, active, danger, onClick, children }: { title: string; active?: boolean; danger?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button title={title} type="button" onClick={onClick} style={{
      display:'flex', alignItems:'center', justifyContent:'center',
      width: 28, height: 28, borderRadius: 7, cursor: 'pointer', fontSize: 13,
      border: active ? '1px solid rgba(167,139,250,0.7)' : '1px solid rgba(148,163,184,0.14)',
      background: active ? 'rgba(167,139,250,0.18)' : danger ? 'rgba(239,68,68,0.10)' : 'rgba(255,255,255,0.04)',
      color: danger ? '#fca5a5' : 'var(--overlay-text-primary)',
      transition: 'all 0.12s',
    }}>{children}</button>
  );
}

/* ─── library modal ──────────────────────────────────────────────────────── */
function LibraryModal({ entries, onClose, onExport, onCopy, onDelete }: {
  entries: SketchEntry[]; onClose: () => void;
  onExport: (e: SketchEntry) => void; onCopy: (e: SketchEntry) => void; onDelete: (id: string) => void;
}) {
  return (
    <div style={{ position:'fixed', inset:0, zIndex:9999, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(0,0,0,0.72)', backdropFilter:'blur(8px)' }} onClick={onClose}>
      <div style={{ position:'relative', width:'min(92vw,860px)', maxHeight:'82vh', display:'flex', flexDirection:'column', borderRadius:20, border:'1px solid rgba(148,163,184,0.18)', background:'rgba(9,13,28,0.97)', boxShadow:'0 32px 80px rgba(0,0,0,0.55)', overflow:'hidden' }}
        onClick={e => e.stopPropagation()}>
        {/* header */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'14px 18px', borderBottom:'1px solid rgba(148,163,184,0.10)' }}>
          <span style={{ fontWeight:700, fontSize:14, color:'#f8fafc', letterSpacing:0.3 }}>📚 Sketch Library</span>
          <button type="button" onClick={onClose} style={{ background:'none', border:'none', color:'rgba(226,232,240,0.5)', fontSize:18, cursor:'pointer', lineHeight:1 }}>✕</button>
        </div>
        {/* grid */}
        <div style={{ flex:1, overflowY:'auto', padding:16, display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(180px,1fr))', gap:12 }}>
          {entries.length === 0 && <div style={{ gridColumn:'1/-1', textAlign:'center', color:'rgba(226,232,240,0.35)', padding:'48px 0', fontSize:13 }}>No saved sketches yet.</div>}
          {entries.map(entry => (
            <div key={entry.id} style={{ borderRadius:12, border:'1px solid rgba(148,163,184,0.14)', background:'rgba(255,255,255,0.03)', overflow:'hidden', display:'flex', flexDirection:'column' }}>
              <img src={entry.dataUrl} alt={`Sketch ${entry.savedAt}`} style={{ width:'100%', aspectRatio:'16/9', objectFit:'cover', display:'block' }} />
              <div style={{ padding:'7px 8px', display:'flex', flexDirection:'column', gap:4 }}>
                <span style={{ fontSize:10, color:'rgba(226,232,240,0.38)' }}>{new Date(entry.savedAt).toLocaleString()}</span>
                <div style={{ display:'flex', gap:4 }}>
                  <button type="button" onClick={() => onCopy(entry)} title="Copy to clipboard" style={{ flex:1, fontSize:10, padding:'4px 0', borderRadius:6, border:'1px solid rgba(148,163,184,0.18)', background:'rgba(255,255,255,0.04)', color:'#f8fafc', cursor:'pointer' }}>Copy</button>
                  <button type="button" onClick={() => onExport(entry)} title="Export PNG" style={{ flex:1, fontSize:10, padding:'4px 0', borderRadius:6, border:'1px solid rgba(148,163,184,0.18)', background:'rgba(255,255,255,0.04)', color:'#f8fafc', cursor:'pointer' }}>Export</button>
                  <button type="button" onClick={() => onDelete(entry.id)} title="Delete" style={{ flex:1, fontSize:10, padding:'4px 0', borderRadius:6, border:'1px solid rgba(239,68,68,0.28)', background:'rgba(239,68,68,0.07)', color:'#fca5a5', cursor:'pointer' }}>Del</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─── main component ──────────────────────────────────────────────────────── */
function CanvasPad({ plugin, api, appearance, host }: PluginProps) {
  const stageRef          = useRef<HTMLDivElement | null>(null);
  const canvasRef         = useRef<HTMLCanvasElement | null>(null);
  const paintSurfaceRef   = useRef<HTMLCanvasElement | null>(null);
  const effectSurfaceRef  = useRef<HTMLCanvasElement | null>(null);
  const paintCtxRef       = useRef<CanvasRenderingContext2D | null>(null);
  const effectCtxRef      = useRef<CanvasRenderingContext2D | null>(null);
  const artworkSizeRef    = useRef<Size>(INIT_STAGE);
  const lastPointRef      = useRef<Point | null>(null);
  const isDrawingRef      = useRef(false);
  const dirtyRef          = useRef<Rect | null>(null);
  const renderFrameRef    = useRef<number | null>(null);
  const effectFrameRef    = useRef<number | null>(null);
  const effectPresetRef   = useRef(EFFECT_PRESETS[1].id);
  const textInputRef      = useRef<HTMLInputElement | null>(null);

  const [viewportSize, setViewportSize]   = useState<Size>(INIT_STAGE);
  const [brushId, setBrushId]             = useState(BRUSH_PRESETS[0].id);
  const [effectId, setEffectId]           = useState(EFFECT_PRESETS[1].id);
  const [strokeColor, setStrokeColor]     = useState(appearance.theme.palette?.accent ?? BRUSH_PRESETS[0].color);
  const [brushSize, setBrushSize]         = useState(BRUSH_PRESETS[0].size);
  const [brushOpacity, setBrushOpacity]   = useState(BRUSH_PRESETS[0].opacity);
  const [saveStatus, setSaveStatus]       = useState<SaveStatus>({ kind:'idle', message:'Ready.' });
  const [showLibrary, setShowLibrary]     = useState(false);
  const [libraryEntries, setLibraryEntries] = useState<SketchEntry[]>([]);
  // text tool
  const [tool, setTool]                   = useState<'draw' | 'text'>('draw');
  const [textEntry, setTextEntry]         = useState<TextEntry | null>(null);
  const [pendingText, setPendingText]     = useState('');
  const [textFont, setTextFont]           = useState(TEXT_FONTS[0]);
  const [textSize, setTextSize]           = useState(22);

  const muted     = appearance.theme.palette?.textMuted ?? 'rgba(226,232,240,0.7)';
  const isCompact = host?.compact ?? viewportSize.width < 960;

  const activeBrush = useMemo(() => {
    const p = getFallback(brushId);
    return { ...p, color: p.id === 'eraser' ? p.color : strokeColor, size: brushSize, opacity: brushOpacity };
  }, [brushId, brushOpacity, brushSize, strokeColor]);

  /* ── surfaces ── */
  const syncArtworkSize = useCallback((size: Size) => {
    const ns = normalizeSize(size);
    const cur = artworkSizeRef.current;
    const ps = paintSurfaceRef.current; const es = effectSurfaceRef.current;
    if (ps && es && cur.width === ns.width && cur.height === ns.height) return;
    const np = scaleSurface(ps, ns); const ne = scaleSurface(es, ns);
    paintSurfaceRef.current = np; effectSurfaceRef.current = ne;
    paintCtxRef.current   = np.getContext('2d', { willReadFrequently: true });
    effectCtxRef.current  = ne.getContext('2d');
    artworkSizeRef.current = ns;
    dirtyRef.current = { x:0, y:0, width:ns.width, height:ns.height };
  }, []);

  const ensureSurfaces = useCallback(() => syncArtworkSize(artworkSizeRef.current), [syncArtworkSize]);

  const markDirty = useCallback((x: number, y: number, r: number) => {
    const next = rectFromCenter(x, y, r, artworkSizeRef.current);
    if (!next) return;
    dirtyRef.current = dirtyRef.current ? mergeRects(dirtyRef.current, next) : next;
  }, []);

  const consumeDirty = useCallback((full: boolean): Rect | null => {
    const s = artworkSizeRef.current;
    if (full) { dirtyRef.current = null; return { x:0, y:0, width:s.width, height:s.height }; }
    const d = dirtyRef.current; dirtyRef.current = null;
    return d ? expandRect(d, s, EFX_PAD) : null;
  }, []);

  /* ── render ── */
  const renderCanvas = useCallback(() => {
    const canvas = canvasRef.current; const ps = paintSurfaceRef.current; const es = effectSurfaceRef.current;
    if (!canvas || !ps || !es) return;
    const w = Math.max(Math.floor(viewportSize.width), MIN_STAGE.width);
    const h = Math.max(Math.floor(viewportSize.height), MIN_STAGE.height);
    const dpr = window.devicePixelRatio || 1;
    const tw = Math.floor(w * dpr); const th = Math.floor(h * dpr);
    if (canvas.width !== tw || canvas.height !== th) { canvas.width = tw; canvas.height = th; canvas.style.width = `${w}px`; canvas.style.height = `${h}px`; }
    const ctx = canvas.getContext('2d'); if (!ctx) return;
    const art = artworkSizeRef.current;
    const visible = effectPresetRef.current === 'none' || isDrawingRef.current ? ps : es;
    ctx.save(); ctx.setTransform(dpr,0,0,dpr,0,0); ctx.clearRect(0,0,w,h);
    const bg = ctx.createLinearGradient(0,0,w,h);
    bg.addColorStop(0,'rgba(18,31,48,0.96)'); bg.addColorStop(0.52,'rgba(13,17,31,0.98)'); bg.addColorStop(1,'rgba(7,10,19,1)');
    ctx.fillStyle = bg; ctx.fillRect(0,0,w,h);
    const glow = ctx.createRadialGradient(w*0.12,h*0.08,0,w*0.12,h*0.08,w*0.75);
    glow.addColorStop(0,'rgba(96,165,250,0.18)'); glow.addColorStop(0.35,'rgba(99,102,241,0.07)'); glow.addColorStop(1,'rgba(0,0,0,0)');
    ctx.fillStyle = glow; ctx.fillRect(0,0,w,h);
    ctx.strokeStyle = 'rgba(148,163,184,0.09)'; ctx.lineWidth = 1;
    for (let x=0; x<=w; x+=36) { ctx.beginPath(); ctx.moveTo(x+0.5,0); ctx.lineTo(x+0.5,h); ctx.stroke(); }
    for (let y=0; y<=h; y+=36) { ctx.beginPath(); ctx.moveTo(0,y+0.5); ctx.lineTo(w,y+0.5); ctx.stroke(); }
    ctx.drawImage(visible, 0,0,art.width,art.height, 0,0,w,h);
    ctx.restore();
  }, [viewportSize.height, viewportSize.width]);

  const scheduleRender = useCallback(() => {
    if (renderFrameRef.current !== null) return;
    renderFrameRef.current = window.requestAnimationFrame(() => { renderFrameRef.current = null; renderCanvas(); });
  }, [renderCanvas]);

  /* ── effect pass ── */
  const applyEffect = useCallback((eid: string, region: Rect | null) => {
    ensureSurfaces();
    const ps = paintSurfaceRef.current; const pc = paintCtxRef.current; const ec = effectCtxRef.current;
    const art = artworkSizeRef.current;
    if (!ps || !pc || !ec) return;
    const area = region ?? { x:0, y:0, width:art.width, height:art.height };
    if (eid === 'none') { ec.clearRect(area.x,area.y,area.width,area.height); ec.drawImage(ps,area.x,area.y,area.width,area.height,area.x,area.y,area.width,area.height); return; }
    const src = pc.getImageData(area.x,area.y,area.width,area.height);
    const tgt = ec.createImageData(area.width,area.height);
    const inp = src.data; const out = tgt.data; const W = src.width; const H = src.height;
    const ll = Math.sqrt(0.28**2+0.45**2+0.85**2);
    const lx=0.28/ll, ly=-0.45/ll, lz=0.85/ll;
    const samp = (sx:number,sy:number,ch:number) => inp[(clamp(Math.round(sy),0,H-1)*W+clamp(Math.round(sx),0,W-1))*4+ch]/255;
    for (let y=0;y<H;y++) for (let x=0;x<W;x++) {
      const i=(y*W+x)*4;
      const r=inp[i]/255,g=inp[i+1]/255,b=inp[i+2]/255,a=inp[i+3]/255;
      const nx=samp(x-3,y,3)-samp(x+3,y,3), ny=samp(x,y-3,3)-samp(x,y+3,3), nz=0.75;
      const nl=Math.sqrt(nx*nx+ny*ny+nz*nz)||1;
      const NX=nx/nl,NY=ny/nl,NZ=nz/nl;
      const diff=clamp(NX*lx+NY*ly+NZ*lz,0,1), spec=diff**18;
      let nr=r,ng=g,nb=b,na=a;
      if (eid==='sculpt') {
        const tr=0.5+0.5*Math.cos(1.2+diff*4-(y/Math.max(H,1))*2.6);
        const tg=0.5+0.5*Math.cos(2.1+diff*4-(y/Math.max(H,1))*2.2);
        const tb=0.5+0.5*Math.cos(3.4+diff*4-(y/Math.max(H,1))*1.8);
        const rim=1-Math.abs(NZ);
        nr=clamp(r*(0.75+diff*0.5)+tr*a*0.18+spec*0.4+rim*0.08,0,1);
        ng=clamp(g*(0.75+diff*0.5)+tg*a*0.18+spec*0.34+rim*0.08,0,1);
        nb=clamp(b*(0.75+diff*0.5)+tb*a*0.18+spec*0.45+rim*0.1,0,1);
      } else if (eid==='flow') {
        const fn=noise((x+area.x)/26,(y+area.y)/26,0.37)*Math.PI*2;
        const ox=(NX*9+Math.cos(fn)*4)*a, oy=(NY*9+Math.sin(fn)*4)*a;
        const si=(clamp(Math.round(y-oy),0,H-1)*W+clamp(Math.round(x-ox),0,W-1))*4;
        const wet=clamp(a*1.35,0,1);
        nr=clamp(lerp(r,inp[si]/255,0.58*wet)+diff*0.08,0,1);
        ng=clamp(lerp(g,inp[si+1]/255,0.58*wet)+diff*0.08,0,1);
        nb=clamp(lerp(b,inp[si+2]/255,0.58*wet)+diff*0.12,0,1);
        na=clamp(a+wet*0.08,0,1);
      }
      out[i]=Math.round(nr*255); out[i+1]=Math.round(ng*255); out[i+2]=Math.round(nb*255); out[i+3]=Math.round(na*255);
    }
    ec.putImageData(tgt,area.x,area.y);
  }, [ensureSurfaces]);

  const flushEffect = useCallback((opts?: { full?: boolean; eid?: string }) => {
    const dirty = consumeDirty(Boolean(opts?.full));
    if (!dirty) { scheduleRender(); return; }
    applyEffect(opts?.eid ?? effectPresetRef.current, dirty);
    scheduleRender();
  }, [applyEffect, consumeDirty, scheduleRender]);

  const queueEffect = useCallback((opts?: { full?: boolean; immediate?: boolean; eid?: string }) => {
    const art = artworkSizeRef.current;
    if (opts?.full) dirtyRef.current = { x:0, y:0, width:art.width, height:art.height };
    if (opts?.immediate) { flushEffect({ full:opts.full, eid:opts.eid }); return; }
    if (effectFrameRef.current !== null) return;
    effectFrameRef.current = window.requestAnimationFrame(() => { effectFrameRef.current = null; flushEffect({ eid:opts?.eid }); });
  }, [flushEffect]);

  /* ── paint stamp ── */
  const paintStamp = useCallback((pt: Point, radius: number, opScale: number, seed: number) => {
    const ctx = paintCtxRef.current; if (!ctx) return;
    const br = activeBrush;
    const n = br.stampNoise > 0 ? (noise(pt.x, pt.y, seed) - 0.5) * br.stampNoise : 0;
    const jx = (noise(pt.x, pt.y, seed+1) - 0.5) * radius * br.scatter;
    const jy = (noise(pt.x, pt.y, seed+2) - 0.5) * radius * br.scatter;
    const r  = Math.max(radius * (1 + n), 0.5);
    ctx.save();
    ctx.globalCompositeOperation = br.blendMode;
    ctx.globalAlpha = clamp(br.opacity * opScale, 0.02, 1);

    if (br.texture === 'bristle') {
      // bristle effect — multiple thin lines
      const bristles = 6;
      for (let i=0; i<bristles; i++) {
        const angle = (i/bristles)*Math.PI*2 + seed;
        const spread = r*0.6;
        ctx.strokeStyle = br.color;
        ctx.lineWidth = Math.max(r*0.18, 0.5);
        ctx.beginPath();
        ctx.moveTo(pt.x+jx, pt.y+jy);
        ctx.lineTo(pt.x+jx+Math.cos(angle)*spread, pt.y+jy+Math.sin(angle)*spread);
        ctx.stroke();
      }
    } else if (br.texture === 'splat') {
      const splats = Math.floor(3 + noise(pt.x,pt.y,seed)*5);
      for (let i=0;i<splats;i++) {
        const a = noise(pt.x,pt.y,seed+i+10)*Math.PI*2;
        const d = noise(pt.x,pt.y,seed+i+20)*r*1.2;
        const sr = Math.max(noise(pt.x,pt.y,seed+i+30)*r*0.5, 1);
        ctx.fillStyle = br.color;
        ctx.beginPath();
        ctx.arc(pt.x+jx+Math.cos(a)*d, pt.y+jy+Math.sin(a)*d, sr, 0, Math.PI*2);
        ctx.fill();
      }
    } else if (br.texture === 'rough') {
      // rough — grain by drawing multiple small dots with offsets
      const grains = Math.floor(8 + br.size * 0.8);
      for (let i=0;i<grains;i++) {
        const a = noise(pt.x,pt.y,seed+i)*Math.PI*2;
        const d = noise(pt.x,pt.y,seed+i+50)*r;
        const gs = Math.max(noise(pt.x,pt.y,seed+i+100)*r*0.25, 0.4);
        ctx.fillStyle = br.color;
        ctx.globalAlpha = clamp(br.opacity*opScale*(0.4+noise(pt.x,pt.y,seed+i+150)*0.6), 0.01, 1);
        ctx.beginPath();
        ctx.arc(pt.x+Math.cos(a)*d, pt.y+Math.sin(a)*d, gs, 0, Math.PI*2);
        ctx.fill();
      }
    } else if (br.texture === 'neon') {
      // neon glow — layered radial gradient with bloom
      const grd = ctx.createRadialGradient(pt.x+jx,pt.y+jy,0,pt.x+jx,pt.y+jy,r*2.5);
      grd.addColorStop(0,'rgba(255,255,255,0.95)');
      grd.addColorStop(0.15, br.color);
      grd.addColorStop(0.6, br.color.replace(')',',0.18)').replace('rgb(','rgba(').replace('#','')); // approximate fade
      grd.addColorStop(1,'rgba(0,0,0,0)');
      ctx.fillStyle = grd;
      ctx.beginPath(); ctx.arc(pt.x+jx,pt.y+jy,r*2.5,0,Math.PI*2); ctx.fill();
    } else {
      // smooth — standard radial gradient
      const inner = r * br.softness;
      const grd = ctx.createRadialGradient(pt.x+jx,pt.y+jy,inner,pt.x+jx,pt.y+jy,r);
      if (br.blendMode === 'destination-out') {
        grd.addColorStop(0,'rgba(0,0,0,1)'); grd.addColorStop(1,'rgba(0,0,0,0)');
      } else {
        grd.addColorStop(0, br.color); grd.addColorStop(0.75, br.color); grd.addColorStop(1,'rgba(0,0,0,0)');
      }
      ctx.fillStyle = grd;
      ctx.beginPath(); ctx.arc(pt.x+jx,pt.y+jy,r,0,Math.PI*2); ctx.fill();
    }

    ctx.restore();
    markDirty(pt.x+jx, pt.y+jy, r*(br.texture==='neon'?2.5:1));
  }, [activeBrush, markDirty]);

  const paintSegment = useCallback((start: Point, end: Point) => {
    const dx = end.x-start.x, dy = end.y-start.y;
    const dist = Math.sqrt(dx*dx+dy*dy);
    const spacing = Math.max(activeBrush.size*activeBrush.spacing, 1);
    const steps = Math.max(Math.ceil(dist/spacing), 1);
    for (let i=0;i<=steps;i++) {
      const a = i/steps;
      const pressure = lerp(start.pressure,end.pressure,a);
      const r = Math.max((activeBrush.size*clamp(pressure,0.35,1.4))/2, 0.5);
      paintStamp({ x:lerp(start.x,end.x,a), y:lerp(start.y,end.y,a), pressure, time:lerp(start.time,end.time,a) }, r, 0.7+pressure*0.35+activeBrush.flow*0.2, i+start.time*0.001);
    }
  }, [activeBrush, paintStamp]);

  const getPoint = useCallback((e: React.PointerEvent<HTMLCanvasElement>): Point => {
    const rect = e.currentTarget.getBoundingClientRect(); const art = artworkSizeRef.current;
    return { x:clamp(((e.clientX-rect.left)/Math.max(rect.width,1))*art.width,0,art.width), y:clamp(((e.clientY-rect.top)/Math.max(rect.height,1))*art.height,0,art.height), pressure:clamp(e.pressure||0.5,0.15,1.25), time:e.timeStamp };
  }, []);

  const stopDrawing = useCallback(() => {
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false; lastPointRef.current = null; queueEffect();
  }, [queueEffect]);

  const startDrawing = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (tool !== 'draw') return;
    ensureSurfaces(); e.preventDefault(); e.currentTarget.setPointerCapture(e.pointerId);
    const pt = getPoint(e); isDrawingRef.current = true; lastPointRef.current = pt;
    paintSegment(pt,pt); scheduleRender();
  }, [ensureSurfaces, getPoint, paintSegment, scheduleRender, tool]);

  const continueDrawing = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current || !lastPointRef.current) return;
    const pt = getPoint(e); paintSegment(lastPointRef.current, pt); lastPointRef.current = pt; scheduleRender();
  }, [getPoint, paintSegment, scheduleRender]);

  const endDrawing = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    stopDrawing();
  }, [stopDrawing]);

  /* ── text tool ── */
  const handleCanvasClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (tool !== 'text') return;
    const rect = e.currentTarget.getBoundingClientRect(); const art = artworkSizeRef.current;
    const x = ((e.clientX-rect.left)/Math.max(rect.width,1))*art.width;
    const y = ((e.clientY-rect.top)/Math.max(rect.height,1))*art.height;
    setTextEntry({ x, y, text:'', color:strokeColor, size:textSize, font:textFont });
    setPendingText('');
    window.requestAnimationFrame(() => textInputRef.current?.focus());
  }, [tool, strokeColor, textSize, textFont]);

  const commitText = useCallback(() => {
    if (!textEntry || !pendingText.trim()) { setTextEntry(null); return; }
    const ctx = paintCtxRef.current; if (!ctx) { setTextEntry(null); return; }
    ctx.save();
    ctx.font = `${textEntry.size}px ${textEntry.font}`;
    ctx.fillStyle = textEntry.color;
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.fillText(pendingText, textEntry.x, textEntry.y);
    ctx.restore();
    markDirty(textEntry.x, textEntry.y, Math.max(pendingText.length * textEntry.size, 80));
    queueEffect();
    setTextEntry(null); setPendingText('');
  }, [textEntry, pendingText, markDirty, queueEffect]);

  /* ── copy to clipboard ── */
  const copyToClipboard = useCallback(async () => {
    ensureSurfaces(); flushEffect({ full:true, eid:effectId });
    const es = effectSurfaceRef.current; if (!es) return;
    setSaveStatus({ kind:'saving', message:'Copying...' });
    try {
      const blob = await new Promise<Blob|null>(res => es.toBlob(res,'image/png'));
      if (!blob) throw new Error('toBlob failed');
      await (navigator.clipboard as any).write([new (window as any).ClipboardItem({ 'image/png': blob })]);
      setSaveStatus({ kind:'success', message:'Copied to clipboard!' });
    } catch (err) {
      setSaveStatus({ kind:'error', message:`Copy failed: ${String(err)}` });
    }
    setTimeout(() => setSaveStatus({ kind:'idle', message:'Ready.' }), 3000);
  }, [ensureSurfaces, flushEffect, effectId]);

  /* ── save + library ── */
  const saveSketch = useCallback(async () => {
    ensureSurfaces(); flushEffect({ full:true, eid:effectId });
    const es = effectSurfaceRef.current; if (!es) return;
    setSaveStatus({ kind:'saving', message:'Saving...' });
    const blob = await new Promise<Blob|null>(res => es.toBlob(res,'image/png'));
    if (!blob) { setSaveStatus({ kind:'error', message:'PNG export failed.' }); return; }
    const savedAt = new Date().toISOString();
    const safeStamp = savedAt.replace(/[:.]/g,'-');
    const dataUrl = es.toDataURL('image/png');
    const entry: SketchEntry = { id: safeStamp, savedAt, dataUrl };

    if (api?.storage) {
      try {
        await api.storage.ensureDir('sketches');
        const bytes = new Uint8Array(await blob.arrayBuffer());
        await api.storage.writeFile(`sketches/${safeStamp}.png`, bytes);
        const existing = await loadLibrary(api.storage);
        const updated = [entry, ...existing];
        await saveLibrary(api.storage, updated);
        setLibraryEntries(updated);
        setSaveStatus({ kind:'success', message:`Saved to sketch library.` });
        setTimeout(() => setSaveStatus({ kind:'idle', message:'Ready.' }), 3000);
        return;
      } catch { /* fall through to download */ }
    }
    downloadBlob(blob, `${plugin.id}-${safeStamp}.png`);
    setSaveStatus({ kind:'success', message:'Downloaded (no storage).' });
    setTimeout(() => setSaveStatus({ kind:'idle', message:'Ready.' }), 3000);
  }, [api?.storage, effectId, ensureSurfaces, flushEffect, plugin.id]);

  const openLibrary = useCallback(async () => {
    if (api?.storage) { const e = await loadLibrary(api.storage); setLibraryEntries(e); }
    setShowLibrary(true);
  }, [api?.storage]);

  const exportEntry = useCallback((entry: SketchEntry) => {
    fetch(entry.dataUrl).then(r=>r.blob()).then(b=>downloadBlob(b,`sketch-${entry.id}.png`));
  }, []);

  const copyEntry = useCallback(async (entry: SketchEntry) => {
    try {
      const res = await fetch(entry.dataUrl); const blob = await res.blob();
      await (navigator.clipboard as any).write([new (window as any).ClipboardItem({ 'image/png': blob })]);
    } catch { /* silent */ }
  }, []);

  const deleteEntry = useCallback(async (id: string) => {
    const updated = libraryEntries.filter(e => e.id !== id);
    setLibraryEntries(updated);
    if (api?.storage) await saveLibrary(api.storage, updated);
  }, [api?.storage, libraryEntries]);

  const clearArtwork = useCallback(() => {
    ensureSurfaces(); const art = artworkSizeRef.current;
    paintCtxRef.current?.clearRect(0,0,art.width,art.height);
    effectCtxRef.current?.clearRect(0,0,art.width,art.height);
    dirtyRef.current = null;
    setSaveStatus({ kind:'idle', message:'Cleared.' });
    scheduleRender();
  }, [ensureSurfaces, scheduleRender]);

  /* ── effects ── */
  useEffect(() => { effectPresetRef.current = effectId; }, [effectId]);
  useEffect(() => {
    ensureSurfaces(); queueEffect({ full:true, immediate:true, eid:effectPresetRef.current });
    return () => {
      if (renderFrameRef.current !== null) window.cancelAnimationFrame(renderFrameRef.current);
      if (effectFrameRef.current !== null) window.cancelAnimationFrame(effectFrameRef.current);
    };
  }, [ensureSurfaces, queueEffect]);
  useEffect(() => {
    const stage = stageRef.current; if (!stage) return;
    const sync = () => { const ns = normalizeSize({ width:Math.floor(stage.clientWidth), height:Math.floor(stage.clientHeight) }); setViewportSize(cur => cur.width===ns.width&&cur.height===ns.height ? cur : ns); };
    sync(); const obs = new ResizeObserver(sync); obs.observe(stage); return () => obs.disconnect();
  }, []);
  useEffect(() => { syncArtworkSize(viewportSize); queueEffect({ full:true, eid:effectPresetRef.current }); scheduleRender(); }, [queueEffect, scheduleRender, syncArtworkSize, viewportSize]);
  useEffect(() => { const p = getFallback(brushId); setBrushSize(p.size); setBrushOpacity(p.opacity); if (p.id!=='eraser') setStrokeColor(c=>c||p.color); }, [brushId]);
  useEffect(() => { queueEffect({ full:true, eid:effectId }); }, [effectId, queueEffect]);
  useEffect(() => { scheduleRender(); }, [scheduleRender]);

  /* ── styles ── */
  const toolbarStyle: React.CSSProperties = {
    display:'flex', alignItems:'center', justifyContent:'space-between', gap:6, flexWrap:'nowrap',
    padding:'6px 8px', borderRadius:14, border:'1px solid rgba(148,163,184,0.16)',
    background:'rgba(9,13,24,0.88)', backdropFilter:'blur(20px)',
    boxShadow:'0 12px 36px rgba(0,0,0,0.32)', pointerEvents:'auto',
  };
  const sliderStyle: React.CSSProperties = { width: isCompact ? 60 : 90, accentColor:'#a78bfa' };
  const selectStyle: React.CSSProperties = { borderRadius:8, border:'1px solid rgba(148,163,184,0.15)', background:'rgba(255,255,255,0.05)', color:'var(--overlay-text-primary)', padding:'3px 6px', fontSize:11, maxWidth: isCompact ? 70 : 94 };
  const sepStyle: React.CSSProperties = { width:1, height:20, background:'rgba(148,163,184,0.12)', flexShrink:0 };

  return (
    <div style={{ position:'relative', display:'flex', flexDirection:'column', flex:1, minWidth:0, minHeight:0, overflow:'hidden', color:'var(--overlay-text-primary)', fontFamily:'var(--overlay-font-ui)', background:'linear-gradient(180deg,rgba(7,10,19,0.92),rgba(5,7,14,1))', isolation:'isolate' }}>

      {/* ── toolbar ── */}
      <div style={{ position:'absolute', inset:'9px 9px auto 9px', zIndex:3, pointerEvents:'none' }}>
        <div style={toolbarStyle}>

          {/* brush picker */}
          <div style={{ display:'flex', alignItems:'center', gap:3, flexWrap:'nowrap', overflowX:'auto', flexShrink:0 }}>
            {BRUSH_PRESETS.map(b => (
              <button key={b.id} type="button" title={b.label} onClick={() => { setBrushId(b.id); setTool('draw'); }}
                style={{ width:26, height:26, borderRadius:7, border: brushId===b.id && tool==='draw' ? '1px solid rgba(167,139,250,0.8)' : '1px solid rgba(148,163,184,0.12)', background: brushId===b.id && tool==='draw' ? 'rgba(167,139,250,0.20)' : 'rgba(255,255,255,0.04)', cursor:'pointer', fontSize:12, display:'flex', alignItems:'center', justifyContent:'center', transition:'all 0.12s' }}>
                {b.icon}
              </button>
            ))}
          </div>

          <div style={sepStyle} />

          {/* text tool */}
          <IconBtn title="Text tool" active={tool==='text'} onClick={() => setTool(t => t==='text'?'draw':'text')}>T</IconBtn>
          {tool==='text' && !isCompact && (
            <>
              <select value={textFont} onChange={e=>setTextFont(e.target.value)} style={{...selectStyle, maxWidth:90}}>
                {TEXT_FONTS.map(f=><option key={f} value={f}>{f.split(',')[0]}</option>)}
              </select>
              <input type="number" min="10" max="120" value={textSize} onChange={e=>setTextSize(Number(e.target.value))} style={{...selectStyle, width:42}} />
            </>
          )}

          <div style={sepStyle} />

          {/* effect */}
          {!isCompact && <span style={{ fontSize:10, color:muted, whiteSpace:'nowrap' }}>FX</span>}
          <select aria-label="Effect" value={effectId} onChange={e=>setEffectId(e.target.value)} style={selectStyle}>
            {EFFECT_PRESETS.map(fx=><option key={fx.id} value={fx.id}>{fx.label}</option>)}
          </select>

          <div style={sepStyle} />

          {/* size + opacity */}
          {!isCompact && <span style={{ fontSize:10, color:muted }}>Sz</span>}
          <input aria-label="Size" type="range" min="1" max="96" step="1" value={brushSize} onChange={e=>setBrushSize(Number(e.target.value))} style={sliderStyle} />
          <span style={{ fontSize:10, color:'var(--overlay-text-primary)', minWidth:20 }}>{brushSize}</span>

          {!isCompact && <><span style={{ fontSize:10, color:muted }}>Op</span>
          <input aria-label="Opacity" type="range" min="0.05" max="1" step="0.01" value={brushOpacity} onChange={e=>setBrushOpacity(Number(e.target.value))} style={sliderStyle} />
          <span style={{ fontSize:10, color:'var(--overlay-text-primary)', minWidth:28 }}>{Math.round(brushOpacity*100)}%</span></>}

          <div style={sepStyle} />

          {/* color */}
          <input aria-label="Color" type="color" value={strokeColor} disabled={activeBrush.id==='eraser'} onChange={e=>setStrokeColor(e.target.value)} style={{ width:26, height:26, padding:0, border:'1px solid rgba(148,163,184,0.18)', borderRadius:8, background:'transparent', cursor:'pointer' }} />
          <div style={{ display:'flex', alignItems:'center', gap:3 }}>
            {SWATCHES.map(c=>(
              <button key={c} type="button" aria-label={`Swatch ${c}`} onClick={()=>setStrokeColor(c)} disabled={activeBrush.id==='eraser'}
                style={{ width:14, height:14, borderRadius:999, border: c===strokeColor ? '2px solid rgba(255,255,255,0.9)' : '1px solid rgba(255,255,255,0.22)', background:c, cursor:'pointer', opacity:activeBrush.id==='eraser'?0.3:1, flexShrink:0 }} />
            ))}
          </div>

          <div style={sepStyle} />

          {/* actions */}
          <IconBtn title="Copy to clipboard" onClick={copyToClipboard}>📋</IconBtn>
          <IconBtn title="Save to sketch library" onClick={saveSketch}>💾</IconBtn>
          <IconBtn title="Sketch library" onClick={openLibrary}>📚</IconBtn>
          <IconBtn title="Clear canvas" danger onClick={clearArtwork}>🗑️</IconBtn>
        </div>
      </div>

      {/* ── canvas ── */}
      <div ref={stageRef} style={{ position:'relative', flex:1, minWidth:0, minHeight:0, overflow:'hidden' }}>
        <canvas
          ref={canvasRef}
          onPointerDown={startDrawing}
          onPointerMove={continueDrawing}
          onPointerUp={endDrawing}
          onPointerCancel={endDrawing}
          onClick={handleCanvasClick}
          style={{ display:'block', width:'100%', height:'100%', touchAction:'none', cursor: tool==='text' ? 'text' : activeBrush.id==='eraser' ? 'cell' : 'crosshair' }}
        />

        {/* floating text input */}
        {textEntry && tool === 'text' && (
          <div style={{ position:'absolute', left: `${(textEntry.x/artworkSizeRef.current.width)*100}%`, top: `${(textEntry.y/artworkSizeRef.current.height)*100}%`, zIndex:10, transform:'translate(-0%,-50%)' }}>
            <input
              ref={textInputRef}
              value={pendingText}
              onChange={e=>setPendingText(e.target.value)}
              onKeyDown={e=>{ if(e.key==='Enter') commitText(); if(e.key==='Escape'){setTextEntry(null);setPendingText('');} }}
              onBlur={commitText}
              placeholder="Type here…"
              style={{ background:'rgba(9,13,28,0.85)', border:'1px solid rgba(167,139,250,0.5)', borderRadius:7, color:textEntry.color, fontFamily:textEntry.font, fontSize:`${textEntry.size}px`, padding:'2px 6px', outline:'none', backdropFilter:'blur(8px)', minWidth:120 }}
            />
          </div>
        )}
      </div>

      {/* ── status bar ── */}
      <div style={{ position:'absolute', left:10, right:10, bottom:10, zIndex:3, display:'flex', alignItems:'flex-end', justifyContent:'space-between', gap:8, pointerEvents:'none' }}>
        <div style={{ display:'inline-flex', alignItems:'center', gap:6, maxWidth:'min(70vw,520px)', padding:'5px 8px', borderRadius:10, border:'1px solid rgba(148,163,184,0.13)', background:'rgba(7,10,19,0.72)', color:saveStatus.kind==='error'?'#fca5a5':muted, fontSize:10, backdropFilter:'blur(12px)' }}>
          {saveStatus.kind==='saving' && <span style={{ display:'inline-block', width:8, height:8, borderRadius:999, background:'#a78bfa', animation:'pulse 1s infinite' }} />}
          <span>{saveStatus.message}</span>
        </div>
        <div style={{ display:'inline-flex', alignItems:'center', gap:8, padding:'5px 8px', borderRadius:10, border:'1px solid rgba(148,163,184,0.13)', background:'rgba(7,10,19,0.72)', color:muted, fontSize:10, backdropFilter:'blur(12px)' }}>
          <span>{artworkSizeRef.current.width}×{artworkSizeRef.current.height}</span>
          <span style={{ color:'rgba(148,163,184,0.4)' }}>|</span>
          <span>{activeBrush.label}</span>
        </div>
      </div>

      {/* ── library modal ── */}
      {showLibrary && (
        <LibraryModal
          entries={libraryEntries}
          onClose={() => setShowLibrary(false)}
          onExport={exportEntry}
          onCopy={copyEntry}
          onDelete={deleteEntry}
        />
      )}
    </div>
  );
}

export default definePlugin({
  id: 'drawable-canvas',
  name: 'Drawable Canvas',
  description: 'Full-tab sketch pad — rich brushes, text tool, clipboard copy, and sketch library.',
  component: CanvasPad,
});
