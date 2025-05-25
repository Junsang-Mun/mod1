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

  const redBoxShader = await fetch("render.wgsl").then((r) => r.text());
  const shaderModule = device.createShaderModule({ code: redBoxShader });

  const pipeline = device.createRenderPipeline({
    layout: "auto",
    vertex: {
      module: shaderModule,
      entryPoint: "vs_main",
      buffers: [
        {
          arrayStride: 8,
          attributes: [
            {
              shaderLocation: 0,
              offset: 0,
              format: "float32x2",
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
      cullMode: "none",
    },
  });

  let vertexBuffer = null;
  let numVertices = 0;

  mod1Input.addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const text = await file.text();
    const { points } = loadMod1ToJson(text, file.name);

    const SIZE = 20; // box size in pixels
    const canvasWidth = canvas.width;
    const canvasHeight = canvas.height;

    // Create red box vertices for each point
    const vertices = [];
    for (const p of points) {
      const cx = p.x * canvasWidth;
      const cy = p.y * canvasHeight;

      // Box corners (two triangles)
      vertices.push(
        cx - SIZE / 2,
        cy - SIZE / 2,
        cx + SIZE / 2,
        cy - SIZE / 2,
        cx + SIZE / 2,
        cy + SIZE / 2,

        cx - SIZE / 2,
        cy - SIZE / 2,
        cx + SIZE / 2,
        cy + SIZE / 2,
        cx - SIZE / 2,
        cy + SIZE / 2,
      );
    }

    numVertices = vertices.length / 2;

    const vertexData = new Float32Array(vertices);
    vertexBuffer = device.createBuffer({
      size: vertexData.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
      mappedAtCreation: true,
    });
    new Float32Array(vertexBuffer.getMappedRange()).set(vertexData);
    vertexBuffer.unmap();
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
    });

    pass.setPipeline(pipeline);
    pass.setVertexBuffer(0, vertexBuffer);
    pass.draw(numVertices, 1, 0, 0);
    pass.end();

    device.queue.submit([encoder.finish()]);
    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
}
