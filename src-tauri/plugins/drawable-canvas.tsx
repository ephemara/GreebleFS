import React, { useCallback, useEffect, useRef, useState } from 'react';
import { definePlugin } from 'overlayterm-plugin';

/* ─── types ──────────────────────────────────────────────────────────────── */
type Pt = { x: number; y: number; p: number }; // x, y, pressure
type Size = { width: number; height: number };
type OverlayPluginStorageApi = {
  rootDir: string;
  ensureDir: (r?: string) => Promise<string>;
  readTextFile: (r: string) => Promise<string>;
  writeTextFile: (r: string, d: string) => Promise<void>;
  writeFile: (r: string, d: Uint8Array) => Promise<void>;
};
type OverlayPluginApi  = { storage?: OverlayPluginStorageApi };
type OverlayAppearance = { theme: { palette?: { accent?: string; textMuted?: string } } };
type HostContext       = { width: number; height: number; compact: boolean; density: string };
type PluginProps       = { plugin: { id: string; name: string }; api?: OverlayPluginApi; appearance: OverlayAppearance; host?: HostContext };

type TextObj = { id: string; x: number; y: number; text: string; color: string; size: number; font: string };
type SketchEntry = { id: string; savedAt: string; dataUrl: string };

/* ─── brush definitions ───────────────────────────────────────────────────── */
type Brush = {
  id: string; label: string; icon: string; defaultColor: string;
  size: number; opacity: number; spacing: number; taper: boolean;
  mode: 'stroke' | 'spray' | 'marker' | 'neon' | 'eraser';
  blendMode: GlobalCompositeOperation; cap: CanvasLineCap; join: CanvasLineJoin;
};

const BRUSHES: Brush[] = [
  { id:'pen',       label:'Pen',       icon:'✒️', defaultColor:'#c4b5fd', size:3,  opacity:1.00, spacing:1,    taper:true,  mode:'stroke',  blendMode:'source-over',     cap:'round', join:'round' },
  { id:'pencil',    label:'Pencil',    icon:'✏️', defaultColor:'#cbd5e1', size:4,  opacity:0.75, spacing:1,    taper:true,  mode:'spray',   blendMode:'source-over',     cap:'round', join:'round' },
  { id:'brush',     label:'Brush',     icon:'🖌️', defaultColor:'#f97316', size:16, opacity:0.60, spacing:1,    taper:true,  mode:'stroke',  blendMode:'source-over',     cap:'round', join:'round' },
  { id:'marker',    label:'Marker',    icon:'🖍️', defaultColor:'#34d399', size:18, opacity:0.35, spacing:1,    taper:false, mode:'marker',  blendMode:'source-over',     cap:'square',join:'miter'  },
  { id:'airbrush',  label:'Airbrush',  icon:'💨', defaultColor:'#7dd3fc', size:40, opacity:0.08, spacing:2,    taper:false, mode:'spray',   blendMode:'source-over',     cap:'round', join:'round' },
  { id:'charcoal',  label:'Charcoal',  icon:'🪨', defaultColor:'#64748b', size:20, opacity:0.30, spacing:1,    taper:false, mode:'spray',   blendMode:'source-over',     cap:'round', join:'round' },
  { id:'neon',      label:'Neon',      icon:'⚡', defaultColor:'#a78bfa', size:8,  opacity:0.85, spacing:1,    taper:true,  mode:'neon',    blendMode:'lighter',         cap:'round', join:'round' },
  { id:'eraser',    label:'Eraser',    icon:'⬜', defaultColor:'#ffffff', size:24, opacity:1.00, spacing:1,    taper:false, mode:'eraser',  blendMode:'destination-out', cap:'round', join:'round' },
];

const SWATCHES = ['#f8fafc','#7dd3fc','#34d399','#f97316','#f472b6','#facc15','#60a5fa','#a78bfa','#fb7185','#4ade80'];
const TEXT_FONTS = ['Inter, sans-serif','Georgia, serif','Courier New, monospace','system-ui, sans-serif'];
const MIN_SIZE: Size = { width: 280, height: 180 };
const INIT_SIZE: Size = { width: 960, height: 540 };
const MAX_UNDO = 40;

/* ─── helpers ─────────────────────────────────────────────────────────────── */
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const lerp  = (a: number, b: number, t: number)   => a + (b - a) * t;
const mid   = (a: Pt, b: Pt): Pt => ({ x: (a.x + b.x) * 0.5, y: (a.y + b.y) * 0.5, p: (a.p + b.p) * 0.5 });
const norm  = (s: Size): Size => ({ width: Math.max(Math.floor(s.width), MIN_SIZE.width), height: Math.max(Math.floor(s.height), MIN_SIZE.height) });
const uid   = () => Math.random().toString(36).slice(2);

