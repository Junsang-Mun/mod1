// Constants for SPH simulation
const MAX_PARTICLES = 5000u;
const PI = 3.14159265359;

// Simulation parameters
struct SimParams {
  // System
  deltaTime: f32,
  
  // SPH parameters
  gravity: f32,
  smoothingRadius: f32,
  targetDensity: f32,
  pressureConstant: f32,
  viscosityConstant: f32,
  boundaryDamping: f32,
  
  // Container bounds
  containerWidthHalf: f32,
  containerHeightHalf: f32,
  
  // Other params
  particleRadius: f32,
  particleColor: vec4f,
  
  // Padding to align to 16 bytes
  _padding: vec2f,
}

// Particle properties
struct Particle {
  position: vec2f,
  velocity: vec2f,
  force: vec2f,
  density: f32,
  pressure: f32,
}

// Particle buffer
@group(0) @binding(0) var<storage, read_write> particles: array<Particle, MAX_PARTICLES>;
// Simulation params
@group(0) @binding(1) var<uniform> params: SimParams;
// Number of active particles
@group(0) @binding(2) var<uniform> numParticles: u32;

// Density computation kernel
@compute @workgroup_size(64)
fn computeDensityPressure(@builtin(global_invocation_id) id: vec3u) {
  let i = id.x;
  if (i >= numParticles) { return; }
  
  let pos_i = particles[i].position;
  var density = 0.0;
  
  // Compute density for the current particle by summing contributions from all neighboring particles
  for (var j = 0u; j < numParticles; j++) {
    let pos_j = particles[j].position;
    let dist = distance(pos_i, pos_j);
    
    if (dist < params.smoothingRadius) {
      // Poly6 kernel for density
      let diff = params.smoothingRadius * params.smoothingRadius - dist * dist;
      density += diff * diff * diff;
    }
  }
  
  // Apply kernel normalization
  let kernelNormalization = 315.0 / (64.0 * PI * pow(params.smoothingRadius, 9.0));
  density = density * kernelNormalization;
  
  // Set density and compute pressure for the particle
  particles[i].density = max(density, params.targetDensity * 0.1);
  particles[i].pressure = params.pressureConstant * (particles[i].density - params.targetDensity);
}

// Force computation kernel
@compute @workgroup_size(64)
fn computeForces(@builtin(global_invocation_id) id: vec3u) {
  let i = id.x;
  if (i >= numParticles) { return; }
  
  let pos_i = particles[i].position;
  let density_i = particles[i].density;
  let pressure_i = particles[i].pressure;
  let vel_i = particles[i].velocity;
  
  var force = vec2f(0.0, 0.0);
  
  // Gravity force
  force.y -= params.gravity;
  
  // Compute forces from neighboring particles
  for (var j = 0u; j < numParticles; j++) {
    if (i == j) { continue; }
    
    let pos_j = particles[j].position;
    let density_j = particles[j].density;
    let pressure_j = particles[j].pressure;
    let vel_j = particles[j].velocity;
    
    let dir = pos_i - pos_j;
    let dist = max(length(dir), 0.001); // Avoid division by zero
    
    if (dist < params.smoothingRadius) {
      let normalizedDir = dir / dist;
      
      // Pressure force - using gradient of Spiky kernel
      let spiky = (params.smoothingRadius - dist);
      let pressureTerm = -1.0 * (pressure_i + pressure_j) / (2.0 * density_j);
      let spikyGradCoef = 45.0 / (PI * pow(params.smoothingRadius, 6.0));
      let pressureForce = pressureTerm * spikyGradCoef * spiky * spiky * normalizedDir / density_i;
      
      // Viscosity force - using Laplacian of viscosity kernel
      let viscosityTerm = params.viscosityConstant * (vel_j - vel_i) / density_j;
      let viscLapCoef = 45.0 / (PI * pow(params.smoothingRadius, 6.0));
      let viscosityForce = viscosityTerm * viscLapCoef * (params.smoothingRadius - dist) / density_i;
      
      force += pressureForce + viscosityForce;
    }
  }
  
  particles[i].force = force;
}

// Integration kernel
@compute @workgroup_size(64)
fn integrate(@builtin(global_invocation_id) id: vec3u) {
  let i = id.x;
  if (i >= numParticles) { return; }
  
  // Update velocity and position
  particles[i].velocity += particles[i].force * params.deltaTime;
  particles[i].position += particles[i].velocity * params.deltaTime;
  
  // Boundary conditions - collision with container walls
  let radius = params.particleRadius;
  
  // X boundaries
  if (particles[i].position.x < -params.containerWidthHalf + radius) {
    particles[i].velocity.x *= -params.boundaryDamping;
    particles[i].position.x = -params.containerWidthHalf + radius;
  }
  else if (particles[i].position.x > params.containerWidthHalf - radius) {
    particles[i].velocity.x *= -params.boundaryDamping;
    particles[i].position.x = params.containerWidthHalf - radius;
  }
  
  // Y boundaries
  if (particles[i].position.y < -params.containerHeightHalf + radius) {
    particles[i].velocity.y *= -params.boundaryDamping;
    particles[i].position.y = -params.containerHeightHalf + radius;
  }
  else if (particles[i].position.y > params.containerHeightHalf - radius) {
    particles[i].velocity.y *= -params.boundaryDamping;
    particles[i].position.y = params.containerHeightHalf - radius;
  }
}

// Vertex shader for rendering particles
struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) color: vec4f,
}

struct VertexInput {
  @location(0) position: vec2f,
  @location(1) instanceIndex: u32,
}

@vertex
fn vertexMain(
  @builtin(vertex_index) vertexIndex: u32,
  @builtin(instance_index) instanceIndex: u32
) -> VertexOutput {
  // Skip if instance is beyond the active particle count
  if (instanceIndex >= numParticles) {
    return VertexOutput(vec4f(0.0, 0.0, 0.0, 0.0), vec4f(0.0, 0.0, 0.0, 0.0));
  }
  
  // Define the vertices of a quad
  var positions = array<vec2f, 6>(
    vec2f(-1.0, -1.0),
    vec2f(1.0, -1.0),
    vec2f(1.0, 1.0),
    vec2f(-1.0, -1.0),
    vec2f(1.0, 1.0),
    vec2f(-1.0, 1.0)
  );
  
  // Get the position and radius of this particle
  let particlePosition = particles[instanceIndex].position;
  let particleRadius = params.particleRadius;
  
  // Calculate the position of this vertex
  let quadPosition = positions[vertexIndex] * particleRadius;
  let worldPosition = particlePosition + quadPosition;
  
  // Convert to clip space
  let ndcPosition = vec2f(
    worldPosition.x / params.containerWidthHalf,
    worldPosition.y / params.containerHeightHalf
  );
  
  // Compute color based on density (hotter = higher density)
  let density = particles[instanceIndex].density;
  let normalizedDensity = clamp((density - params.targetDensity) / params.targetDensity + 0.5, 0.0, 1.0);
  
  // Blue to red color gradient based on density
  let color = mix(
    vec4f(0.0, 0.5, 1.0, 1.0),  // Blue for low density
    vec4f(1.0, 0.2, 0.0, 1.0),  // Red for high density
    normalizedDensity
  );
  
  var output: VertexOutput;
  output.position = vec4f(ndcPosition, 0.0, 1.0);
  output.color = color;
  
  return output;
}

@fragment
fn fragmentMain(input: VertexOutput) -> @location(0) vec4f {
  return input.color;
} 