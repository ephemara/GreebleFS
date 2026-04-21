struct ImagePreviewParams {
  src_width: u32,
  src_height: u32,
  dst_width: u32,
  dst_height: u32,
  brightness: f32,
  contrast: f32,
  saturation: f32,
  temperature: f32,
  highlights: f32,
  shadows: f32,
  vignette: f32,
  _padding0: f32,
}

@group(0) @binding(0) var input_texture: texture_2d<f32>;
@group(0) @binding(1) var linear_sampler: sampler;
@group(0) @binding(2) var output_texture: texture_storage_2d<rgba8unorm, write>;
@group(0) @binding(3) var<uniform> params: ImagePreviewParams;

fn rgb_luminance(color: vec3<f32>) -> f32 {
  return dot(color, vec3<f32>(0.2126, 0.7152, 0.0722));
}

@compute @workgroup_size(8, 8, 1)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  if (gid.x >= params.dst_width || gid.y >= params.dst_height) {
    return;
  }

  let uv = (vec2<f32>(f32(gid.x) + 0.5, f32(gid.y) + 0.5))
    / vec2<f32>(f32(params.dst_width), f32(params.dst_height));

  var sampled = textureSampleLevel(input_texture, linear_sampler, uv, 0.0);
  var color = sampled.rgb;

  let brightness_offset = params.brightness / 100.0;
  let contrast_factor = 1.0 + (params.contrast / 100.0);
  let saturation_factor = 1.0 + (params.saturation / 100.0);
  let temperature_bias = params.temperature / 100.0;
  let highlight_amount = params.highlights / 100.0;
  let shadow_amount = params.shadows / 100.0;
  let vignette_amount = params.vignette / 100.0;

  color = color + vec3<f32>(brightness_offset);
  color = ((color - vec3<f32>(0.5)) * contrast_factor) + vec3<f32>(0.5);

  let luminance = rgb_luminance(color);
  color = vec3<f32>(luminance) + ((color - vec3<f32>(luminance)) * saturation_factor);

  color.r = color.r + (temperature_bias * 0.18);
  color.g = color.g + (temperature_bias * 0.03);
  color.b = color.b - (temperature_bias * 0.18);

  let adjusted_luminance = rgb_luminance(color);
  let shadow_weight = pow(1.0 - adjusted_luminance, 1.6);
  let highlight_weight = pow(adjusted_luminance, 1.8);
  let shadow_lift = shadow_amount * 0.35 * shadow_weight;
  let highlight_lift = highlight_amount * 0.28 * highlight_weight;
  color = color + vec3<f32>(shadow_lift + highlight_lift);

  if (vignette_amount > 0.0) {
    let width = f32(params.dst_width);
    let height = f32(params.dst_height);
    let dx = f32(gid.x) + 0.5 - (width / 2.0);
    let dy = f32(gid.y) + 0.5 - (height / 2.0);
    let max_distance = sqrt((width * width) + (height * height)) / 2.0;
    let radial_distance = sqrt((dx * dx) + (dy * dy));
    let normalized_distance = clamp(radial_distance / max_distance, 0.0, 1.0);
    let vignette_curve = pow(normalized_distance, 1.75);
    let vignette_factor = 1.0 - (vignette_amount * 0.75 * vignette_curve);
    color = color * vignette_factor;
  }

  textureStore(
    output_texture,
    vec2<i32>(i32(gid.x), i32(gid.y)),
    vec4<f32>(clamp(color, vec3<f32>(0.0), vec3<f32>(1.0)), sampled.a),
  );
}