function makeCanvas(s: Size): HTMLCanvasElement { const c = document.createElement('canvas'); c.width = s.width; c.height = s.height; return c; }
function copyCanvas(src: HTMLCanvasElement | null, dst: Size): HTMLCanvasElement {
  const c = makeCanvas(dst);
  if (src && src.width > 0 && src.height > 0) c.getContext('2d')?.drawImage(src, 0, 0, src.width, src.height, 0, 0, dst.width, dst.height);
  return c;
}
function downloadBlob(b: Blob, name: string) { const u = URL.createObjectURL(b); const a = document.createElement('a'); a.href=u; a.download=name; a.click(); setTimeout(()=>URL.revokeObjectURL(u),1000); }
function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
  return `rgba(${r},${g},${b},${alpha})`;
}

async function loadLibrary(s: OverlayPluginStorageApi): Promise<SketchEntry[]> {
  try { return JSON.parse(await s.readTextFile('sketches/index.json')); } catch { return []; }
}
async function saveLibrary(s: OverlayPluginStorageApi, entries: SketchEntry[]) {
  await s.ensureDir('sketches'); await s.writeTextFile('sketches/index.json', JSON.stringify(entries, null, 2));
}

/* ─── stroke renderer ─────────────────────────────────────────────────────── */
/**
 * Renders a stroke using smooth quadratic bezier midpoint technique.
 * This eliminates circular stamps entirely — strokes are continuous paths.
 * For textured brushes (spray/charcoal/airbrush) we scatter micro-strokes
 * perpendicular to the direction of travel.
 */
