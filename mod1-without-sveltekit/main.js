import { loadMod1ToJson } from "./mod1Parser.js";

window.addEventListener("DOMContentLoaded", () => {
  init().catch((err) => console.error("Initialization error:", err));
});

async function init() {
  const canvas = document.getElementById("gpu-canvas");
  const mod1Input = document.getElementById("mod1Input");

  if (!navigator.gpu) {
    alert("WebGPU not supported");
    return;
  }

  const adapter = await navigator.gpu.requestAdapter();
  const device = await adapter.requestDevice();
  const context = canvas.getContext("webgpu");
  const format = navigator.gpu.getPreferredCanvasFormat();
  context.configure({ device, format, alphaMode: "opaque" });

  const shaderSource = await fetch("render.wgsl").then((r) => r.text());
  const shaderModule = device.createShaderModule({ code: shaderSource });

  const mvpBuffer = device.createBuffer({
    size: 64,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

  const bindGroupLayout = device.createBindGroupLayout({
    entries: [
      {
        binding: 0,
        visibility: GPUShaderStage.VERTEX,
        buffer: {},
      },
    ],
  });

  const bindGroup = device.createBindGroup({
    layout: bindGroupLayout,
    entries: [
      {
        binding: 0,
        resource: { buffer: mvpBuffer },
      },
    ],
  });

  const pipeline = device.createRenderPipeline({
    layout: device.createPipelineLayout({
      bindGroupLayouts: [bindGroupLayout],
    }),
    vertex: {
      module: shaderModule,
      entryPoint: "vs_main",
      buffers: [
        {
          arrayStride: 12,
          attributes: [
            {
              shaderLocation: 0,
              offset: 0,
              format: "float32x3",
            },
          ],
        },
      ],
    },
    fragment: {
      module: shaderModule,
      entryPoint: "fs_main",
      targets: [{ format }],
    },
    primitive: {
      topology: "triangle-list",
      cullMode: "back",
    },
    depthStencil: {
      format: "depth24plus",
      depthWriteEnabled: true,
      depthCompare: "less",
    },
  });

  let vertexBuffer = null;
  let numVertices = 0;

  let cameraX = 0;
  let cameraY = 0;
  let cameraZ = -2;
  let cameraRotation = 0;
  let zoom = 1.0;

  /**
   * Computes the Model-View-Projection (MVP) matrix for an isometric view.
   * 
   * The isometric view is achieved by rotating the scene:
   * - Around the X-axis by 35.264° to simulate the isometric angle.
   * - Around the Y-axis by 45° plus an optional camera rotation.
   * 
   * The function combines two rotation matrices (`rotX` and `rotY`) to create
   * a view matrix. This matrix is used to transform 3D coordinates into the
   * isometric perspective.
   */
  function computeIsometricMVP() {
    const degToRad = (d) => (d * Math.PI) / 180;
    const angleX = degToRad(35.264);
    const angleY = degToRad(45 + cameraRotation);

    const cx = Math.cos(angleX),
      sx = Math.sin(angleX);
    const cy = Math.cos(angleY),
      sy = Math.sin(angleY);

    const rotX = [1, 0, 0, 0, 0, cx, -sx, 0, 0, sx, cx, 0, 0, 0, 0, 1];

    const rotY = [cy, 0, sy, 0, 0, 1, 0, 0, -sy, 0, cy, 0, 0, 0, 0, 1];

    const view = new Float32Array(16);
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 4; j++) {
        view[j * 4 + i] =
          rotY[i] * rotX[j * 4 + 0] +
          rotY[i + 4] * rotX[j * 4 + 1] +
          rotY[i + 8] * rotX[j * 4 + 2] +
          rotY[i + 12] * rotX[j * 4 + 3];
      }
    }
    view[12] = cameraX;
    view[13] = cameraY;
    view[14] = cameraZ;

    const left = -1.5 / zoom,
      right = 1.5 / zoom;
    const bottom = -1.5 / zoom,
      top = 1.5 / zoom;
    const near = -10,
      far = 10;

    const ortho = new Float32Array([
      2 / (right - left),
      0,
      0,
      0,
      0,
      2 / (top - bottom),
      0,
      0,
      0,
      0,
      -2 / (far - near),
      0,
      -(right + left) / (right - left),
      -(top + bottom) / (top - bottom),
      -(far + near) / (far - near),
      1,
    ]);

    const mvp = new Float32Array(16);
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 4; j++) {
        mvp[j * 4 + i] =
          ortho[i] * view[j * 4 + 0] +
          ortho[i + 4] * view[j * 4 + 1] +
          ortho[i + 8] * view[j * 4 + 2] +
          ortho[i + 12] * view[j * 4 + 3];
      }
    }
    return mvp;
  }

  mod1Input.addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const text = await file.text();
    const { points } = loadMod1ToJson(text, file.name);

    const SIZE = 0.01;
    const vertices = [];

    const cube = [
      [-1, -1, -1],
      [1, -1, -1],
      [1, 1, -1],
      [-1, 1, -1],
      [-1, -1, 1],
      [1, -1, 1],
      [1, 1, 1],
      [-1, 1, 1],
    ];

    const faces = [
      [0, 1, 2],
      [0, 2, 3],
      [4, 5, 6],
      [4, 6, 7],
      [0, 1, 5],
      [0, 5, 4],
      [2, 3, 7],
      [2, 7, 6],
      [1, 2, 6],
      [1, 6, 5],
      [0, 3, 7],
      [0, 7, 4],
    ];

    for (const p of points) {
      const base = [p.x, p.y, p.z];
      for (const face of faces) {
        for (const i of face) {
          vertices.push(
            base[0] + SIZE * cube[i][0],
            base[1] + SIZE * cube[i][1],
            base[2] + SIZE * cube[i][2],
          );
        }
      }
    }

    numVertices = vertices.length / 3;

    const vertexData = new Float32Array(vertices);
    vertexBuffer = device.createBuffer({
      size: vertexData.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
      mappedAtCreation: true,
    });
    new Float32Array(vertexBuffer.getMappedRange()).set(vertexData);
    vertexBuffer.unmap();

    const mvpMatrix = computeIsometricMVP();
    device.queue.writeBuffer(mvpBuffer, 0, mvpMatrix);
  });

  window.addEventListener("keydown", (e) => {
    const step = 0.05;
    const rotateStep = 5; // degrees
    const zoomFactor = 0.1;
    if (e.key === "ArrowUp") cameraY += step;
    else if (e.key === "ArrowDown") cameraY -= step;
    else if (e.key === "ArrowLeft") cameraX -= step;
    else if (e.key === "ArrowRight") cameraX += step;
    else if (e.key === "w") zoom *= 1 - zoomFactor;
    else if (e.key === "s") zoom *= 1 + zoomFactor;
    else if (e.key === "q") cameraRotation -= rotateStep;
    else if (e.key === "e") cameraRotation += rotateStep;

    const mvpMatrix = computeIsometricMVP();
    device.queue.writeBuffer(mvpBuffer, 0, mvpMatrix);
  });

  function frame() {
    if (!vertexBuffer) {
      requestAnimationFrame(frame);
      return;
    }

    const encoder = device.createCommandEncoder();
    const pass = encoder.beginRenderPass({
      colorAttachments: [
        {
          view: context.getCurrentTexture().createView(),
          clearValue: { r: 0, g: 0, b: 0, a: 1 },
          loadOp: "clear",
          storeOp: "store",
        },
      ],
      depthStencilAttachment: {
        view: device
          .createTexture({
            size: [canvas.width, canvas.height],
            format: "depth24plus",
            usage: GPUTextureUsage.RENDER_ATTACHMENT,
          })
          .createView(),
        depthClearValue: 1.0,
        depthLoadOp: "clear",
        depthStoreOp: "store",
      },
    });

    pass.setPipeline(pipeline);
    pass.setBindGroup(0, bindGroup);
    pass.setVertexBuffer(0, vertexBuffer);
    pass.draw(numVertices, 1, 0, 0);
    pass.end();

    device.queue.submit([encoder.finish()]);
    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
}
