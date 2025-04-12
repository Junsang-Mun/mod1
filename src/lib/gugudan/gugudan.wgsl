@group(0) @binding(0)
var<storage, read> input : array<u32>;

@group(0) @binding(1)
var<storage, read_write> output : array<u32>;

@compute @workgroup_size(9, 8)
fn main(@builtin(global_invocation_id) id : vec3<u32>) {
    let multiplier = id.x + 1;
    let base = input[id.y];
    let index = id.y * 9u + id.x;
    output[index] = base * multiplier;
}