function renderStroke(
  ctx: CanvasRenderingContext2D,
  points: Pt[],
  brush: Brush,
  color: string,
  sizeOverride: number,
  opacityOverride: number,
) {
  if (points.length === 0) return;
  ctx.save();
  ctx.globalCompositeOperation = brush.blendMode;
  ctx.lineCap  = brush.cap;
  ctx.lineJoin = brush.join;

  const baseSize = sizeOverride;
  const mode     = brush.mode;

  if (mode === 'neon') {
    // neon: draw the core + glow in one pass with shadow
    ctx.shadowColor = color;
    ctx.shadowBlur  = baseSize * 3;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth   = Math.max(baseSize * 0.3, 1);
    ctx.globalAlpha = opacityOverride;
    drawSmoothPath(ctx, points);
    ctx.stroke();
    // outer glow pass
    ctx.shadowBlur  = baseSize * 6;
    ctx.strokeStyle = color;
    ctx.lineWidth   = baseSize;
    ctx.globalAlpha = opacityOverride * 0.35;
    drawSmoothPath(ctx, points);
    ctx.stroke();

  } else if (mode === 'spray' || mode === 'marker') {
    // textured: draw a smooth central path then scatter grains
    ctx.strokeStyle = color;
    ctx.globalAlpha = opacityOverride;

    if (mode === 'marker') {
      // flat rectangular marker
      ctx.lineWidth = baseSize;
      drawSmoothPath(ctx, points);
      ctx.stroke();
    } else {
      // spray/charcoal/airbrush: thin central line + scattered dots
      const grainCount = Math.max(1, Math.round(baseSize * 0.6));
      for (let i = 1; i < points.length; i++) {
        const a = points[i - 1]; const b = points[i];
        const dx = b.x - a.x; const dy = b.y - a.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const nx = -dy / dist; const ny = dx / dist; // perpendicular
        for (let g = 0; g < grainCount; g++) {
          const t   = Math.random();
          const px  = lerp(a.x, b.x, t);
          const py  = lerp(a.y, b.y, t);
          const off = (Math.random() - 0.5) * baseSize;
          const gr  = Math.max(Math.random() * baseSize * 0.18, 0.4);
          ctx.globalAlpha = opacityOverride * (0.3 + Math.random() * 0.7);
          ctx.fillStyle   = color;
          ctx.beginPath();
          ctx.arc(px + nx * off, py + ny * off, gr, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

  } else if (mode === 'eraser') {
    ctx.strokeStyle = 'rgba(0,0,0,1)';
    ctx.lineWidth   = baseSize;
    ctx.globalAlpha = opacityOverride;
    drawSmoothPath(ctx, points);
    ctx.stroke();

  } else {
    // stroke mode (pen / brush): pressure-sensitive width per segment
    if (points.length === 1) {
      const p = points[0];
      const r = (baseSize * clamp(p.p, 0.3, 1.5)) / 2;
      ctx.beginPath();
      ctx.arc(p.x, p.y, Math.max(r, 0.5), 0, Math.PI * 2);
      ctx.fillStyle   = color;
      ctx.globalAlpha = opacityOverride;
      ctx.fill();
    } else {
      // draw each sub-segment with its own lineWidth (pressure-sensitive)
      for (let i = 1; i < points.length; i++) {
        const prev = points[i - 1]; const curr = points[i];
        const m0   = i > 1 ? mid(points[i - 2], prev) : prev;
        const m1   = mid(prev, curr);
        const w    = Math.max(baseSize * clamp(lerp(prev.p, curr.p, 0.5), 0.25, 1.5), 0.5);
        ctx.beginPath();
        ctx.moveTo(m0.x, m0.y);
        ctx.quadraticCurveTo(prev.x, prev.y, m1.x, m1.y);
        ctx.strokeStyle = color;
        ctx.lineWidth   = w;
        ctx.globalAlpha = opacityOverride;
        ctx.stroke();
      }
      // close with last straight segment
      if (points.length >= 2) {
        const last = points[points.length - 1];
        const prev = points[points.length - 2];
        const m0   = mid(prev, last);
        ctx.beginPath();
        ctx.moveTo(m0.x, m0.y);
        ctx.lineTo(last.x, last.y);
        ctx.strokeStyle = color;
        ctx.lineWidth   = Math.max(baseSize * clamp(last.p, 0.25, 1.5), 0.5);
        ctx.globalAlpha = opacityOverride;
        ctx.stroke();
      }
    }
  }
  ctx.restore();
}

/** Smooth path using midpoint bezier technique — eliminates all polygon artifacts */
function drawSmoothPath(ctx: CanvasRenderingContext2D, points: Pt[]) {
  if (points.length === 0) return;
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  if (points.length === 1) { ctx.lineTo(points[0].x, points[0].y); return; }
  for (let i = 1; i < points.length - 1; i++) {
    const m = mid(points[i], points[i + 1]);
    ctx.quadraticCurveTo(points[i].x, points[i].y, m.x, m.y);
  }
  const last = points[points.length - 1];
  ctx.lineTo(last.x, last.y);
}

/* ─── subcomponents ──────────────────────────────────────────────────────── */
function Btn({ title, active, danger, onClick, children }: { title: string; active?: boolean; danger?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button title={title} type="button" onClick={onClick} style={{
      display:'flex', alignItems:'center', justifyContent:'center',
      width:27, height:27, borderRadius:7, cursor:'pointer', fontSize:13, flexShrink:0,
      border: active ? '1px solid rgba(167,139,250,0.75)' : '1px solid rgba(148,163,184,0.13)',
      background: active ? 'rgba(167,139,250,0.18)' : danger ? 'rgba(239,68,68,0.10)' : 'rgba(255,255,255,0.04)',
      color: danger ? '#fca5a5' : 'var(--overlay-text-primary)', transition:'all 0.12s',
    }}>{children}</button>
  );
}

function LibraryModal({ entries, onClose, onExport, onCopy, onDelete }: {
  entries: SketchEntry[]; onClose: () => void;
  onExport:(e:SketchEntry)=>void; onCopy:(e:SketchEntry)=>void; onDelete:(id:string)=>void;
}) {
  return (
    <div onClick={onClose} style={{ position:'fixed', inset:0, zIndex:9999, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(0,0,0,0.75)', backdropFilter:'blur(8px)' }}>
      <div onClick={e=>e.stopPropagation()} style={{ position:'relative', width:'min(92vw,860px)', maxHeight:'82vh', display:'flex', flexDirection:'column', borderRadius:20, border:'1px solid rgba(148,163,184,0.18)', background:'rgba(9,13,28,0.97)', boxShadow:'0 32px 80px rgba(0,0,0,0.6)', overflow:'hidden' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'14px 18px', borderBottom:'1px solid rgba(148,163,184,0.10)' }}>
          <span style={{ fontWeight:700, fontSize:14, color:'#f8fafc' }}>📚 Sketch Library</span>
          <button type="button" onClick={onClose} style={{ background:'none', border:'none', color:'rgba(226,232,240,0.5)', fontSize:18, cursor:'pointer' }}>✕</button>
        </div>
        <div style={{ flex:1, overflowY:'auto', padding:16, display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(180px,1fr))', gap:12 }}>
          {entries.length === 0 && <div style={{ gridColumn:'1/-1', textAlign:'center', color:'rgba(226,232,240,0.3)', padding:'48px 0', fontSize:13 }}>No saved sketches yet.</div>}
          {entries.map(e => (
            <div key={e.id} style={{ borderRadius:12, border:'1px solid rgba(148,163,184,0.13)', background:'rgba(255,255,255,0.03)', overflow:'hidden', display:'flex', flexDirection:'column' }}>
              <img src={e.dataUrl} alt="" style={{ width:'100%', aspectRatio:'16/9', objectFit:'cover', display:'block' }} />
              <div style={{ padding:'6px 8px', display:'flex', flexDirection:'column', gap:4 }}>
                <span style={{ fontSize:10, color:'rgba(226,232,240,0.35)' }}>{new Date(e.savedAt).toLocaleString()}</span>
                <div style={{ display:'flex', gap:4 }}>
                  {[['Copy','#f8fafc',()=>onCopy(e)],['Export','#f8fafc',()=>onExport(e)],['Del','#fca5a5',()=>onDelete(e.id)]].map(([label,col,fn])=>(
                    <button key={label as string} type="button" onClick={fn as ()=>void} style={{ flex:1, fontSize:10, padding:'4px 0', borderRadius:6, border:`1px solid rgba(148,163,184,0.15)`, background:'rgba(255,255,255,0.04)', color:col as string, cursor:'pointer' }}>{label as string}</button>
                  ))}
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
  /* canvas refs */
  const stageRef   = useRef<HTMLDivElement | null>(null);
  const canvasRef  = useRef<HTMLCanvasElement | null>(null);   // display
  const paintRef   = useRef<HTMLCanvasElement | null>(null);   // permanent paint buffer
  const draftRef   = useRef<HTMLCanvasElement | null>(null);   // in-progress stroke
  const artSize    = useRef<Size>(INIT_SIZE);
  const undoStack  = useRef<ImageData[]>([]);

  /* stroke state — all refs to avoid React re-render during draw */
  const drawing    = useRef(false);
  const strokePts  = useRef<Pt[]>([]);
  const rafId      = useRef<number | null>(null);

  /* ui state */
  const [vpSize, setVpSize]           = useState<Size>(INIT_SIZE);
  const [brushId, setBrushId]         = useState('pen');
  const [color, setColor]             = useState(appearance.theme.palette?.accent ?? '#c4b5fd');
  const [bSize, setBSize]             = useState(3);
  const [bOpacity, setBOpacity]       = useState(1.0);
  const [tool, setTool]               = useState<'draw'|'text'>('draw');
  const [textObjs, setTextObjs]       = useState<TextObj[]>([]);
  const [editingText, setEditingText] = useState<TextObj | null>(null);
  const [pendingTxt, setPendingTxt]   = useState('');
  const [txtFont, setTxtFont]         = useState(TEXT_FONTS[0]);
  const [txtSize, setTxtSize]         = useState(22);
  const [draggingText, setDraggingText] = useState<string | null>(null);
  const dragOffset = useRef({ dx: 0, dy: 0 });
  const [status, setStatus]           = useState('Ready.');
  const [statusErr, setStatusErr]     = useState(false);
  const [library, setLibrary]         = useState<SketchEntry[]>([]);
  const [showLib, setShowLib]         = useState(false);
  const textInputRef = useRef<HTMLInputElement | null>(null);

  const muted     = appearance.theme.palette?.textMuted ?? 'rgba(226,232,240,0.65)';
  const isCompact = host?.compact ?? vpSize.width < 960;
  const brush     = BRUSHES.find(b => b.id === brushId) ?? BRUSHES[0];

  /* ── surface management ─────────────────────────────────────────────────── */
  const ensureSurfaces = useCallback((s: Size) => {
    const ns = norm(s);
    const cur = artSize.current;
    if (paintRef.current && draftRef.current && cur.width === ns.width && cur.height === ns.height) return;
    paintRef.current = copyCanvas(paintRef.current, ns);
    draftRef.current = copyCanvas(null, ns);
    artSize.current  = ns;
  }, []);

  /* ── composite + blit to display canvas ─────────────────────────────────── */
  const blit = useCallback(() => {
    const display = canvasRef.current;
    const paint   = paintRef.current;
    const draft   = draftRef.current;
    if (!display || !paint || !draft) return;

    const vw = Math.max(Math.floor(vpSize.width), MIN_SIZE.width);
    const vh = Math.max(Math.floor(vpSize.height), MIN_SIZE.height);
    const dpr = window.devicePixelRatio || 1;
    const tw = Math.floor(vw * dpr); const th = Math.floor(vh * dpr);
    if (display.width !== tw || display.height !== th) {
      display.width = tw; display.height = th;
      display.style.width = `${vw}px`; display.style.height = `${vh}px`;
    }

    const ctx = display.getContext('2d'); if (!ctx) return;
    const art = artSize.current;
    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, vw, vh);

    // bg
    const bg = ctx.createLinearGradient(0, 0, vw, vh);
    bg.addColorStop(0, 'rgba(18,31,48,0.97)'); bg.addColorStop(0.52, 'rgba(13,17,31,0.99)'); bg.addColorStop(1, 'rgba(7,10,19,1)');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, vw, vh);

    // subtle glow
    const glow = ctx.createRadialGradient(vw*0.12,vh*0.08,0,vw*0.12,vh*0.08,vw*0.7);
    glow.addColorStop(0,'rgba(96,165,250,0.14)'); glow.addColorStop(1,'rgba(0,0,0,0)');
    ctx.fillStyle = glow; ctx.fillRect(0, 0, vw, vh);

    // grid
    ctx.strokeStyle = 'rgba(148,163,184,0.07)'; ctx.lineWidth = 1;
    for (let x=0; x<=vw; x+=36) { ctx.beginPath(); ctx.moveTo(x+0.5,0); ctx.lineTo(x+0.5,vh); ctx.stroke(); }
    for (let y=0; y<=vh; y+=36) { ctx.beginPath(); ctx.moveTo(0,y+0.5); ctx.lineTo(vw,y+0.5); ctx.stroke(); }

    // paint + draft composited
    ctx.drawImage(paint, 0, 0, art.width, art.height, 0, 0, vw, vh);
    ctx.drawImage(draft, 0, 0, art.width, art.height, 0, 0, vw, vh);
    ctx.restore();
  }, [vpSize]);

  const scheduleBlit = useCallback(() => {
    if (rafId.current !== null) return;
    rafId.current = requestAnimationFrame(() => { rafId.current = null; blit(); });
  }, [blit]);

  /* ── undo ───────────────────────────────────────────────────────────────── */
  const pushUndo = useCallback(() => {
    const paint = paintRef.current; if (!paint) return;
    const ctx = paint.getContext('2d', { willReadFrequently: true }); if (!ctx) return;
    const snap = ctx.getImageData(0, 0, paint.width, paint.height);
    undoStack.current.push(snap);
    if (undoStack.current.length > MAX_UNDO) undoStack.current.shift();
    // also snapshot text objects — done via React state separately
  }, []);

  const undo = useCallback(() => {
    const snap = undoStack.current.pop(); if (!snap) return;
    const paint = paintRef.current; if (!paint) return;
    const ctx = paint.getContext('2d'); if (!ctx) return;
    ctx.clearRect(0, 0, paint.width, paint.height);
    ctx.putImageData(snap, 0, 0);
    scheduleBlit();
  }, [scheduleBlit]);

  /* ── global keyboard ─────────────────────────────────────────────────────── */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); undo(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [undo]);

  /* ── drawing ─────────────────────────────────────────────────────────────── */
  const canvasPt = useCallback((e: React.PointerEvent<HTMLCanvasElement>): Pt => {
    const rect = e.currentTarget.getBoundingClientRect(); const art = artSize.current;
    return {
      x: clamp(((e.clientX - rect.left) / Math.max(rect.width, 1)) * art.width, 0, art.width),
      y: clamp(((e.clientY - rect.top)  / Math.max(rect.height,1)) * art.height,0, art.height),
      p: clamp(e.pressure || 0.5, 0.1, 1),
    };
  }, []);

  const flushDraftToPaint = useCallback(() => {
    const paint = paintRef.current; const draft = draftRef.current; if (!paint || !draft) return;
    const ctx = paint.getContext('2d'); if (!ctx) return;
    ctx.drawImage(draft, 0, 0);
    const dctx = draft.getContext('2d'); if (!dctx) return;
    dctx.clearRect(0, 0, draft.width, draft.height);
  }, []);

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (tool !== 'draw') return;
    e.preventDefault(); e.currentTarget.setPointerCapture(e.pointerId);
    pushUndo();
    drawing.current  = true;
    strokePts.current = [canvasPt(e)];
    scheduleBlit();
  }, [tool, pushUndo, canvasPt, scheduleBlit]);

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    const pt = canvasPt(e);
    strokePts.current.push(pt);

    // draw only the newest incremental segment on the draft surface
    const draft = draftRef.current; if (!draft) return;
    const ctx = draft.getContext('2d'); if (!ctx) return;
    const pts = strokePts.current;
    const len = pts.length;

    // clear draft and re-render full current stroke
    // (cheaper than full ImageData; draft is cleared after flush anyway)
    ctx.clearRect(0, 0, draft.width, draft.height);
    renderStroke(ctx, pts, brush, color, bSize, bOpacity);

    scheduleBlit();
  }, [canvasPt, brush, color, bSize, bOpacity, scheduleBlit]);

  const onPointerUp = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    if (!drawing.current) return;
    drawing.current = false;

    // bake draft → paint permanently
    flushDraftToPaint();
    strokePts.current = [];
    scheduleBlit();
  }, [flushDraftToPaint, scheduleBlit]);

  /* ── text tool ───────────────────────────────────────────────────────────── */
  const onCanvasClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (tool !== 'text') return;
    const rect = e.currentTarget.getBoundingClientRect(); const art = artSize.current;
    const x = ((e.clientX - rect.left) / Math.max(rect.width, 1)) * art.width;
    const y = ((e.clientY - rect.top)  / Math.max(rect.height,1)) * art.height;
    const obj: TextObj = { id: uid(), x, y, text:'', color, size: txtSize, font: txtFont };
    setEditingText(obj); setPendingTxt('');
    requestAnimationFrame(() => textInputRef.current?.focus());
  }, [tool, color, txtSize, txtFont]);

  const commitText = useCallback((obj: TextObj, text: string) => {
    if (!text.trim()) { setEditingText(null); return; }
    const finalObj = { ...obj, text };
    setTextObjs(prev => [...prev, finalObj]);
    setEditingText(null); setPendingTxt('');
  }, []);

  /* ── text drag ───────────────────────────────────────────────────────────── */
  const onTextMouseDown = useCallback((e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const stage = stageRef.current; if (!stage) return;
    const art   = artSize.current;
    const rect  = stage.getBoundingClientRect();
    const obj   = textObjs.find(t => t.id === id);
    if (!obj) return;
    // obj positions are in artwork coords; convert to viewport
    const scaleX = rect.width  / art.width;
    const scaleY = rect.height / art.height;
    dragOffset.current = { dx: e.clientX - obj.x * scaleX - rect.left, dy: e.clientY - obj.y * scaleY - rect.top };
    setDraggingText(id);
  }, [textObjs]);

  useEffect(() => {
    if (!draggingText) return;
    const stage = stageRef.current;
    const onMove = (e: MouseEvent) => {
      if (!stage) return;
      const art  = artSize.current; const rect = stage.getBoundingClientRect();
      const scaleX = art.width  / rect.width;
      const scaleY = art.height / rect.height;
      const nx = (e.clientX - rect.left - dragOffset.current.dx) * scaleX;
      const ny = (e.clientY - rect.top  - dragOffset.current.dy) * scaleY;
      setTextObjs(prev => prev.map(t => t.id === draggingText ? { ...t, x: clamp(nx,0,art.width), y: clamp(ny,0,art.height) } : t));
    };
    const onUp = () => setDraggingText(null);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, [draggingText]);

  /* ── bake text to paint on save ─────────────────────────────────────────── */
  const bakeTextObjs = useCallback((targetCtx: CanvasRenderingContext2D) => {
    for (const t of textObjs) {
      targetCtx.save();
      targetCtx.font            = `${t.size}px ${t.font}`;
      targetCtx.fillStyle       = t.color;
      targetCtx.globalAlpha     = 1;
      targetCtx.globalCompositeOperation = 'source-over';
      targetCtx.fillText(t.text, t.x, t.y);
      targetCtx.restore();
    }
  }, [textObjs]);

  /* ── copy to clipboard ───────────────────────────────────────────────────── */
  const copyToClipboard = useCallback(async () => {
    const paint = paintRef.current; if (!paint) return;
    setStatus('Copying...'); setStatusErr(false);
    // composite with text
    const merged = copyCanvas(paint, artSize.current);
    const mctx   = merged.getContext('2d')!;
    bakeTextObjs(mctx);
    try {
      const blob = await new Promise<Blob|null>(res => merged.toBlob(res, 'image/png'));
      if (!blob) throw new Error('toBlob failed');
      await (navigator.clipboard as any).write([new (window as any).ClipboardItem({ 'image/png': blob })]);
      setStatus('Copied to clipboard!'); setStatusErr(false);
    } catch (err) { setStatus(`Copy failed: ${String(err)}`); setStatusErr(true); }
    setTimeout(() => { setStatus('Ready.'); setStatusErr(false); }, 3000);
  }, [bakeTextObjs]);

  /* ── save ────────────────────────────────────────────────────────────────── */
  const saveSketch = useCallback(async () => {
    const paint = paintRef.current; if (!paint) return;
    setStatus('Saving...'); setStatusErr(false);
    const merged = copyCanvas(paint, artSize.current);
    bakeTextObjs(merged.getContext('2d')!);
    const blob   = await new Promise<Blob|null>(res => merged.toBlob(res, 'image/png'));
    if (!blob) { setStatus('PNG export failed.'); setStatusErr(true); return; }
    const savedAt     = new Date().toISOString();
    const safeStamp   = savedAt.replace(/[:.]/g, '-');
    const dataUrl     = merged.toDataURL('image/png');
    const entry: SketchEntry = { id: safeStamp, savedAt, dataUrl };
    if (api?.storage) {
      try {
        await api.storage.ensureDir('sketches');
        await api.storage.writeFile(`sketches/${safeStamp}.png`, new Uint8Array(await blob.arrayBuffer()));
        const updated = [entry, ...(await loadLibrary(api.storage))];
        await saveLibrary(api.storage, updated);
        setLibrary(updated);
        setStatus('Saved to sketch library.');
        setTimeout(() => setStatus('Ready.'), 3000);
        return;
      } catch { /* fall through */ }
    }
    downloadBlob(blob, `${plugin.id}-${safeStamp}.png`);
    setStatus('Downloaded (no storage).'); setTimeout(() => setStatus('Ready.'), 3000);
  }, [api?.storage, bakeTextObjs, plugin.id]);

  /* ── clear ───────────────────────────────────────────────────────────────── */
  const clearCanvas = useCallback(() => {
    pushUndo();
    const paint = paintRef.current; if (!paint) return;
    paint.getContext('2d')?.clearRect(0, 0, paint.width, paint.height);
    setTextObjs([]); scheduleBlit();
  }, [pushUndo, scheduleBlit]);

  /* ── library ─────────────────────────────────────────────────────────────── */
  const openLibrary = useCallback(async () => {
    if (api?.storage) setLibrary(await loadLibrary(api.storage));
    setShowLib(true);
  }, [api?.storage]);

  const exportEntry = (e: SketchEntry) => fetch(e.dataUrl).then(r=>r.blob()).then(b=>downloadBlob(b,`sketch-${e.id}.png`));
  const copyEntry   = async (e: SketchEntry) => { try { const b=await (await fetch(e.dataUrl)).blob(); await (navigator.clipboard as any).write([new (window as any).ClipboardItem({'image/png':b})]); } catch {} };
  const deleteEntry = async (id: string) => { const u=library.filter(e=>e.id!==id); setLibrary(u); if(api?.storage) await saveLibrary(api.storage,u); };

  /* ── resize observer ─────────────────────────────────────────────────────── */
  useEffect(() => {
    const stage = stageRef.current; if (!stage) return;
    const sync = () => { const ns = norm({ width: stage.clientWidth, height: stage.clientHeight }); setVpSize(c => c.width===ns.width&&c.height===ns.height ? c : ns); };
    sync(); const obs = new ResizeObserver(sync); obs.observe(stage); return () => obs.disconnect();
  }, []);

  useEffect(() => { ensureSurfaces(vpSize); scheduleBlit(); }, [vpSize, ensureSurfaces, scheduleBlit]);
  useEffect(() => { scheduleBlit(); }, [scheduleBlit]);

  /* ── when brush changes, sync default size ───────────────────────────────── */
  useEffect(() => {
    const b = BRUSHES.find(br => br.id === brushId); if (!b) return;
    setBSize(b.size); setBOpacity(b.opacity);
    if (b.id !== 'eraser') setColor(c => c || b.defaultColor);
  }, [brushId]);

  /* ── viewport-to-artwork coordinate helper for text overlay ─────────────── */
  const textStyle = (t: TextObj): React.CSSProperties => {
    const art = artSize.current;
    const vw  = Math.max(vpSize.width, MIN_SIZE.width);
    const vh  = Math.max(vpSize.height, MIN_SIZE.height);
    return {
      position: 'absolute',
      left:  `${(t.x / art.width)  * vw}px`,
      top:   `${(t.y / art.height) * vh}px`,
      fontFamily: t.font, fontSize: `${t.size * (vw / art.width)}px`,
      color: t.color, cursor: 'move', userSelect: 'none',
      whiteSpace: 'nowrap', pointerEvents: 'auto',
      textShadow: '0 1px 4px rgba(0,0,0,0.6)',
      transform: 'translateY(-0.8em)',
    };
  };

  /* ── shared compact styles ───────────────────────────────────────────────── */
  const tb: React.CSSProperties = { display:'flex', alignItems:'center', justifyContent:'space-between', gap:5, flexWrap:'nowrap', padding:'5px 8px', borderRadius:13, border:'1px solid rgba(148,163,184,0.15)', background:'rgba(9,13,24,0.90)', backdropFilter:'blur(20px)', boxShadow:'0 10px 32px rgba(0,0,0,0.30)', pointerEvents:'auto' };
  const sep: React.CSSProperties = { width:1, height:18, background:'rgba(148,163,184,0.11)', flexShrink:0, margin:'0 1px' };
  const sel: React.CSSProperties = { borderRadius:7, border:'1px solid rgba(148,163,184,0.14)', background:'rgba(255,255,255,0.05)', color:'var(--overlay-text-primary)', padding:'3px 5px', fontSize:11 };
  const rng = (w=80): React.CSSProperties => ({ width:w, accentColor:'#a78bfa' });

  return (
    <div style={{ position:'relative', display:'flex', flexDirection:'column', flex:1, minWidth:0, minHeight:0, overflow:'hidden', color:'var(--overlay-text-primary)', fontFamily:'var(--overlay-font-ui)', isolation:'isolate' }}>

      {/* ── toolbar ── */}
      <div style={{ position:'absolute', inset:'8px 8px auto 8px', zIndex:10, pointerEvents:'none' }}>
        <div style={tb}>

          {/* brushes */}
          <div style={{ display:'flex', alignItems:'center', gap:2, flexShrink:0, overflowX:'auto' }}>
            {BRUSHES.map(b => (
              <button key={b.id} type="button" title={b.label} onClick={()=>{setBrushId(b.id);setTool('draw');}}
                style={{ width:26,height:26,borderRadius:7,cursor:'pointer',fontSize:12,flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center',transition:'all .12s',
                  border: brushId===b.id&&tool==='draw' ? '1px solid rgba(167,139,250,.8)' : '1px solid rgba(148,163,184,.12)',
                  background: brushId===b.id&&tool==='draw' ? 'rgba(167,139,250,.20)' : 'rgba(255,255,255,.04)' }}>
                {b.icon}
              </button>
            ))}
          </div>

          <div style={sep}/>

          {/* text */}
          <Btn title="Text tool (click canvas to place)" active={tool==='text'} onClick={()=>setTool(t=>t==='text'?'draw':'text')}>T</Btn>
          {tool==='text'&&!isCompact&&<>
            <select value={txtFont} onChange={e=>setTxtFont(e.target.value)} style={{...sel,maxWidth:82}}>{TEXT_FONTS.map(f=><option key={f} value={f}>{f.split(',')[0]}</option>)}</select>
            <input type="number" min={8} max={128} value={txtSize} onChange={e=>setTxtSize(Number(e.target.value))} style={{...sel,width:40}}/>
          </>}

          <div style={sep}/>

          {/* size + opacity */}
          <span style={{fontSize:10,color:muted}}>Sz</span>
          <input type="range" min={1} max={96} step={1} value={bSize} onChange={e=>setBSize(Number(e.target.value))} style={rng(isCompact?60:88)}/>
          <span style={{fontSize:10,color:'var(--overlay-text-primary)',minWidth:18}}>{bSize}</span>
          {!isCompact&&<>
            <span style={{fontSize:10,color:muted}}>Op</span>
            <input type="range" min={0.04} max={1} step={0.01} value={bOpacity} onChange={e=>setBOpacity(Number(e.target.value))} style={rng(80)}/>
            <span style={{fontSize:10,color:'var(--overlay-text-primary)',minWidth:28}}>{Math.round(bOpacity*100)}%</span>
          </>}

          <div style={sep}/>

          {/* color */}
          <input type="color" value={color} disabled={brush.id==='eraser'} onChange={e=>setColor(e.target.value)} style={{width:26,height:26,padding:0,border:'1px solid rgba(148,163,184,.18)',borderRadius:7,background:'transparent',cursor:'pointer'}}/>
          <div style={{display:'flex',alignItems:'center',gap:2}}>
            {SWATCHES.map(c=>(
              <button key={c} type="button" onClick={()=>setColor(c)} disabled={brush.id==='eraser'}
                style={{width:13,height:13,borderRadius:999,flexShrink:0,cursor:'pointer',opacity:brush.id==='eraser'?.25:1,
                  border:c===color?'2px solid rgba(255,255,255,.9)':'1px solid rgba(255,255,255,.22)',background:c}}/>
            ))}
          </div>

          <div style={sep}/>

          {/* actions */}
          <Btn title="Undo (Ctrl+Z)" onClick={undo}>↩</Btn>
          <Btn title="Copy to clipboard" onClick={copyToClipboard}>📋</Btn>
          <Btn title="Save to sketch library" onClick={saveSketch}>💾</Btn>
          <Btn title="Sketch library" onClick={openLibrary}>📚</Btn>
          <Btn title="Clear canvas" danger onClick={clearCanvas}>🗑️</Btn>
        </div>
      </div>

      {/* ── canvas + text overlay ── */}
      <div ref={stageRef} style={{ position:'relative', flex:1, minWidth:0, minHeight:0, overflow:'hidden' }}>
        <canvas
          ref={canvasRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onClick={onCanvasClick}
          style={{ display:'block', width:'100%', height:'100%', touchAction:'none', cursor: tool==='text'?'text': brush.id==='eraser'?'cell':'crosshair' }}
        />

        {/* draggable text objects */}
        {textObjs.map(t => (
          <span key={t.id} style={textStyle(t)} onMouseDown={e=>onTextMouseDown(e,t.id)} title="Drag to move · Double-click to delete"
            onDoubleClick={()=>{ pushUndo(); setTextObjs(p=>p.filter(x=>x.id!==t.id)); }}>
            {t.text}
          </span>
        ))}

        {/* inline text input while typing */}
        {editingText && tool==='text' && (
          <div style={{ position:'absolute', left:`${(editingText.x/artSize.current.width)*Math.max(vpSize.width,MIN_SIZE.width)}px`, top:`${(editingText.y/artSize.current.height)*Math.max(vpSize.height,MIN_SIZE.height)}px`, zIndex:20, transform:'translateY(-0.8em)' }}>
            <input ref={textInputRef} value={pendingTxt} onChange={e=>setPendingTxt(e.target.value)}
              onKeyDown={e=>{ if(e.key==='Enter'){commitText(editingText,pendingTxt);} if(e.key==='Escape'){setEditingText(null);setPendingTxt('');} }}
              onBlur={()=>commitText(editingText,pendingTxt)}
              placeholder="Type…"
              style={{ background:'rgba(9,13,28,0.88)', border:`1px solid ${color}88`, borderRadius:7, color, fontFamily:txtFont, fontSize:`${txtSize*(Math.max(vpSize.width,MIN_SIZE.width)/artSize.current.width)}px`, padding:'2px 6px', outline:'none', backdropFilter:'blur(8px)', minWidth:100 }}/>
          </div>
        )}
      </div>

      {/* ── status bar ── */}
      <div style={{ position:'absolute', left:9, right:9, bottom:9, zIndex:5, display:'flex', alignItems:'flex-end', justifyContent:'space-between', gap:8, pointerEvents:'none' }}>
        <div style={{ display:'inline-flex',alignItems:'center',gap:6,maxWidth:'min(70vw,520px)',padding:'4px 8px',borderRadius:9,border:'1px solid rgba(148,163,184,.11)',background:'rgba(7,10,19,.74)',color:statusErr?'#fca5a5':muted,fontSize:10,backdropFilter:'blur(12px)'}}>
          <span>{status}</span>
        </div>
        <div style={{ display:'inline-flex',alignItems:'center',gap:6,padding:'4px 8px',borderRadius:9,border:'1px solid rgba(148,163,184,.11)',background:'rgba(7,10,19,.74)',color:muted,fontSize:10,backdropFilter:'blur(12px)'}}>
          <span>{artSize.current.width}×{artSize.current.height}</span>
          <span style={{color:'rgba(148,163,184,.35)'}}>|</span>
          <span>{brush.label}</span>
          {tool==='text'&&<><span style={{color:'rgba(148,163,184,.35)'}}>|</span><span>Text</span></>}
        </div>
      </div>

      {/* ── library modal ── */}
      {showLib && <LibraryModal entries={library} onClose={()=>setShowLib(false)} onExport={exportEntry} onCopy={copyEntry} onDelete={deleteEntry}/>}
    </div>
  );
}

export default definePlugin({
  id: 'drawable-canvas',
  name: 'Drawable Canvas',
  description: 'Sketch pad with smooth bezier strokes, rich brushes, text objects, undo, clipboard copy & sketch library.',
  component: CanvasPad,
});
