struct AudioWaveformParams {
  sample_count: u32,
  bucket_count: u32,
  _padding0: u32,
  _padding1: u32,
}

struct AudioWaveformResult {
  peak: f32,
  rms: f32,
}

@group(0) @binding(0) var<storage, read> samples: array<f32>;
@group(0) @binding(1) var<storage, read_write> output_buckets: array<AudioWaveformResult>;
@group(0) @binding(2) var<uniform> params: AudioWaveformParams;

@compute @workgroup_size(64, 1, 1)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let bucket_index = gid.x;
  if (bucket_index >= params.bucket_count) {
    return;
  }

  let chunk_size = max(1u, params.sample_count / params.bucket_count);
  let start = bucket_index * chunk_size;
  let end = min(params.sample_count, start + chunk_size);

  if (start >= end) {
    output_buckets[bucket_index] = AudioWaveformResult(0.0, 0.0);
    return;
  }

  var peak = 0.0;
  var energy = 0.0;
  var count = 0u;

  for (var index = start; index < end; index = index + 1u) {
    let value = abs(samples[index]);
    peak = max(peak, value);
    energy = energy + (value * value);
    count = count + 1u;
  }

  let rms = sqrt(energy / max(1.0, f32(count)));
  output_buckets[bucket_index] = AudioWaveformResult(peak, rms);
}
