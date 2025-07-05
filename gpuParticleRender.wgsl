// gpuParticleRender.wgsl - GPU 파티클 인스턴싱 렌더링

// render.wgsl의 ParticleUniforms와 동일한 구조로 맞춤
struct Uniforms {
  mvp: mat4x4<f32>,        // 0-63 바이트 (64바이트)
  acceleration: vec3<f32>, // 64-75 바이트 (12바이트 + 4바이트 패딩으로 16바이트 경계 정렬)
  time: f32,               // 76-79 바이트 (4바이트)
  // 총 80바이트 (WebGPU 메모리 정렬 규칙 준수)
};

struct Particle {
    position: vec3<f32>,
    radius: f32,
    velocity: vec3<f32>,
    mass: f32,
    force: vec3<f32>,
    id: u32,
};

@group(0) @binding(0) var<uniform> uniforms: Uniforms;
@group(1) @binding(0) var<storage, read> particles: array<Particle>;

struct VertexInput {
  @location(0) pos: vec3<f32>,
  @builtin(instance_index) instanceIndex: u32,
};

struct VertexOutput {
  @builtin(position) position: vec4<f32>,
  @location(0) worldPos: vec3<f32>,
  @location(1) particleRadius: f32,
  @location(2) particleId: f32,
};

@vertex
fn vs_main(input: VertexInput) -> VertexOutput {
  var out: VertexOutput;
  
  // 파티클 데이터 가져오기
  let particle = particles[input.instanceIndex];
  
  // 버텍스 위치를 파티클 반지름에 맞춰 스케일링
  let scaledPos = input.pos * particle.radius * 2.0;
  
  // render.wgsl의 vs_particle 방식: 시간 기반 가속도 적용
  // 가속도 공식: p = p0 + v0 * t + 0.5 * a * t^2 (v0=0 가정)
  let timeSquared = uniforms.time * uniforms.time;
  let displacement = 0.001 * 0.5 * uniforms.acceleration * timeSquared;
  
  // 초기 위치에 시간 기반 변위를 더함
  var pos = particle.position + displacement;
  
  // 파티클 위치로 이동
  let worldPos = scaledPos + pos;
  
  out.position = uniforms.mvp * vec4<f32>(worldPos, 1.0);
  out.worldPos = worldPos;
  out.particleRadius = particle.radius;
  
  // 인스턴스 인덱스를 직접 사용하여 각 파티클을 구별
  out.particleId = f32(input.instanceIndex);
  
  return out;
}

@fragment
fn fs_main(input: VertexOutput) -> @location(0) vec4<f32> {
  // 파티클 ID 기반 색상 (더 구별되는 색상)
  let id = input.particleId;
  let idColor = vec3<f32>(
    0.5 + 0.5 * sin(id * 2.0 + 0.0),
    0.5 + 0.5 * sin(id * 2.0 + 2.094),
    0.5 + 0.5 * sin(id * 2.0 + 4.188)
  );
  
  // 높이 기반 색상 조정
  let height = input.worldPos.z;
  let normalizedHeight = clamp((height + 1.0) / 3.0, 0.0, 1.0);
  
  // 기본 색상: 높이에 따라 파란색에서 빨간색으로
  let blueColor = vec3<f32>(0.2, 0.4, 1.0);    // 낮은 높이
  let redColor = vec3<f32>(1.0, 0.4, 0.2);     // 높은 높이
  
  let heightColor = mix(blueColor, redColor, normalizedHeight);
  
  // ID 기반 색상을 더 강하게 적용하여 파티클들을 구별
  let finalColor = mix(heightColor, idColor, 0.7);
  
  return vec4<f32>(finalColor, 1.0);
} 