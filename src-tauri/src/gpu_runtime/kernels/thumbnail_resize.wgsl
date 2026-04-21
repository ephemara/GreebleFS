struct ThumbnailParams {
  src_width: u32,
  src_height: u32,
  dst_width: u32,
  dst_height: u32,
}

@group(0) @binding(0) var input_texture: texture_2d<f32>;
@group(0) @binding(1) var linear_sampler: sampler;
@group(0) @binding(2) var output_texture: texture_storage_2d<rgba8unorm, write>;
@group(0) @binding(3) var<uniform> params: ThumbnailParams;

@compute @workgroup_size(8, 8, 1)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  if (gid.x >= params.dst_width || gid.y >= params.dst_height) {
    return;
  }

  let uv = (vec2<f32>(f32(gid.x) + 0.5, f32(gid.y) + 0.5))
    / vec2<f32>(f32(params.dst_width), f32(params.dst_height));
  let color = textureSampleLevel(input_texture, linear_sampler, uv, 0.0);
  textureStore(output_texture, vec2<i32>(i32(gid.x), i32(gid.y)), color);
}
