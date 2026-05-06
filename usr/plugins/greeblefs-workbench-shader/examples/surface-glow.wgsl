// ---------------------------------------------------------------------------
// surface-glow.wgsl  –  GreebleFS Shader Workbench example shader
// A fragment-stage preview shader that renders a pulsating crystalline
// energy field with fractal domain warping, volumetric fake-scatter,
// chromatic spectral dispersion, and hot-core bloom.
// Uses the workbench PreviewUniforms at group(0) binding(0).
// ---------------------------------------------------------------------------

struct PreviewUniforms {
  timeSeconds: f32,
  aspect: f32,
  sceneMode: f32,
  padding0: f32,
  modelViewProjection: mat4x4<f32>,
};

@group(0) @binding(0)
var<uniform> previewUniforms: PreviewUniforms;

struct VertexInput {
  @builtin(position) position: vec4<f32>,
  @location(0) uv: vec2<f32>,
  @location(1) normal: vec3<f32>,
};

// ---- Hashing / noise primitives ----

fn hash21(p: vec2<f32>) -> f32 {
  var n = dot(p, vec2<f32>(127.1, 311.7));
  return fract(sin(n) * 43758.5453123);
}

fn hash31(p: vec3<f32>) -> f32 {
  var n = dot(p, vec3<f32>(127.1, 311.7, 74.7));
  return fract(sin(n) * 43758.5453123);
}

fn hash33(p: vec3<f32>) -> vec3<f32> {
  let k = vec3<f32>(
    dot(p, vec3<f32>(127.1, 311.7, 74.7)),
    dot(p, vec3<f32>(269.5, 183.3, 246.1)),
    dot(p, vec3<f32>(113.5, 271.9, 124.6)),
  );
  return fract(sin(k) * 43758.5453123);
}

// ---- Smooth value noise ----

fn valueNoise(p: vec3<f32>) -> f32 {
  let i = floor(p);
  let f = fract(p);
  let u = f * f * (3.0 - 2.0 * f);
  let n000 = hash31(i + vec3<f32>(0.0, 0.0, 0.0));
  let n100 = hash31(i + vec3<f32>(1.0, 0.0, 0.0));
  let n010 = hash31(i + vec3<f32>(0.0, 1.0, 0.0));
  let n110 = hash31(i + vec3<f32>(1.0, 1.0, 0.0));
  let n001 = hash31(i + vec3<f32>(0.0, 0.0, 1.0));
  let n101 = hash31(i + vec3<f32>(1.0, 0.0, 1.0));
  let n011 = hash31(i + vec3<f32>(0.0, 1.0, 1.0));
  let n111 = hash31(i + vec3<f32>(1.0, 1.0, 1.0));
  let nx0 = mix(mix(n000, n100, u.x), mix(n010, n110, u.x), u.y);
  let nx1 = mix(mix(n001, n101, u.x), mix(n011, n111, u.x), u.y);
  return mix(nx0, nx1, u.z);
}

// ---- Fractional Brownian Motion ----

fn fbm(p_in: vec3<f32>, octaves: i32) -> f32 {
  var p = p_in;
  var value = 0.0;
  var amplitude = 0.5;
  var frequency = 1.0;
  for (var i = 0; i < octaves; i = i + 1) {
    value = value + amplitude * valueNoise(p * frequency);
    amplitude = amplitude * 0.5;
    frequency = frequency * 2.17;
    // Rotate domain between octaves for less axis-alignment
    p = vec3<f32>(
      p.x * 0.866 + p.z * 0.5,
      p.y,
      p.z * 0.866 - p.x * 0.5,
    );
  }
  return value;
}

// ---- Domain warping ----

fn domainWarp(p: vec3<f32>, t: f32) -> vec3<f32> {
  let q = vec3<f32>(
    fbm(p + vec3<f32>(0.0, 0.0, 0.0) + t * 0.15, 4),
    fbm(p + vec3<f32>(5.2, 1.3, 2.8) + t * 0.12, 4),
    fbm(p + vec3<f32>(1.7, 9.2, 4.1) + t * 0.18, 4),
  );
  return p + q * 1.8;
}

// ---- Voronoi distance (for crystal facet structure) ----

fn voronoi(p: vec3<f32>) -> vec2<f32> {
  let i = floor(p);
  let f = fract(p);
  var d1 = 8.0;
  var d2 = 8.0;
  for (var z = -1; z <= 1; z = z + 1) {
    for (var y = -1; y <= 1; y = y + 1) {
      for (var x = -1; x <= 1; x = x + 1) {
        let offset = vec3<f32>(f32(x), f32(y), f32(z));
        let randomPt = hash33(i + offset);
        let diff = offset + randomPt - f;
        let dist = dot(diff, diff);
        if (dist < d1) {
          d2 = d1;
          d1 = dist;
        } else if (dist < d2) {
          d2 = dist;
        }
      }
    }
  }
  return vec2<f32>(sqrt(d1), sqrt(d2));
}

// ---- Palette: spectral energy ramp ----

