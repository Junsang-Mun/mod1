// render.wgsl

struct RenderParams {
    mvpMatrix : mat4x4<f32>,
    dims      : vec4<f32>,
};

@group(0) @binding(2)
var<uniform> renderParams: RenderParams;

// Direct storage arrays for heights:
@group(0) @binding(0) var<storage, read> terrainMap: array<f32>;
@group(0) @binding(1) var<storage, read> waterMap:   array<f32>;

// Terrain vertex → ground shading
struct VSOutGround {
    @builtin(position) Position : vec4<f32>,
    @location(0)         Normal   : vec3<f32>,
    @location(1)         Height01 : f32,
};

@vertex
fn vs_main_ground(@builtin(vertex_index) vi: u32) -> VSOutGround {
    let w = u32(renderParams.dims.x);
    let h = u32(renderParams.dims.y);
    let x = vi % w;
    let y = vi / w;
    let idx = y * w + x;

    let th = terrainMap[idx];
    let wh = waterMap[idx];
    let totalH = th + wh;

    // compute normal via central differences on terrain only
    var hmL: f32;
    if (x > 0u) {
        hmL = terrainMap[idx - 1u];
    } else {
        hmL = th;
    }
    var hmR: f32;
    if (x < w - 1u) {
        hmR = terrainMap[idx + 1u];
    } else {
        hmR = th;
    }
    var hmU: f32;
    if (y > 0u) {
        hmU = terrainMap[idx - w];
    } else {
        hmU = th;
    }
    var hmD: f32;
    if (y < h - 1u) {
        hmD = terrainMap[idx + w];
    } else {
        hmD = th;
    }
    let dx = hmL - hmR;
    let dz = hmU - hmD;
    let normal = normalize(vec3<f32>(dx, 2.0, dz));

    // world → clip
    let worldPos = vec4<f32>(f32(x), totalH, f32(y), 1.0);
    let pos      = renderParams.mvpMatrix * worldPos;

    var out: VSOutGround;
    out.Position = pos;
    out.Normal   = normal;
    out.Height01 = th / 10.0;  // for color blend
    return out;
}

// Terrain fragment
@fragment
fn fs_main_ground(in: VSOutGround) -> @location(0) vec4<f32> {
    let lightDir = normalize(vec3<f32>(1.0, 1.0, 1.0));
    let diff = max(dot(in.Normal, lightDir), 0.0);
    let amb  = 0.4;
    let baseColor = mix(vec3<f32>(0.2,0.6,0.2), vec3<f32>(0.5,0.4,0.3), in.Height01);
    let c = baseColor * (amb + diff * 0.6);
    return vec4<f32>(c, 1.0);
}

// Water vertex → flat quad at surface
struct VSOutWater {
    @builtin(position) Position : vec4<f32>,
    @location(0)         Depth    : f32,
};

@vertex
fn vs_main_water(@builtin(vertex_index) vi: u32) -> VSOutWater {
    let w = u32(renderParams.dims.x);
    let h = u32(renderParams.dims.y);
    let x = vi % w;
    let y = vi / w;
    let idx = y * w + x;

    let th = terrainMap[idx];
    let wh = waterMap[idx];
    let totalH = th + wh;

    let worldPos = vec4<f32>(f32(x), totalH, f32(y), 1.0);
    let pos      = renderParams.mvpMatrix * worldPos;

    var out: VSOutWater;
    out.Position = pos;
    out.Depth    = wh;
    return out;
}

// Water fragment
@fragment
fn fs_main_water(in: VSOutWater) -> @location(0) vec4<f32> {
    if (in.Depth < 0.001) {
        discard;
    }
    let alpha = clamp(in.Depth, 0.0, 1.0) * 0.6;
    return vec4<f32>(0.0, 0.3, 0.6, alpha);
}
