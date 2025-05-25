struct VertexOutput {
  @builtin(position) position: vec4<f32>,
};

@vertex
fn vs_main(@location(0) pos: vec2<f32>) -> VertexOutput {
  var out: VertexOutput;

  let clipX = pos.x / 400.0 - 1.0;
  let clipY = 1.0 - pos.y / 300.0;
  out.position = vec4<f32>(clipX, clipY, 0.0, 1.0);

  return out;
}

@fragment
fn fs_main() -> @location(0) vec4<f32> {
  return vec4<f32>(1.0, 0.0, 0.0, 1.0); // red
}
