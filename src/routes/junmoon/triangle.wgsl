@group(0) @binding(0) var mySampler: sampler;
@group(0) @binding(1) var myTexture: texture_2d<f32>;
@group(0) @binding(2) var<uniform> timeUniform: TimeUniform;

struct VertexOut {
  @builtin(position) pos: vec4f,
  @location(0) uv: vec2f,
};

struct TimeUniform {
  time: f32
}

@vertex fn vs(@builtin(vertex_index) vertexIndex : u32) -> VertexOut {
  var positions = array<vec2f, 3>(
    vec2f(0.0, 0.5),
    vec2f(-0.5, -0.5),
    vec2f(0.5, -0.5)
  );

  var uvs = array<vec2f, 3>(
    vec2f(0.5, 0.0),
    vec2f(0.0, 1.0),
    vec2f(1.0, 1.0)
  );

  let angle = timeUniform.time;
  let cosA = cos(angle);
  let sinA = sin(angle);
  let rotation = mat2x2<f32>(
    vec2f(cosA, -sinA),
    vec2f(sinA,  cosA)
  );

  var pos = rotation * positions[vertexIndex];

  var output: VertexOut;
  output.pos = vec4f(pos, 0.0, 1.0);
  output.uv = uvs[vertexIndex];
  return output;
}

@fragment fn fs(@location(0) uv: vec2f) -> @location(0) vec4f {
  return textureSample(myTexture, mySampler, uv);
}