fn energyPalette(t: f32, phase: f32) -> vec3<f32> {
  let a = vec3<f32>(0.5, 0.5, 0.5);
  let b = vec3<f32>(0.5, 0.5, 0.5);
  let c = vec3<f32>(1.0, 1.0, 1.0);
  let d = vec3<f32>(0.00, 0.10, 0.20) + phase;
  return a + b * cos(6.28318 * (c * t + d));
}

// ---- Main fragment ----

@fragment
fn shade_fs(input: VertexInput) -> @location(0) vec4<f32> {
  let t = previewUniforms.timeSeconds;
  let isSphere = previewUniforms.sceneMode > 0.5;

  // Build a coordinate system that works on both sphere and fullscreen
  var p: vec3<f32>;
  if (isSphere) {
    // On the sphere: use normal as the primary domain, UV for detail
    p = normalize(input.normal) * 2.0 + vec3<f32>(input.uv, 0.0) * 0.3;
  } else {
    // Fullscreen quad: use UV as XY, synthesize depth from time
    let centered = input.uv * 2.0 - vec2<f32>(1.0, 1.0);
    p = vec3<f32>(centered * 2.5, sin(t * 0.3) * 0.5);
  }

  // First warp pass – large-scale energy flow
  let warped = domainWarp(p * 1.2, t * 0.4);

  // Voronoi crystal structure
  let voro = voronoi(warped * 2.5 + t * 0.08);
  let cellEdge = smoothstep(0.0, 0.15, voro.y - voro.x);
  let cellCore = 1.0 - smoothstep(0.0, 0.35, voro.x);

  // Second warp pass – fine turbulence
  let turb = fbm(warped * 3.0 + t * 0.25, 5);

  // Energy field intensity
  let pulse = sin(t * 1.8) * 0.5 + 0.5;
  let slowPulse = sin(t * 0.7) * 0.5 + 0.5;
  let fieldIntensity = cellCore * 0.6 + turb * 0.5 + pulse * 0.15;

  // Chromatic dispersion – three spectral channels at different warp offsets
  let redWarp = domainWarp(p * 1.18 + vec3<f32>(0.02, 0.0, 0.0), t * 0.42);
  let blueWarp = domainWarp(p * 1.22 - vec3<f32>(0.02, 0.0, 0.0), t * 0.38);
  let rVoro = voronoi(redWarp * 2.5 + t * 0.08);
  let bVoro = voronoi(blueWarp * 2.5 + t * 0.08);

  let rEdge = smoothstep(0.0, 0.12, rVoro.y - rVoro.x);
  let bEdge = smoothstep(0.0, 0.12, bVoro.y - bVoro.x);

  // Build spectral color from palette + dispersion
  let baseColor = energyPalette(fieldIntensity * 0.8 + t * 0.05, slowPulse * 0.3);
  var color = baseColor;

  // Chromatic aberration: shift R and B channels
  color.r = color.r * (0.7 + 0.3 * rEdge) + (1.0 - rEdge) * 0.12;
  color.b = color.b * (0.7 + 0.3 * bEdge) + (1.0 - bEdge) * 0.18;

  // Crystal edge glow – hot white/cyan on facet boundaries
  let edgeGlow = (1.0 - cellEdge) * (1.0 - cellEdge);
  let edgeColor = vec3<f32>(0.65, 0.9, 1.0) * edgeGlow * 2.5;
  color = color + edgeColor;

  // Core bloom – hot bright center of each voronoi cell
  let bloom = cellCore * cellCore * cellCore;
  let bloomColor = vec3<f32>(1.0, 0.85, 0.95) * bloom * 1.8 * (0.6 + 0.4 * pulse);
  color = color + bloomColor;

  // Volumetric scatter approximation: layer fbm-based fog
  let scatterDepth = fbm(p * 0.8 + vec3<f32>(t * 0.1, t * -0.07, t * 0.05), 3);
  let scatter = smoothstep(0.3, 0.7, scatterDepth) * 0.25;
  let scatterColor = vec3<f32>(0.2, 0.1, 0.4) * scatter;
  color = color + scatterColor;

  // Fresnel rim on sphere mode
  if (isSphere) {
    let viewDir = normalize(vec3<f32>(0.0, 0.0, 1.0));
    let nDotV = abs(dot(normalize(input.normal), viewDir));
    let fresnel = pow(1.0 - nDotV, 3.5);
    let rimColor = vec3<f32>(0.3, 0.5, 1.0) * fresnel * 1.6;
    color = color + rimColor;
  }

  // Subtle vignette on fullscreen
  if (!isSphere) {
    let centered = input.uv * 2.0 - vec2<f32>(1.0, 1.0);
    let vignette = 1.0 - dot(centered, centered) * 0.35;
    color = color * max(vignette, 0.0);
  }

  // Tone-map (simple Reinhard)
  color = color / (color + vec3<f32>(1.0, 1.0, 1.0));

  // Slight gamma for punch
  color = pow(color, vec3<f32>(0.88, 0.88, 0.88));

  return vec4<f32>(color, 1.0);
}
