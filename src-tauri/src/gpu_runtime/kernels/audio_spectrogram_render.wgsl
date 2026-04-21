const TWO_PI: f32 = 6.283185307179586;

struct AudioSpectrogramParams {
  sample_count: u32,
  image_width: u32,
  image_height: u32,
  window_size: u32,
}

@group(0) @binding(0) var<storage, read> samples: array<f32>;
@group(0) @binding(1) var output_texture: texture_storage_2d<rgba8unorm, write>;
@group(0) @binding(2) var<uniform> params: AudioSpectrogramParams;

fn hann_window(index: u32, size: u32) -> f32 {
  if (size <= 1u) {
    return 1.0;
  }
  return 0.5 - (0.5 * cos((TWO_PI * f32(index)) / f32(size - 1u)));
}

fn color_map(intensity: f32) -> vec3<f32> {
  let low = vec3<f32>(0.03, 0.05, 0.12);
  let mid = vec3<f32>(0.12, 0.52, 0.84);
  let high = vec3<f32>(0.99, 0.86, 0.24);
  let bloom = vec3<f32>(0.98, 0.42, 0.22);
  let a = mix(low, mid, smoothstep(0.0, 0.45, intensity));
  let b = mix(high, bloom, smoothstep(0.45, 1.0, intensity));
  return mix(a, b, smoothstep(0.35, 1.0, intensity));
}

@compute @workgroup_size(8, 8, 1)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  if (gid.x >= params.image_width || gid.y >= params.image_height) {
    return;
  }

  let safe_window = max(16u, min(params.window_size, params.sample_count));
  let available_span = max(1u, params.sample_count - safe_window);
  let start_sample = if (params.image_width <= 1u) {
    0u
  } else {
    (available_span * gid.x) / (params.image_width - 1u)
  };

  let max_frequency_bin = max(1u, (safe_window / 2u) - 1u);
  let frequency_bin = 1u + (((params.image_height - 1u - gid.y) * max_frequency_bin) / max(1u, params.image_height - 1u));

  var real = 0.0;
  var imag = 0.0;
  for (var n = 0u; n < safe_window; n = n + 1u) {
    let sample = samples[start_sample + n] * hann_window(n, safe_window);
    let angle = -TWO_PI * f32(frequency_bin * n) / f32(safe_window);
    real = real + (sample * cos(angle));
    imag = imag + (sample * sin(angle));
  }

  let magnitude = sqrt((real * real) + (imag * imag)) / f32(safe_window);
  let intensity = clamp(log2(1.0 + (magnitude * 32.0)) / 5.0, 0.0, 1.0);
  let color = color_map(intensity);
  textureStore(output_texture, vec2<i32>(i32(gid.x), i32(gid.y)), vec4<f32>(color, 1.0));
}
