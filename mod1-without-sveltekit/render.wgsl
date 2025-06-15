struct Uniforms {
  mvp: mat4x4<f32>,
};

@group(0) @binding(0) var<uniform> uniforms: Uniforms;

struct VertexInput {
  @location(0) pos: vec3<f32>,
};

struct VertexOutput {
  @builtin(position) position: vec4<f32>,
};

@vertex
fn vs_main(input: VertexInput) -> VertexOutput {
  var out: VertexOutput;
  out.position = uniforms.mvp * vec4<f32>(input.pos, 1.0);
  return out;
}

@fragment
fn fs_main_wireframe() -> @location(0) vec4<f32> {
  return vec4<f32>(1.0, 1.0, 1.0, 1.0); // 흰색 와이어프레임
}

@fragment
fn fs_main_face() -> @location(0) vec4<f32> {
  return vec4<f32>(0.3, 0.6, 0.9, 1.0); // 파란색 바닥면
}

@fragment
fn fs_main_point() -> @location(0) vec4<f32> {
  return vec4<f32>(1.0, 0.0, 0.0, 1.0); // 빨간색 포인트
}

@fragment
fn fs_main_x_axis() -> @location(0) vec4<f32> {
  return vec4<f32>(1.0, 0.0, 0.0, 1.0); // 빨간색 X축
}

@fragment
fn fs_main_y_axis() -> @location(0) vec4<f32> {
  return vec4<f32>(0.0, 1.0, 0.0, 1.0); // 녹색 Y축
}

@fragment
fn fs_main_z_axis() -> @location(0) vec4<f32> {
  return vec4<f32>(0.0, 0.0, 1.0, 1.0); // 파란색 Z축
}
