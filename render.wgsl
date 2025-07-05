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

// 지형용 확장된 버텍스 출력 구조체
struct TerrainVertexOutput {
  @builtin(position) position: vec4<f32>,
  @location(0) worldHeight: f32,
};

// 파티클용 확장된 버텍스 출력 구조체
struct ParticleVertexOutput {
  @builtin(position) position: vec4<f32>,
  @location(0) worldPos: vec3<f32>,
};

@vertex
fn vs_main(input: VertexInput) -> VertexOutput {
  var out: VertexOutput;
  out.position = uniforms.mvp * vec4<f32>(input.pos, 1.0);
  return out;
}

// 지형용 버텍스 셰이더
@vertex
fn vs_terrain(input: VertexInput) -> TerrainVertexOutput {
  var out: TerrainVertexOutput;
  out.position = uniforms.mvp * vec4<f32>(input.pos, 1.0);
  out.worldHeight = input.pos.z; // Z 좌표를 높이로 사용
  return out;
}

// --- Gravity-enabled Particle Vertex Shader ---
// 확장된 Uniforms: 시간과 가속도 벡터 추가
struct ParticleUniforms {
  mvp: mat4x4<f32>,        // 0-63 바이트 (64바이트)
  acceleration: vec3<f32>, // 64-75 바이트 (12바이트 + 4바이트 패딩으로 16바이트 경계 정렬)
  time: f32,               // 76-79 바이트 (4바이트)
  // 총 80바이트 (WebGPU 메모리 정렬 규칙 준수)
};
@group(0) @binding(0) var<uniform> particleUniforms: ParticleUniforms;

// 파티클용 버텍스 셰이더 (3차원 가속도 적용)
@vertex
fn vs_particle(input: VertexInput) -> ParticleVertexOutput {
  var out: ParticleVertexOutput;
  var pos = input.pos;
  
  // 가속도 공식: p = p0 + v0 * t + 0.5 * a * t^2 (v0=0 가정)
  // 0.001는 time scale 조절용 상수
  // 3차원 가속도 벡터를 모든 축에 적용
  let timeSquared = 0.001 * particleUniforms.time * particleUniforms.time;
  let displacement = 0.5 * particleUniforms.acceleration * timeSquared;
  
  pos = pos + displacement;
  
  out.position = particleUniforms.mvp * vec4<f32>(pos, 1.0);
  out.worldPos = pos;
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

// 높이 기반 색상 계산 지형 프래그먼트 셰이더
@fragment
fn fs_terrain(input: TerrainVertexOutput) -> @location(0) vec4<f32> {
  let height = input.worldHeight;

  // 높이가 -1.0이면 파란색 (물)
  if (height < -0.99) {
    return vec4<f32>(0.0, 0.0, 1.0, 1.0);
  }
  
  // 높이가 -1.0보다 크면 갈색에서 초록색으로 그라데이션
  // 높이 범위 -1.0~1.0을 0.0~1.0으로 정규화
  let normalizedHeight = clamp((height + 1.0) / 2.0, 0.0, 1.0);
  
  // 갈색 (낮은 높이)
  let brownColor = vec3<f32>(0.6, 0.4, 0.2);
  // 초록색 (높은 높이) 
  let greenColor = vec3<f32>(0.2, 0.8, 0.2);
  
  // 높이에 따라 두 색상을 보간
  let color = mix(brownColor, greenColor, normalizedHeight);
  
  return vec4<f32>(color, 1.0);
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

// 파티클용 프래그먼트 셰이더 - 위치 기반 색상
@fragment
fn fs_particle(input: ParticleVertexOutput) -> @location(0) vec4<f32> {
  let pos = input.worldPos;
  
  // 파티클의 크기에 따른 색상 변화 (중심에서 가장자리로)
  let centerDistance = length(pos.xy);
  
  // 높이(Z)에 따른 기본 색상
  let height = pos.z;
  let normalizedHeight = clamp((height + 1.0) / 2.0, 0.0, 1.0);
  
  // 기본 색상: 높이에 따라 빨간색에서 주황색으로
  let redColor = vec3<f32>(1.0, 0.2, 0.2);    // 낮은 높이
  let orangeColor = vec3<f32>(1.0, 0.6, 0.2); // 높은 높이
  
  // 높이에 따른 색상 보간
  let baseColor = mix(redColor, orangeColor, normalizedHeight);
  
  // 중심에서 가장자리로 갈수록 밝기 감소 (부드러운 효과)
  let brightness = 1.0 - smoothstep(0.0, 0.05, centerDistance);
  let finalColor = baseColor * mix(0.7, 1.0, brightness);
  
  return vec4<f32>(finalColor, 1.0);
}
