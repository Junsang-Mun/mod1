// waterSimulation.wgsl

struct SimParams {
    dims       : vec4<u32>,   // x: width, y: height, z,w: unused
    physics    : vec4<f32>,   // x: dt, y: gravity, z: friction, w: unused
    addParams  : vec4<f32>,    // x: globalAdd, y: waveAdd, z: parity, w: unused
};

@group(0) @binding(4)
var<uniform> params: SimParams;

// Direct storage‐buffer arrays for terrain, water, and flows:
@group(0) @binding(0) var<storage, read>       terrainMap: array<f32>;
@group(0) @binding(1) var<storage, read_write> waterMap:   array<f32>;
@group(0) @binding(2) var<storage, read_write> flowX:      array<f32>;
@group(0) @binding(3) var<storage, read_write> flowY:      array<f32>;

// Helper to read combined height (terrain + water), with out-of-bounds → 0
fn getHeight(cx: i32, cy: i32) -> f32 {
    let w = i32(params.dims.x);
    let h = i32(params.dims.y);
    if (cx < 0 || cx >= w || cy < 0 || cy >= h) {
        return 0.0;
    }
    let idx = cy * w + cx;
    return terrainMap[idx] + waterMap[idx];
}

// 1) Add water (rain/even rise or one-time wave)
@compute @workgroup_size(16,16)
fn addWater(@builtin(global_invocation_id) gid: vec3<u32>) {
    let x = i32(gid.x);
    let y = i32(gid.y);
    let w = i32(params.dims.x);
    let h = i32(params.dims.y);
    if (x >= w || y >= h) { return; }
    let idx = y * w + x;

    // uniform addition
    let a = params.addParams.x;
    if (a != 0.0) {
        waterMap[idx] = waterMap[idx] + a * params.physics.x;
    }
    // one-time wave on x==0
    let wave = params.addParams.y;
    if (wave != 0.0 && x == 0) {
        waterMap[idx] = waterMap[idx] + wave;
    }
}

// 2) Compute horizontal flows
@compute @workgroup_size(16,16)
fn computeFlowsX(@builtin(global_invocation_id) gid: vec3<u32>) {
    let bx = i32(gid.x);
    let by = i32(gid.y);
    let w = i32(params.dims.x);
    let h = i32(params.dims.y);
    if (by >= h || bx > w) { return; }
    let i = bx;
    let j = by;
    let idx = j * (w+1) + i;
    var curr = flowX[idx] * params.physics.z;  // friction
    let hl = getHeight(i-1, j);
    let hr = getHeight(i,   j);
    curr = curr + (hl - hr) * params.physics.y * params.physics.x;
    flowX[idx] = curr;
}

// 3) Compute vertical flows
@compute @workgroup_size(16,16)
fn computeFlowsY(@builtin(global_invocation_id) gid: vec3<u32>) {
    let bx = i32(gid.x);
    let by = i32(gid.y);
    let w = i32(params.dims.x);
    let h = i32(params.dims.y);
    if (bx >= w || by > h) { return; }
    let i = bx;
    let j = by;
    let idx = j * w + i;
    var curr = flowY[idx] * params.physics.z;
    let hu = getHeight(i, j-1);
    let hd = getHeight(i, j);
    curr = curr + (hu - hd) * params.physics.y * params.physics.x;
    flowY[idx] = curr;
}

// 4) Limit outflow per cell (two‐pass checkerboard to avoid races)
@compute @workgroup_size(16,16)
fn limitOutflow(@builtin(global_invocation_id) gid: vec3<u32>) {
    let x = i32(gid.x);
    let y = i32(gid.y);
    let w = i32(params.dims.x);
    let h = i32(params.dims.y);
    if (x >= w || y >= h) { return; }

    let parity = i32(round(params.addParams.z));
    if (((x + y) & 1) != parity) { return; }

    let idxL = y * (w+1) + x;
    let idxR = y * (w+1) + (x+1);
    let idxU = y * w + x;
    let idxD = (y+1) * w + x;

    var outSum = 0.0;
    // left
    let fL = flowX[idxL];
    if (fL < 0.0) { outSum = outSum - fL; }
    // up
    let fU = flowY[idxU];
    if (fU < 0.0) { outSum = outSum - fU; }
    // right
    let fR = flowX[idxR];
    if (fR > 0.0) { outSum = outSum + fR; }
    // down
    let fD = flowY[idxD];
    if (fD > 0.0) { outSum = outSum + fD; }

    let cellIdx = y * w + x;
    let maxOut = waterMap[cellIdx] / params.physics.x;
    if (outSum > maxOut && outSum > 0.0001) {
        let scale = maxOut / outSum;
        if (fL < 0.0) { flowX[idxL] = fL * scale; }
        if (fU < 0.0) { flowY[idxU] = fU * scale; }
        if (fR > 0.0) { flowX[idxR] = fR * scale; }
        if (fD > 0.0) { flowY[idxD] = fD * scale; }
    }
}

// 5) Update water heights from flows
@compute @workgroup_size(16,16)
fn updateWater(@builtin(global_invocation_id) gid: vec3<u32>) {
    let x = i32(gid.x);
    let y = i32(gid.y);
    let w = i32(params.dims.x);
    let h = i32(params.dims.y);
    if (x >= w || y >= h) { return; }

    let idxL = y * (w+1) + x;
    let idxR = y * (w+1) + (x+1);
    let idxU = y * w + x;
    let idxD = (y+1) * w + x;

    let fL = flowX[idxL];
    let fR = flowX[idxR];
    let fU = flowY[idxU];
    let fD = flowY[idxD];

    // net = inflow (pos from left/up) minus outflow (pos to right/down)
    let net = fL + fU - fR - fD;
    let idxC = y * w + x;
    waterMap[idxC] = max(waterMap[idxC] + net * params.physics.x, 0.0);
}
