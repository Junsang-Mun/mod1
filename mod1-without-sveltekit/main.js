// main.js

// Wait for the HTML to be parsed so all IDs exist
window.addEventListener("DOMContentLoaded", () => {
  init().catch((err) => console.error("Initialization error:", err));
});

async function init() {
  // ---- DOM elements ----
  const canvas = document.getElementById("gpu-canvas");
  const modeSelect = document.getElementById("modeSelect");
  const scenarioSelect = document.getElementById("scenarioSelect");
  const resetButton = document.getElementById("resetBtn");
  const mod1Input = document.getElementById("mod1Input");

  if (!canvas || !modeSelect || !scenarioSelect || !resetButton || !mod1Input) {
    throw new Error("❌ One or more required DOM elements not found!");
  }

  // ---- Simulation parameters ----
  const WIDTH = 64;
  const HEIGHT = 64;
  const GRAVITY = 9.8;
  const FRICTION = 0.99;
  const RAIN_RATE = 0.1;
  const FLOOD_RATE = 0.5;
  const WAVE_HEIGHT = 5.0;

  // ---- Camera state ----
  let camYaw = Math.PI / 4;
  let camPitch = 0.6;
  let camDistance = 100;
  const target = { x: (WIDTH - 1) / 2, y: 0, z: (HEIGHT - 1) / 2 };

  // ---- Mode & scenario ----
  let currentMode = modeSelect.value;
  let currentScenario = scenarioSelect.value;
  let waveTriggered = false;

  // ---- CPU arrays ----
  const terrainHeight = new Float32Array(WIDTH * HEIGHT);
  const waterHeight = new Float32Array(WIDTH * HEIGHT);
  const flowXData = new Float32Array((WIDTH + 1) * HEIGHT);
  const flowYData = new Float32Array(WIDTH * (HEIGHT + 1));

  // initial radial hill
  for (let y = 0; y < HEIGHT; y++) {
    for (let x = 0; x < WIDTH; x++) {
      const dx = x - (WIDTH - 1) / 2,
        dy = y - (HEIGHT - 1) / 2;
      const d2 = dx * dx + dy * dy;
      let h = 10 * Math.exp(-d2 / (2 * (WIDTH / 4) * (HEIGHT / 4)));
      if (x === 0 || y === 0 || x === WIDTH - 1 || y === HEIGHT - 1) h = 0;
      terrainHeight[y * WIDTH + x] = h;
      waterHeight[y * WIDTH + x] = 0;
    }
  }
  flowXData.fill(0);
  flowYData.fill(0);

  // ---- WebGPU setup ----
  if (!navigator.gpu) {
    alert(
      "WebGPU not supported. Use Chrome 113+ or Canary with --enable-unsafe-webgpu",
    );
    return;
  }
  const adapter = await navigator.gpu.requestAdapter();
  const device = await adapter.requestDevice();
  const context = canvas.getContext("webgpu");
  const format = navigator.gpu.getPreferredCanvasFormat();
  context.configure({ device, format, alphaMode: "opaque" });

  // ---- load WGSL shaders ----
  let simSource, renderSource;
  try {
    const [sR, rR] = await Promise.all([
      fetch("waterSimulation.wgsl"),
      fetch("render.wgsl"),
    ]);
    if (!sR.ok || !rR.ok)
      throw new Error(`Failed to load shaders: ${sR.status},${rR.status}`);
    simSource = await sR.text();
    renderSource = await rR.text();
  } catch (e) {
    console.error("Shader load error:", e);
    return;
  }
  const simulationModule = device.createShaderModule({ code: simSource });
  const renderModule = device.createShaderModule({ code: renderSource });

  // ---- create GPU buffers ----
  const USAGE_S = GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST;
  const USAGE_U = GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST;

  const terrainBuffer = device.createBuffer({
    size: terrainHeight.byteLength,
    usage: USAGE_S,
    mappedAtCreation: true,
  });
  new Float32Array(terrainBuffer.getMappedRange()).set(terrainHeight);
  terrainBuffer.unmap();

  const waterBuffer = device.createBuffer({
    size: waterHeight.byteLength,
    usage: USAGE_S,
    mappedAtCreation: true,
  });
  new Float32Array(waterBuffer.getMappedRange()).set(waterHeight);
  waterBuffer.unmap();

  const flowXBuffer = device.createBuffer({
    size: flowXData.byteLength,
    usage: USAGE_S,
    mappedAtCreation: true,
  });
  new Float32Array(flowXBuffer.getMappedRange()).set(flowXData);
  flowXBuffer.unmap();

  const flowYBuffer = device.createBuffer({
    size: flowYData.byteLength,
    usage: USAGE_S,
    mappedAtCreation: true,
  });
  new Float32Array(flowYBuffer.getMappedRange()).set(flowYData);
  flowYBuffer.unmap();

  const uniformBuffer_sim = device.createBuffer({ size: 48, usage: USAGE_U });
  const uniformBuffer_rnd = device.createBuffer({ size: 80, usage: USAGE_U });

  // index buffer
  const idxs = [];
  for (let y = 0; y < HEIGHT - 1; y++) {
    for (let x = 0; x < WIDTH - 1; x++) {
      const i = y * WIDTH + x,
        tl = i,
        tr = i + 1,
        bl = i + WIDTH,
        br = i + WIDTH + 1;
      idxs.push(tl, bl, br, tl, br, tr);
    }
  }
  const indexData = new Uint32Array(idxs);
  const indexBuffer = device.createBuffer({
    size: indexData.byteLength,
    usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
    mappedAtCreation: true,
  });
  new Uint32Array(indexBuffer.getMappedRange()).set(indexData);
  indexBuffer.unmap();

  // ---- bind layouts & pipelines ----
  const computeBindLayout = device.createBindGroupLayout({
    entries: [
      {
        binding: 0,
        visibility: GPUShaderStage.COMPUTE,
        buffer: { type: "read-only-storage" },
      },
      {
        binding: 1,
        visibility: GPUShaderStage.COMPUTE,
        buffer: { type: "storage" },
      },
      {
        binding: 2,
        visibility: GPUShaderStage.COMPUTE,
        buffer: { type: "storage" },
      },
      {
        binding: 3,
        visibility: GPUShaderStage.COMPUTE,
        buffer: { type: "storage" },
      },
      {
        binding: 4,
        visibility: GPUShaderStage.COMPUTE,
        buffer: { type: "uniform" },
      },
    ],
  });
  const renderBindLayout = device.createBindGroupLayout({
    entries: [
      {
        binding: 0,
        visibility: GPUShaderStage.VERTEX,
        buffer: { type: "read-only-storage" },
      },
      {
        binding: 1,
        visibility: GPUShaderStage.VERTEX,
        buffer: { type: "read-only-storage" },
      },
      {
        binding: 2,
        visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
        buffer: { type: "uniform" },
      },
    ],
  });
  const computePipelineLayout = device.createPipelineLayout({
    bindGroupLayouts: [computeBindLayout],
  });
  const renderPipelineLayout = device.createPipelineLayout({
    bindGroupLayouts: [renderBindLayout],
  });

  const computePipeline_addWater = device.createComputePipeline({
    layout: computePipelineLayout,
    compute: { module: simulationModule, entryPoint: "addWater" },
  });
  const computePipeline_flowX = device.createComputePipeline({
    layout: computePipelineLayout,
    compute: { module: simulationModule, entryPoint: "computeFlowsX" },
  });
  const computePipeline_flowY = device.createComputePipeline({
    layout: computePipelineLayout,
    compute: { module: simulationModule, entryPoint: "computeFlowsY" },
  });
  const computePipeline_limitOutflow = device.createComputePipeline({
    layout: computePipelineLayout,
    compute: { module: simulationModule, entryPoint: "limitOutflow" },
  });
  const computePipeline_updateWater = device.createComputePipeline({
    layout: computePipelineLayout,
    compute: { module: simulationModule, entryPoint: "updateWater" },
  });

  const renderPipeline_ground = device.createRenderPipeline({
    layout: renderPipelineLayout,
    vertex: { module: renderModule, entryPoint: "vs_main_ground" },
    fragment: {
      module: renderModule,
      entryPoint: "fs_main_ground",
      targets: [{ format }],
    },
    primitive: { topology: "triangle-list", cullMode: "none" },
    depthStencil: {
      format: "depth24plus",
      depthWriteEnabled: true,
      depthCompare: "less",
    },
  });
  const renderPipeline_water = device.createRenderPipeline({
    layout: renderPipelineLayout,
    vertex: { module: renderModule, entryPoint: "vs_main_water" },
    fragment: {
      module: renderModule,
      entryPoint: "fs_main_water",
      targets: [
        {
          format,
          blend: {
            color: {
              srcFactor: "src-alpha",
              dstFactor: "one-minus-src-alpha",
              operation: "add",
            },
            alpha: {
              srcFactor: "one",
              dstFactor: "one-minus-src-alpha",
              operation: "add",
            },
          },
        },
      ],
    },
    primitive: { topology: "triangle-list", cullMode: "none" },
    depthStencil: {
      format: "depth24plus",
      depthWriteEnabled: false,
      depthCompare: "less",
    },
  });

  // ---- depth buffer helper ----
  let depthTexture = null;
  function ensureDepthTexture() {
    const w = canvas.clientWidth,
      h = canvas.clientHeight;
    const needsRecreate =
      !depthTexture || depthTexture.width !== w || depthTexture.height !== h;
    if (needsRecreate) {
      depthTexture = device.createTexture({
        size: { width: w, height: h, depthOrArrayLayers: 1 },
        format: "depth24plus",
        usage: GPUTextureUsage.RENDER_ATTACHMENT,
      });
    }
    return depthTexture.createView();
  }

  // ---- bind groups ----
  const bindGroup_compute = device.createBindGroup({
    layout: computeBindLayout,
    entries: [
      { binding: 0, resource: { buffer: terrainBuffer } },
      { binding: 1, resource: { buffer: waterBuffer } },
      { binding: 2, resource: { buffer: flowXBuffer } },
      { binding: 3, resource: { buffer: flowYBuffer } },
      { binding: 4, resource: { buffer: uniformBuffer_sim } },
    ],
  });
  const bindGroup_render = device.createBindGroup({
    layout: renderBindLayout,
    entries: [
      { binding: 0, resource: { buffer: terrainBuffer } },
      { binding: 1, resource: { buffer: waterBuffer } },
      { binding: 2, resource: { buffer: uniformBuffer_rnd } },
    ],
  });

  // ---- uniform ArrayBuffers ----
  const uniformData_sim = new ArrayBuffer(48);
  const simF32 = new Float32Array(uniformData_sim);
  const simU32 = new Uint32Array(uniformData_sim);
  simU32[0] = WIDTH;
  simU32[1] = HEIGHT;
  const uniformData_rend = new ArrayBuffer(80);
  const renF32 = new Float32Array(uniformData_rend);

  // ---- UI events ----
  modeSelect.addEventListener("change", () => (currentMode = modeSelect.value));
  scenarioSelect.addEventListener("change", () => {
    if ((currentScenario = scenarioSelect.value) !== "wave")
      waveTriggered = false;
  });
  resetButton.addEventListener("click", () => {
    waterHeight.fill(0);
    flowXData.fill(0);
    flowYData.fill(0);
    device.queue.writeBuffer(waterBuffer, 0, waterHeight);
    device.queue.writeBuffer(flowXBuffer, 0, flowXData);
    device.queue.writeBuffer(flowYBuffer, 0, flowYData);
    scenarioSelect.value = "manual";
    currentScenario = "manual";
    waveTriggered = false;
  });

  // ---- .mod1 loader ----
  mod1Input.addEventListener("change", async (e) => {
    const f = e.target.files[0];
    if (!f) return console.warn("No .mod1 selected");
    const text = await f.text();
    console.log("🗒 Loaded .mod1:\n", text);
    const points = text
      .trim()
      .split(/\r?\n/)
      .map((line) => {
        const [x, y, z] = line.match(/-?\d+(\.\d+)?/g).map(Number);
        return { x, y, z };
      });
    console.log("🔢 Points:", points);

    // simple nearest‐point interpolation
    for (let j = 0; j < HEIGHT; j++) {
      for (let i = 0; i < WIDTH; i++) {
        let best = points[0],
          bd2 = (i - best.x) ** 2 + (j - best.y) ** 2;
        for (const p of points) {
          const d2 = (i - p.x) ** 2 + (j - p.y) ** 2;
          if (d2 < bd2) {
            bd2 = d2;
            best = p;
          }
        }
        terrainHeight[j * WIDTH + i] = best.z;
      }
    }
    console.log("🎚 terrain[30..34]:", terrainHeight.slice(30, 35));
    device.queue.writeBuffer(terrainBuffer, 0, terrainHeight);
  });

  // ---- camera helper ----
  function updateCameraMatrix() {
    const ex = target.x + camDistance * Math.cos(camPitch) * Math.sin(camYaw);
    const ey = target.y + camDistance * Math.sin(camPitch);
    const ez = target.z + camDistance * Math.cos(camPitch) * Math.cos(camYaw);

    let fx = target.x - ex,
      fy = target.y - ey,
      fz = target.z - ez;
    const fl = Math.hypot(fx, fy, fz);
    fx /= fl;
    fy /= fl;
    fz /= fl;

    const upx = 0,
      upy = 1,
      upz = 0;
    let rx = upy * fz - upz * fy,
      ry = upz * fx - upx * fz,
      rz = upx * fy - upy * fx;
    const rl = Math.hypot(rx, ry, rz);
    rx /= rl;
    ry /= rl;
    rz /= rl;

    const ux = fy * rz - fz * ry,
      uy = fz * rx - fx * rz,
      uz = fx * ry - fy * rx;

    const view = new Float32Array([
      rx,
      ux,
      fx,
      0,
      ry,
      uy,
      fy,
      0,
      rz,
      uz,
      fz,
      0,
      -(rx * ex + ry * ey + rz * ez),
      -(ux * ex + uy * ey + uz * ez),
      -(fx * ex + fy * ey + fz * ez),
      1,
    ]);

    const fov = Math.PI / 4,
      aspect = canvas.clientWidth / canvas.clientHeight,
      fval = 1 / Math.tan(fov / 2),
      nf = 1 / (0.1 - 1000);
    const proj = new Float32Array([
      fval / aspect,
      0,
      0,
      0,
      0,
      fval,
      0,
      0,
      0,
      0,
      1000 * nf,
      -1,
      0,
      0,
      1000 * 0.1 * nf,
      0,
    ]);

    const mvp = new Float32Array(16);
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 4; j++) {
        mvp[j * 4 + i] =
          proj[i] * view[j * 4 + 0] +
          proj[i + 4] * view[j * 4 + 1] +
          proj[i + 8] * view[j * 4 + 2] +
          proj[i + 12] * view[j * 4 + 3];
      }
    }
    renF32.set(mvp, 0);
    renF32[16] = WIDTH;
    renF32[17] = HEIGHT;
  }

  // ---- pickCell with defined upx/upy/upz ----
  function pickCell(ndcX, ndcY) {
    const ex = target.x + camDistance * Math.cos(camPitch) * Math.sin(camYaw);
    const ey = target.y + camDistance * Math.sin(camPitch);
    const ez = target.z + camDistance * Math.cos(camPitch) * Math.cos(camYaw);

    let fx = target.x - ex,
      fy = target.y - ey,
      fz = target.z - ez;
    const fl = Math.hypot(fx, fy, fz);
    fx /= fl;
    fy /= fl;
    fz /= fl;

    const upx = 0,
      upy = 1,
      upz = 0;
    let rx = upy * fz - upz * fy,
      ry = upz * fx - upx * fz,
      rz = upx * fy - upy * fx;
    const rl = Math.hypot(rx, ry, rz);
    rx /= rl;
    ry /= rl;
    rz /= rl;

    const ux = fy * rz - fz * ry,
      uy = fz * rx - fx * rz,
      uz = fx * ry - fy * rx;

    // camera‐space ray
    const fov = Math.PI / 4,
      aspect = canvas.clientWidth / canvas.clientHeight;
    const tanF = Math.tan(fov / 2);
    let cx = ndcX * aspect * tanF,
      cy = ndcY * tanF,
      cz = -1;
    const cl = Math.hypot(cx, cy, cz);
    cx /= cl;
    cy /= cl;
    cz /= cl;

    // transform to world
    const rdx = cx * rx + cy * ux + cz * fx;
    const rdy = cx * ry + cy * uy + cz * fy;
    const rdz = cx * rz + cy * uz + cz * fz;

    if (rdy === 0) return null;
    const t = -(ey - target.y) / rdy;
    if (t < 0) return null;

    const wx = ex + t * rdx;
    const wz = ez + t * rdz;
    const ix = Math.floor(wx + 0.5),
      iz = Math.floor(wz + 0.5);
    if (ix < 0 || ix >= WIDTH || iz < 0 || iz >= HEIGHT) return null;
    return { x: ix, y: iz };
  }

  // ---- main loop ----
  function frame() {
    // sim uniforms
    const dt = 0.016;
    simF32[4] = dt;
    simF32[5] = GRAVITY;
    simF32[6] = FRICTION;
    simF32[7] = 0;
    let gA = 0,
      wA = 0;
    if (currentScenario === "rain") gA = RAIN_RATE;
    if (currentScenario === "even") gA = FLOOD_RATE;
    if (currentScenario === "wave" && !waveTriggered) {
      wA = WAVE_HEIGHT;
      waveTriggered = true;
    }
    simF32[8] = gA;
    simF32[9] = wA;
    simF32[10] = 0;
    simF32[11] = 0;
    device.queue.writeBuffer(uniformBuffer_sim, 0, uniformData_sim);

    // camera uniforms
    updateCameraMatrix();
    device.queue.writeBuffer(uniformBuffer_rnd, 0, uniformData_rend);

    // attachments
    const colorView = context.getCurrentTexture().createView();
    const depthView = ensureDepthTexture();

    const cmd = device.createCommandEncoder();
    // compute pass
    const cpass = cmd.beginComputePass();
    cpass.setBindGroup(0, bindGroup_compute);
    cpass.setPipeline(computePipeline_addWater);
    cpass.dispatchWorkgroups(Math.ceil(WIDTH / 16), Math.ceil(HEIGHT / 16));
    cpass.setPipeline(computePipeline_flowX);
    cpass.dispatchWorkgroups(
      Math.ceil((WIDTH + 1) / 16),
      Math.ceil(HEIGHT / 16),
    );
    cpass.setPipeline(computePipeline_flowY);
    cpass.dispatchWorkgroups(
      Math.ceil(WIDTH / 16),
      Math.ceil((HEIGHT + 1) / 16),
    );
    cpass.setPipeline(computePipeline_limitOutflow);
    simF32[10] = 0;
    device.queue.writeBuffer(uniformBuffer_sim, 40, new Float32Array([0]));
    cpass.dispatchWorkgroups(Math.ceil(WIDTH / 16), Math.ceil(HEIGHT / 16));
    simF32[10] = 1;
    device.queue.writeBuffer(uniformBuffer_sim, 40, new Float32Array([1]));
    cpass.dispatchWorkgroups(Math.ceil(WIDTH / 16), Math.ceil(HEIGHT / 16));
    cpass.setPipeline(computePipeline_updateWater);
    cpass.dispatchWorkgroups(Math.ceil(WIDTH / 16), Math.ceil(HEIGHT / 16));
    cpass.end();

    // render pass
    const rpass = cmd.beginRenderPass({
      colorAttachments: [
        {
          view: colorView,
          clearValue: { r: 0, g: 0, b: 0, a: 1 },
          loadOp: "clear",
          storeOp: "store",
        },
      ],
      depthStencilAttachment: {
        view: depthView,
        depthClearValue: 1,
        depthLoadOp: "clear",
        depthStoreOp: "store",
      },
    });
    rpass.setBindGroup(0, bindGroup_render);
    rpass.setPipeline(renderPipeline_ground);
    rpass.setIndexBuffer(indexBuffer, "uint32");
    rpass.drawIndexed((WIDTH - 1) * (HEIGHT - 1) * 6);
    rpass.setPipeline(renderPipeline_water);
    rpass.drawIndexed((WIDTH - 1) * (HEIGHT - 1) * 6);
    rpass.end();

    device.queue.submit([cmd.finish()]);
    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
}
