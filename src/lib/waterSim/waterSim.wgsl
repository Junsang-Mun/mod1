struct Particle {
  pos: vec2<f32>,
  vel: vec2<f32>,
};

@group(0) @binding(0)
var<storage, read_write> particles: array<Particle>;

@compute @workgroup_size(64)
fn computeMain(@builtin(global_invocation_id) id: vec3<u32>) {
  let index = id.x;
  if (index >= arrayLength(&particles)) {
    return;
  }

  let gravity = vec2<f32>(0.0, -0.005);
  let bounds = vec2<f32>(1.0, 1.0);

  let p = particles[index];
  var pos = p.pos;
  var vel = p.vel;

  // 중력 적용
  vel += gravity;

  // 간단한 경계 반사
  if (pos.x < -bounds.x || pos.x > bounds.x) {
    vel.x *= -0.9;
  }
  if (pos.y < -bounds.y || pos.y > bounds.y) {
    vel.y *= -0.9;
  }

  pos += vel;

  particles[index].pos = pos;
  particles[index].vel = vel;
}

struct VertexOut {
  @builtin(position) pos: vec4<f32>,
  @location(0) color: vec4<f32>,
};

@vertex
fn vertMain(@location(0) pos: vec2<f32>) -> VertexOut {
  var out: VertexOut;
  out.pos = vec4<f32>(pos, 0.0, 1.0);
  out.color = vec4<f32>(0.0, 0.5 + 0.5 * pos.y, 1.0, 1.0);
  return out;
}

@fragment
fn fragMain(in: VertexOut) -> @location(0) vec4<f32> {
  return in.color;
}
