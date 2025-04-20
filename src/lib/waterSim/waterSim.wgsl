// ─── Data structures ───────────────────────────────────────────────────────────

struct WaterGrid {
  height: f32,
  velocity: vec2<f32>,
  obstacle: f32,
}

struct SimParams {
  grid_size: vec2<f32>,
  delta_time: f32,
  damping: f32,
  wave_speed: f32,
  interaction_pos: vec2<f32>,
  interaction_strength: f32,
}

struct VertexOutput {
  @builtin(position) position: vec4<f32>,
  @location(0) texCoord:    vec2<f32>,
  @location(1) worldPos2D:  vec2<f32>,
}

// ─── Bindings ───────────────────────────────────────────────────────────────────

@group(0) @binding(0) var<storage, read>       gridIn:  array<WaterGrid>;
@group(0) @binding(1) var<storage, read_write> gridOut: array<WaterGrid>;
@group(0) @binding(2) var<uniform>             params:  SimParams;

// isometric camera matrix
@group(1) @binding(0) var<uniform> viewProj: mat4x4<f32>;

// ─── Helpers ─────────────────────────────────────────────────────────────────────

fn getIndex(p: vec2<u32>) -> u32 {
  return p.y * u32(params.grid_size.x) + p.x;
}

// ─── Compute Shader ──────────────────────────────────────────────────────────────

@compute @workgroup_size(16,16)
fn computeMain(@builtin(global_invocation_id) gid: vec3<u32>) {
  let x = gid.x;
  let y = gid.y;
  if (x >= u32(params.grid_size.x) || y >= u32(params.grid_size.y)) {
    return;
  }
  let idx = getIndex(vec2<u32>(x,y));
  let cell = gridIn[idx];
  if (cell.obstacle > 0.5) {
    gridOut[idx] = cell;
    return;
  }

  // accumulate neighbor forces
  var force: vec2<f32> = vec2<f32>(0.0, 0.0);
  let offs = array<vec2<i32>,4>(
    vec2<i32>(1,0), vec2<i32>(-1,0),
    vec2<i32>(0,1), vec2<i32>(0,-1)
  );
  for (var i = 0; i < 4; i = i + 1) {
    let nx = i32(x) + offs[i].x;
    let ny = i32(y) + offs[i].y;
    if (nx >= 0 && nx < i32(params.grid_size.x) &&
        ny >= 0 && ny < i32(params.grid_size.y)) {
      let nidx = getIndex(vec2<u32>(u32(nx), u32(ny)));
      let ncell = gridIn[nidx];
      if (ncell.obstacle < 0.5) {
        let dh = ncell.height - cell.height;
        force += vec2<f32>(offs[i]) * dh;
      }
    }
  }

  // update velocity & damping
  var vel = cell.velocity + force * params.wave_speed * params.delta_time;
  vel *= (1.0 - params.damping);

  // user interaction
  let u = f32(x) / params.grid_size.x;
  let v = f32(y) / params.grid_size.y;
  let dist = distance(vec2<f32>(u,v), params.interaction_pos);
  if (dist < 0.05 && params.interaction_strength > 0.0) {
    vel += normalize(vec2<f32>(u,v) - params.interaction_pos)
         * (0.05 - dist) * 20.0 * params.interaction_strength;
  }

  // divergence → height
  var div: f32 = 0.0;
  if (x > 0u && x < (u32(params.grid_size.x) - 1u)) {
    let vr = gridIn[getIndex(vec2<u32>(x+1u,y))].velocity.x;
    let vl = gridIn[getIndex(vec2<u32>(x-1u,y))].velocity.x;
    div += (vr - vl) * 0.5;
  }
  if (y > 0u && y < (u32(params.grid_size.y) - 1u)) {
    let vu = gridIn[getIndex(vec2<u32>(x,y+1u))].velocity.y;
    let vd = gridIn[getIndex(vec2<u32>(x,y-1u))].velocity.y;
    div += (vu - vd) * 0.5;
  }

  let newH = cell.height - div * params.delta_time;
  gridOut[idx].height   = newH;
  gridOut[idx].velocity = vel;
  gridOut[idx].obstacle = cell.obstacle;
}

// ─── Vertex Shader ──────────────────────────────────────────────────────────────

@vertex
fn vertMain(
  @location(0) position : vec2<f32>,
  @location(1) texCoord : vec2<f32>
) -> VertexOutput {
  let idx = getIndex(vec2<u32>(
    u32(texCoord.x * params.grid_size.x),
    u32(texCoord.y * params.grid_size.y)
  ));
  let h = gridIn[idx].height * 0.3;
  let worldPos = vec3<f32>(position.x, h, position.y);

  var out: VertexOutput;
  out.position   = viewProj * vec4<f32>(worldPos, 1.0);
  out.texCoord   = texCoord;
  out.worldPos2D = position;
  return out;
}

// ─── Fragment Shader ────────────────────────────────────────────────────────────

@fragment
fn fragMain(in: VertexOutput) -> @location(0) vec4<f32> {
  let shallow = vec3<f32>(0.0, 0.5, 0.8);
  let deep    = vec3<f32>(0.0, 0.2, 0.4);
  // recompute height for coloration
  let idx = getIndex(vec2<u32>(
    u32(in.texCoord.x * params.grid_size.x),
    u32(in.texCoord.y * params.grid_size.y)
  ));
  let t   = smoothstep(-0.01, 0.01, gridIn[idx].height);
  let col = mix(shallow, deep, t);
  return vec4<f32>(col, 1.0);
}
