import { loadMod1ToJson } from "./mod1Parser.js";
import { MatrixUtils } from "./utils/matrixUtils.js";
import { Camera } from "./graphics/camera.js";
import { WebGPUSetup } from "./graphics/webgpu.js";
import { PipelineFactory } from "./graphics/pipelines.js";
import { GeometryUtils } from "./geometry/geometryUtils.js";

window.addEventListener("DOMContentLoaded", () => {
  init().catch((err) => console.error("Initialization error:", err));
});

async function init() {
  const canvas = document.getElementById("gpu-canvas");
  const mod1Input = document.getElementById("mod1Input");

  // Initialize WebGPU
  const webgpu = new WebGPUSetup();
  const { device, context, format } = await webgpu.initialize(canvas);

  // Create shader module
  const shaderModule = await webgpu.createShaderModule("render.wgsl");

  // Create MVP buffer
  const mvpBuffer = webgpu.createUniformBuffer(64);

  // Create bind group layout
  const bindGroupLayout = webgpu.createBindGroupLayout([
    {
      binding: 0,
      visibility: GPUShaderStage.VERTEX,
      buffer: {},
    },
  ]);

  // Create bind group
  const bindGroup = webgpu.createBindGroup(bindGroupLayout, [
    {
      binding: 0,
      resource: { buffer: mvpBuffer },
    },
  ]);

  // Create rendering pipelines
  const pipelineFactory = new PipelineFactory(device, format);
  const pipelines = pipelineFactory.createAllPipelines(shaderModule, bindGroupLayout);

  let wireframeVertexBuffer = null;
  let numWireframeVertices = 0;
  let terrainVertexBuffer = null;
  let numTerrainVertices = 0;

  // 좌표축 버퍼들
  let xAxisVertexBuffer = null;
  let yAxisVertexBuffer = null;
  let zAxisVertexBuffer = null;
  const numAxisVertices = 2; // 각 축은 선 하나이므로 2개 정점

  // Initialize camera
  const camera = new Camera();

  /**
   * Create Model matrix (identity for now, can be extended for object transformations)
   */
  function createModelMatrix() {
    return MatrixUtils.identity();
  }

  /**
   * Compute MVP matrix using proper graphics pipeline
   */
  function computeMVPMatrix() {
    const modelMatrix = createModelMatrix();
    const viewMatrix = camera.createViewMatrix();
    const projectionMatrix = camera.createProjectionMatrix(canvas);

    // MVP = Projection × View × Model
    const mv = MatrixUtils.multiply(viewMatrix, modelMatrix);
    const mvp = MatrixUtils.multiply(projectionMatrix, mv);

    return mvp;
  }

  // Handle mod1 file input
  mod1Input.addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const text = await file.text();
    const { points } = loadMod1ToJson(text, file.name);
    console.log('points', points);

    // Generate terrain geometry from points
    const terrainVertices = GeometryUtils.generateTerrain(points);
    numTerrainVertices = terrainVertices.length / 3;

    // Create terrain vertex buffer
    if (terrainVertices.length > 0) {
      const terrainData = new Float32Array(terrainVertices);
      terrainVertexBuffer = webgpu.createVertexBuffer(terrainData);
    }

    // Generate cube geometry
    const wireframeVertices = GeometryUtils.generateCubeEdges(2);

    numWireframeVertices = wireframeVertices.length / 3;

    // Create wireframe vertex buffer
    const wireframeData = new Float32Array(wireframeVertices);
    wireframeVertexBuffer = webgpu.createVertexBuffer(wireframeData);

    // Update MVP matrix
    const mvpMatrix = computeMVPMatrix();
    webgpu.writeBuffer(mvpBuffer, 0, mvpMatrix);
  });

  window.addEventListener("keydown", (e) => {
    const moveStep = 0.2;
    const rotateStep = 5; // degrees
    const zoomFactor = 0.1;
    
    // Camera movement (WASD: horizontal movement, QE: vertical movement)
    if (e.key === "w") camera.moveRelative(moveStep, 0, 0);     // Forward
    else if (e.key === "s") camera.moveRelative(-moveStep, 0, 0);  // Backward
    else if (e.key === "a") camera.moveRelative(0, -moveStep, 0);  // Left
    else if (e.key === "d") camera.moveRelative(0, moveStep, 0);   // Right
    else if (e.key === "q") camera.moveRelative(0, 0, -moveStep);  // Down
    else if (e.key === "e") camera.moveRelative(0, 0, moveStep);   // Up
    
    // Arrow keys: camera rotation and zoom
    else if (e.key === "ArrowLeft") {
      camera.rotation -= rotateStep;
      camera.updatePosition();
    }
    else if (e.key === "ArrowRight") {
      camera.rotation += rotateStep;
      camera.updatePosition();
    }
    else if (e.key === "ArrowUp") {
      camera.zoom *= (1 + zoomFactor);
      camera.updatePosition();
    }
    else if (e.key === "ArrowDown") {
      camera.zoom *= (1 - zoomFactor);
      camera.updatePosition();
    }

    // Update MVP matrix
    const mvpMatrix = computeMVPMatrix();
    webgpu.writeBuffer(mvpBuffer, 0, mvpMatrix);
  });

  // Render loop
  function frame() {
    if (!wireframeVertexBuffer) {
      requestAnimationFrame(frame);
      return;
    }

    const encoder = webgpu.createCommandEncoder();
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

    // Render coordinate axes
    pass.setPipeline(pipelines.xAxis);
    pass.setBindGroup(0, bindGroup);
    pass.setVertexBuffer(0, xAxisVertexBuffer);
    pass.draw(numAxisVertices, 1, 0, 0);

    pass.setPipeline(pipelines.yAxis);
    pass.setBindGroup(0, bindGroup);
    pass.setVertexBuffer(0, yAxisVertexBuffer);
    pass.draw(numAxisVertices, 1, 0, 0);

    pass.setPipeline(pipelines.zAxis);
    pass.setBindGroup(0, bindGroup);
    pass.setVertexBuffer(0, zAxisVertexBuffer);
    pass.draw(numAxisVertices, 1, 0, 0);

    // Render wireframe
    pass.setPipeline(pipelines.wireframe);
    pass.setBindGroup(0, bindGroup);
    pass.setVertexBuffer(0, wireframeVertexBuffer);
    pass.draw(numWireframeVertices, 1, 0, 0);

    // Render terrain with height-based coloring
    if (terrainVertexBuffer && numTerrainVertices > 0) {
      pass.setPipeline(pipelines.terrain);
      pass.setBindGroup(0, bindGroup);
      pass.setVertexBuffer(0, terrainVertexBuffer);
      pass.draw(numTerrainVertices, 1, 0, 0);
    }

    pass.end();
    webgpu.submitCommands([encoder.finish()]);
    requestAnimationFrame(frame);
  }

  // Initialize coordinate axes
  function initializeAxes() {
    const axes = GeometryUtils.generateAxes();
    
    // Create axis vertex buffers
    xAxisVertexBuffer = webgpu.createVertexBuffer(new Float32Array(axes.xAxis));
    yAxisVertexBuffer = webgpu.createVertexBuffer(new Float32Array(axes.yAxis));
    zAxisVertexBuffer = webgpu.createVertexBuffer(new Float32Array(axes.zAxis));
  }

  // Initialize
  initializeAxes();
  
  // Set initial MVP matrix
  const initialMvpMatrix = computeMVPMatrix();
  webgpu.writeBuffer(mvpBuffer, 0, initialMvpMatrix);

  requestAnimationFrame(frame);
}
