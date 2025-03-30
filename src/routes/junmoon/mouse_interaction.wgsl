@group(0) @binding(0) var mySampler: sampler;
@group(0) @binding(1) var myTexture: texture_2d<f32>;
@group(0) @binding(2) var<uniform> timeUniform: TimeUniform;
@group(0) @binding(3) var<uniform> mouseUniform: MouseUniform;

struct VertexOut {
  @builtin(position) pos: vec4f,
  @location(0) uv: vec2f,
};

struct TimeUniform {
  time: f32
}

struct MouseUniform {
  mouseX: f32,
  mouseY: f32
}

@vertex fn vs(@builtin(vertex_index) vertexIndex : u32) -> VertexOut {
  var positions = array<vec2f, 6>(
    // First triangle
    vec2f(-1,  1),  // Top left
    vec2f(-1, -1),  // Bottom left
    vec2f( 1, -1),  // Bottom right
    // Second triangle
    vec2f(-1,  1),  // Top left
    vec2f( 1, -1),  // Bottom right
    vec2f( 1,  1)   // Top right
  );

  var uvs = array<vec2f, 6>(
    // First triangle
    vec2f(0.0, 0.0),  // Top left
    vec2f(0.0, 1.0),  // Bottom left
    vec2f(1.0, 1.0),  // Bottom right
    // Second triangle
    vec2f(0.0, 0.0),  // Top left
    vec2f(1.0, 1.0),  // Bottom right
    vec2f(1.0, 0.0)   // Top right
  );

  let angle = timeUniform.time;
  let cosA = cos(angle);
  let sinA = sin(angle);
  let rotation = mat2x2<f32>(
    vec2f(cosA, -sinA),
    vec2f(sinA,  cosA)
  );

  var pos = positions[vertexIndex];
  var uv = uvs[vertexIndex];

  var output: VertexOut;
  output.pos = vec4f(pos, 0.0, 1.0);
  output.uv = uv;
  return output;
}

@fragment fn fs(@location(0) uv: vec2f) -> @location(0) vec4f {
  // Calculate distance from current pixel to mouse position
  let mousePos = vec2f(mouseUniform.mouseX, mouseUniform.mouseY);
  let distToMouse = distance(uv, mousePos);
  
  // Create a ripple effect
  let ripple = sin(distToMouse * 50.0 - timeUniform.time * 5.0) * 0.5 + 0.5;
  
  // Sample the texture
  let texColor = textureSample(myTexture, mySampler, uv);
  
  // Apply effect near the mouse
  let effectStrength = smoothstep(0.3, 0.0, distToMouse);
  let finalColor = mix(texColor, texColor * ripple, effectStrength);
  
  return finalColor;
}
