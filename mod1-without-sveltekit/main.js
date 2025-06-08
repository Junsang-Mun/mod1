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

  // 와이어프레임용 파이프라인
  const wireframePipeline = device.createRenderPipeline({
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
      entryPoint: "fs_main_wireframe",
      targets: [{ format }],
    },
    primitive: {
      topology: "line-list",
      cullMode: "none",
    },
    depthStencil: {
      format: "depth24plus",
      depthWriteEnabled: true,
      depthCompare: "less",
    },
  });

  // 면 렌더링용 파이프라인
  const facePipeline = device.createRenderPipeline({
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
      entryPoint: "fs_main_face",
      targets: [{ format }],
    },
    primitive: {
      topology: "triangle-list",
      cullMode: "none",
    },
    depthStencil: {
      format: "depth24plus",
      depthWriteEnabled: true,
      depthCompare: "less",
    },
  });

  let wireframeVertexBuffer = null;
  let numWireframeVertices = 0;
  let bottomFaceVertexBuffer = null;
  let numBottomFaceVertices = 0;

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
    console.log('points', points)

    const SIZE = 1;
    const wireframeVertices = [];
    const bottomFaceVertices = [];

    const cube = [
      [-1, -1, -1],  // 0: 아래 면 왼쪽 뒤
      [1, -1, -1],   // 1: 아래 면 오른쪽 뒤
      [1, 1, -1],    // 2: 아래 면 오른쪽 앞
      [-1, 1, -1],   // 3: 아래 면 왼쪽 앞
      [-1, -1, 1],   // 4: 위 면 왼쪽 뒤
      [1, -1, 1],    // 5: 위 면 오른쪽 뒤
      [1, 1, 1],     // 6: 위 면 오른쪽 앞
      [-1, 1, 1],    // 7: 위 면 왼쪽 앞
    ];

    const edges = [
      // 아래 면의 4개 모서리
      [0, 1], [1, 2], [2, 3], [3, 0],
      // 위 면의 4개 모서리  
      [4, 5], [5, 6], [6, 7], [7, 4],
      // 세로 4개 모서리
      [0, 4], [1, 5], [2, 6], [3, 7],
    ];

    // 와이어프레임 큐브 생성
    const base = [0, 0, 0];
    for (const edge of edges) {
      for (const i of edge) {
        wireframeVertices.push(
          base[0] + SIZE * cube[i][0],
          base[1] + SIZE * cube[i][1],
          base[2] + SIZE * cube[i][2],
        );
      }
    }

    // 바닥면 삼각형 생성 (아래 면: z = -1)
    // 첫 번째 삼각형: 0, 1, 2
    bottomFaceVertices.push(
      base[0] + SIZE * cube[0][0], base[1] + SIZE * cube[0][1], base[2] + SIZE * cube[0][2], // 0
      base[0] + SIZE * cube[1][0], base[1] + SIZE * cube[1][1], base[2] + SIZE * cube[1][2], // 1
      base[0] + SIZE * cube[2][0], base[1] + SIZE * cube[2][1], base[2] + SIZE * cube[2][2]  // 2
    );
    // 두 번째 삼각형: 0, 2, 3
    bottomFaceVertices.push(
      base[0] + SIZE * cube[0][0], base[1] + SIZE * cube[0][1], base[2] + SIZE * cube[0][2], // 0
      base[0] + SIZE * cube[2][0], base[1] + SIZE * cube[2][1], base[2] + SIZE * cube[2][2], // 2
      base[0] + SIZE * cube[3][0], base[1] + SIZE * cube[3][1], base[2] + SIZE * cube[3][2]  // 3
    );

    numWireframeVertices = wireframeVertices.length / 3;
    numBottomFaceVertices = bottomFaceVertices.length / 3;

    // 와이어프레임 버텍스 버퍼 생성
    const wireframeData = new Float32Array(wireframeVertices);
    wireframeVertexBuffer = device.createBuffer({
      size: wireframeData.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
      mappedAtCreation: true,
    });
    new Float32Array(wireframeVertexBuffer.getMappedRange()).set(wireframeData);
    wireframeVertexBuffer.unmap();

    // 바닥면 버텍스 버퍼 생성
    const bottomFaceData = new Float32Array(bottomFaceVertices);
    bottomFaceVertexBuffer = device.createBuffer({
      size: bottomFaceData.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
      mappedAtCreation: true,
    });
    new Float32Array(bottomFaceVertexBuffer.getMappedRange()).set(bottomFaceData);
    bottomFaceVertexBuffer.unmap();

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
    if (!wireframeVertexBuffer || !bottomFaceVertexBuffer) {
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

    // 바닥면 렌더링 (먼저 그려서 뒤에 위치)
    pass.setPipeline(facePipeline);
    pass.setBindGroup(0, bindGroup);
    pass.setVertexBuffer(0, bottomFaceVertexBuffer);
    pass.draw(numBottomFaceVertices, 1, 0, 0);

    // 와이어프레임 렌더링 (위에 그려서 앞에 위치)
    pass.setPipeline(wireframePipeline);
    pass.setBindGroup(0, bindGroup);
    pass.setVertexBuffer(0, wireframeVertexBuffer);
    pass.draw(numWireframeVertices, 1, 0, 0);

    pass.end();

    device.queue.submit([encoder.finish()]);
    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
}
