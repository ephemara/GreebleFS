const TWO_PI: f32 = 6.283185307179586;

struct AudioSpectralParams {
  sample_count: u32,
  band_count: u32,
  _padding0: u32,
  _padding1: u32,
}

@group(0) @binding(0) var<storage, read> samples: array<f32>;
@group(0) @binding(1) var<storage, read_write> output_bands: array<f32>;
@group(0) @binding(2) var<uniform> params: AudioSpectralParams;

@compute @workgroup_size(64, 1, 1)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let band_index = gid.x;
  if (band_index >= params.band_count) {
    return;
  }

  let half_size = max(1u, params.sample_count / 2u);
  let band_width = max(1u, half_size / params.band_count);
  let start_bin = band_index * band_width;
  let end_bin = min(half_size, start_bin + band_width);

  var magnitude_sum = 0.0;
  var contributing_bins = 0u;

  for (var k = start_bin; k < end_bin; k = k + 1u) {
    var real = 0.0;
    var imag = 0.0;
    for (var n = 0u; n < params.sample_count; n = n + 1u) {
      let angle = -TWO_PI * f32(k * n) / f32(params.sample_count);
      let sample = samples[n];
      real = real + (sample * cos(angle));
      imag = imag + (sample * sin(angle));
    }
    magnitude_sum = magnitude_sum + sqrt((real * real) + (imag * imag));
    contributing_bins = contributing_bins + 1u;
  }

  output_bands[band_index] = magnitude_sum / max(1.0, f32(contributing_bins));
}
