struct VertexOutput {
  @builtin(position) position: vec4<f32>,
  @location(0) uv: vec2<f32>,
};

@vertex
fn shade_vs(@builtin(vertex_index) vertex_index: u32) -> VertexOutput {
  var positions = array<vec2<f32>, 3>(
    vec2<f32>(-1.0, -3.0),
    vec2<f32>(-1.0, 1.0),
    vec2<f32>(3.0, 1.0),
  );
  var output: VertexOutput;
  let position = positions[vertex_index];
  output.position = vec4<f32>(position, 0.0, 1.0);
  output.uv = position * 0.5 + vec2<f32>(0.5, 0.5);
  return output;
}

@fragment
fn shade_fs(input: VertexOutput) -> @location(0) vec4<f32> {
  let glow = 0.5 + 0.5 * sin(input.uv.x * 12.0);
  let tint = vec3<f32>(0.15, 0.42, 0.98);
  return vec4<f32>(tint * glow + vec3<f32>(0.08, 0.02, 0.16), 1.0);
}
