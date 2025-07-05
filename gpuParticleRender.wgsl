// gpuParticleRender.wgsl - GPU 파티클 인스턴싱 렌더링

struct Uniforms {
  mvp: mat4x4<f32>,
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
  
  // 파티클 위치로 이동
  let worldPos = scaledPos + particle.position;
  
  out.position = uniforms.mvp * vec4<f32>(worldPos, 1.0);
  out.worldPos = worldPos;
  out.particleRadius = particle.radius;
  out.particleId = f32(particle.id);
  
  return out;
}

@fragment
fn fs_main(input: VertexOutput) -> @location(0) vec4<f32> {
  // 파티클 ID 기반 색상
  let idColor = fract(vec3<f32>(
    sin(input.particleId * 12.9898),
    sin(input.particleId * 78.233),
    sin(input.particleId * 37.719)
  ));
  
  // 높이 기반 색상 조정
  let height = input.worldPos.z;
  let normalizedHeight = clamp((height + 1.0) / 3.0, 0.0, 1.0);
  
  // 기본 색상: 높이에 따라 파란색에서 빨간색으로
  let blueColor = vec3<f32>(0.2, 0.4, 1.0);    // 낮은 높이
  let redColor = vec3<f32>(1.0, 0.4, 0.2);     // 높은 높이
  
  let heightColor = mix(blueColor, redColor, normalizedHeight);
  let finalColor = mix(heightColor, idColor * 0.5 + 0.5, 0.3);
  
  return vec4<f32>(finalColor, 1.0);
} 