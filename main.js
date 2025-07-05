import { loadMod1ToJson } from "./utils/mod1Parser.js";
import { MatrixUtils } from "./utils/matrixUtils.js";
import { Camera } from "./graphics/camera.js";
import { WebGPUSetup } from "./graphics/webgpu.js";
import { PipelineFactory } from "./graphics/pipelines.js";
import { GeometryUtils } from "./geometry/geometryUtils.js";
import { AxesManager } from "./graphics/axes.js";
import { GPUParticleSystem } from "./particleSystem.js";

// Store resize observer and rendering variables globally
let resizeObserver;
let depthTexture;

// GPU 파티클 시스템 전역 변수
let gpuParticleSystem;
let lastFrameTime = performance.now();
let terrainHeightData = [];

window.addEventListener("DOMContentLoaded", () => {
  init().catch((err) => console.error("Initialization error:", err));
});

async function init() {
  const canvas = document.getElementById("gpu-canvas");
  const mod1Input = document.getElementById("mod1Input");

  // Add resize handler to window and orientation change for mobile devices
  window.addEventListener("resize", updateCanvasSize);
  window.addEventListener("orientationchange", updateCanvasSize);

  // Initialize WebGPU
  const webgpu = new WebGPUSetup();
  const { device, context, format } = await webgpu.initialize(canvas);

  // Set canvas size to actual size in device pixels
  function updateCanvasSize() {
    // Small delay to ensure dimensions are updated after orientation changes
    setTimeout(() => {
      const devicePixelRatio = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();

      // Only update if size actually changed
      if (
        canvas.width !== Math.floor(rect.width * devicePixelRatio) ||
        canvas.height !== Math.floor(rect.height * devicePixelRatio)
      ) {
        canvas.width = Math.floor(rect.width * devicePixelRatio);
        canvas.height = Math.floor(rect.height * devicePixelRatio);

        console.log(`Canvas resized to ${canvas.width}x${canvas.height}`);

        // Reconfigure the WebGPU context when size changes
        context.configure({
          device: device,
          format: format,
          alphaMode: "opaque",
        });

        // Create new depth texture with current size
        if (depthTexture) {
          depthTexture.destroy();
        }

        depthTexture = device.createTexture({
          size: [canvas.width, canvas.height],
          format: "depth24plus",
          usage: GPUTextureUsage.RENDER_ATTACHMENT,
        });

        // Update MVP matrix for new aspect ratio
        const mvpMatrix = computeMVPMatrix();
        webgpu.writeBuffer(mvpBuffer, 0, mvpMatrix);
      }
    }, 100); // Small delay to ensure layout is complete
  }

  // Initial canvas size setup (synchronous for initialization)
  function initializeCanvasSize() {
    const devicePixelRatio = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    
    canvas.width = Math.floor(rect.width * devicePixelRatio);
    canvas.height = Math.floor(rect.height * devicePixelRatio);

    console.log(`Canvas initialized to ${canvas.width}x${canvas.height}`);

    // Configure the WebGPU context
    context.configure({
      device: device,
      format: format,
      alphaMode: "opaque",
    });

    // Create initial depth texture
    depthTexture = device.createTexture({
      size: [canvas.width, canvas.height],
      format: "depth24plus",
      usage: GPUTextureUsage.RENDER_ATTACHMENT,
    });
  }

  // Initial canvas size initialization (synchronous)
  initializeCanvasSize();

  // Observe canvas container for size changes
  resizeObserver = new ResizeObserver(updateCanvasSize);
  resizeObserver.observe(canvas.parentElement || document.body);

  // Create shader module
  const shaderModule = await webgpu.createShaderModule("render.wgsl");

  // Create bind group layout
  const bindGroupLayout = webgpu.createBindGroupLayout([
    {
      binding: 0,
      visibility: GPUShaderStage.VERTEX,
      buffer: {},
    },
  ]);

  // Create MVP buffer
  const mvpBuffer = webgpu.createUniformBuffer(64);

  // Create bind group
  const bindGroup = webgpu.createBindGroup(bindGroupLayout, [
    {
      binding: 0,
      resource: { buffer: mvpBuffer },
    },
  ]);

  // --- Particle Uniform Buffer for Gravity ---
  // Allocate 80 bytes (20 floats) for ParticleUniforms
  const particleUniformBuffer = webgpu.createUniformBuffer(80);
  // Create a separate bind group for the particle pipeline
  const particleBindGroup = webgpu.createBindGroup(bindGroupLayout, [
    { binding: 0, resource: { buffer: particleUniformBuffer } },
  ]);

  // Create rendering pipelines
  const pipelineFactory = new PipelineFactory(device, format);
  const pipelines = pipelineFactory.createAllPipelines(
    shaderModule,
    bindGroupLayout,
  );

  // GPU 파티클 렌더링을 위한 별도 파이프라인 설정
  let gpuParticleRenderPipeline = null;
  let gpuParticleBindGroup = null;
  let particleCubeVertexBuffer = null;
  let particleCubeVertexCount = 0;

  async function setupGPUParticleRendering() {
    // GPU 파티클 렌더링 셰이더 모듈 생성
    const gpuParticleShaderModule = await webgpu.createShaderModule("gpuParticleRender.wgsl");
    
    // 바인딩 그룹 레이아웃
    const gpuParticleBindGroupLayout0 = webgpu.createBindGroupLayout([
      {
        binding: 0,
        visibility: GPUShaderStage.VERTEX,
        buffer: {},
      },
    ]);
    
    const gpuParticleBindGroupLayout1 = webgpu.createBindGroupLayout([
      {
        binding: 0,
        visibility: GPUShaderStage.VERTEX,
        buffer: { type: 'read-only-storage' },
      },
    ]);

    // 파이프라인 생성
    gpuParticleRenderPipeline = pipelineFactory.createGPUParticlePipeline(
      gpuParticleShaderModule,
      [gpuParticleBindGroupLayout0, gpuParticleBindGroupLayout1]
    );

    // 파티클 큐브 지오메트리 생성 (단위 큐브)
    const cubeVertices = GeometryUtils.generateCubeFaces(1.0, [0, 0, 0]);
    particleCubeVertexCount = cubeVertices.length / 3;
    
    const cubeData = new Float32Array(cubeVertices);
    particleCubeVertexBuffer = webgpu.createVertexBuffer(cubeData);

    // 바인딩 그룹 생성 함수
    function createGPUParticleBindGroups() {
      if (!gpuParticleSystem || !gpuParticleSystem.particleBuffer) {
        console.warn('GPU 파티클 시스템이 초기화되지 않았습니다.');
        return null;
      }

      return {
        bindGroup0: webgpu.createBindGroup(gpuParticleBindGroupLayout0, [
          {
            binding: 0,
            resource: { buffer: particleUniformBuffer }, // 시간과 가속도 정보 포함된 버퍼 사용
          },
        ]),
        bindGroup1: webgpu.createBindGroup(gpuParticleBindGroupLayout1, [
          {
            binding: 0,
            resource: { buffer: gpuParticleSystem.particleBuffer },
          },
        ])
      };
    }

    return createGPUParticleBindGroups;
  }

  let wireframeVertexBuffer = null;
  let numWireframeVertices = 0;
  let terrainVertexBuffer = null;
  let numTerrainVertices = 0;
  let particleVertexBuffer = null;
  let numParticleVertices = 0;

  // Initialize axes manager
  const axesManager = new AxesManager();

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

  /**
   * Load and process mod1 file data
   */
  async function loadMod1File(text, fileName) {
    const { points } = loadMod1ToJson(text, fileName);
    console.log("points", points);

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

    // Generate particle geometry (기존 단일 파티클)
    const particleVertices = GeometryUtils.generateParticleCube(0.1, [0.5, 0.5, 0.5]);
    numParticleVertices = particleVertices.length / 3;
    const particleData = new Float32Array(particleVertices);
    particleVertexBuffer = webgpu.createVertexBuffer(particleData);

    // GPU 파티클 시스템 초기화
    if (!gpuParticleSystem) {
      console.log('GPU 파티클 시스템 초기화 중...');
      gpuParticleSystem = new GPUParticleSystem(device, 500);
      
      // GPU 파티클 렌더링 설정
      console.log('GPU 파티클 렌더링 설정 중...');
      const createBindGroups = await setupGPUParticleRendering();
      const bindGroups = createBindGroups();
      if (bindGroups) {
        gpuParticleBindGroup = bindGroups;
        console.log('GPU 파티클 바인딩 그룹 초기화 완료');
      } else {
        console.error('GPU 파티클 바인딩 그룹 생성 실패');
      }
    }

    // 지형 높이 데이터 생성 및 업데이트
    generateTerrainHeightData(points);
    gpuParticleSystem.updateTerrain(terrainHeightData, 50);

    // 초기 파티클 추가 - 더 넓게 분산 배치 (크기 증가)
    gpuParticleSystem.addParticle([-0.8, -0.8, 0.8]);
    gpuParticleSystem.addParticle([0.8, -0.8, 0.8]);
    gpuParticleSystem.addParticle([0.0, 0.0, 0.8]);
    gpuParticleSystem.addParticle([-0.8, 0.8, 0.8]);
    gpuParticleSystem.addParticle([0.8, 0.8, 0.8]);
    
    // 바인딩 그룹 업데이트 (파티클이 추가된 후) - 동기화 개선
    if (gpuParticleBindGroup) {
      const createBindGroups = await setupGPUParticleRendering();
      const bindGroups = createBindGroups();
      if (bindGroups) {
        gpuParticleBindGroup = bindGroups;
        console.log('GPU 파티클 바인딩 그룹 업데이트 완료');
      }
    }

    // Update MVP matrix
    const mvpMatrix = computeMVPMatrix();
    webgpu.writeBuffer(mvpBuffer, 0, mvpMatrix);
  }

  /**
   * Generate terrain height data for GPU particle system
   */
  function generateTerrainHeightData(points) {
    const gridResolution = 50;
    const bounds = { min: [-1, -1], max: [1, 1] };
    const stepX = (bounds.max[0] - bounds.min[0]) / (gridResolution - 1);
    const stepY = (bounds.max[1] - bounds.min[1]) / (gridResolution - 1);
    
    terrainHeightData = [];
    
    for (let j = 0; j < gridResolution; j++) {
      for (let i = 0; i < gridResolution; i++) {
        const x = bounds.min[0] + i * stepX;
        const y = bounds.min[1] + j * stepY;
        
        // RBF 보간으로 높이 계산
        let height = -1.0;
        if (points && points.length > 0) {
          const sigma = 0.3;
          let numerator = -1.0;
          let denominator = 1.0;
          
          for (const point of points) {
            const dx = x - point.x;
            const dy = y - point.y;
            const distanceSquared = dx * dx + dy * dy;
            const weight = Math.exp(-distanceSquared / (sigma * sigma));
            
            numerator += weight * point.z;
            denominator += weight;
          }
          
          height = numerator / denominator;
        }
        
        terrainHeightData.push(height);
      }
    }
  }

  /**
   * Automatically load default mod1 file on initialization
   */
  async function loadDefaultMod1() {
    try {
      const response = await fetch('./assets/demo1.mod1');
      if (!response.ok) {
        throw new Error(`Failed to load demo1.mod1: ${response.status}`);
      }
      const text = await response.text();
      await loadMod1File(text, 'demo1.mod1');
      console.log('Default mod1 file loaded successfully');
    } catch (error) {
      console.warn('Failed to load default mod1 file:', error);
    }
  }

  // Handle mod1 file input
  mod1Input.addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const text = await file.text();
    await loadMod1File(text, file.name);
  });

  window.addEventListener("keydown", (e) => {
    const moveStep = 0.2;
    const rotateStep = 5; // degrees
    const zoomFactor = 0.1;

    // Camera movement (WASD: horizontal movement, QE: vertical movement)
    if (e.key === "w")
      camera.moveRelative(moveStep, 0, 0); // Forward
    else if (e.key === "s")
      camera.moveRelative(-moveStep, 0, 0); // Backward
    else if (e.key === "a")
      camera.moveRelative(0, -moveStep, 0); // Left
    else if (e.key === "d")
      camera.moveRelative(0, moveStep, 0); // Right
    else if (e.key === "q")
      camera.moveRelative(0, 0, -moveStep); // Down
    else if (e.key === "e")
      camera.moveRelative(0, 0, moveStep); // Up
    // Arrow keys: camera rotation and zoom
    else if (e.key === "ArrowLeft") {
      camera.rotation -= rotateStep;
      camera.updatePosition();
    } else if (e.key === "ArrowRight") {
      camera.rotation += rotateStep;
      camera.updatePosition();
    } else if (e.key === "ArrowUp") {
      camera.zoom *= 1 + zoomFactor;
      camera.updatePosition();
    } else if (e.key === "ArrowDown") {
      camera.zoom *= 1 - zoomFactor;
      camera.updatePosition();
    }
    // GPU 파티클 추가 (P 키)
    else if (e.key === "p" || e.key === "P") {
      if (gpuParticleSystem) {
        // 랜덤 위치에 파티클 추가 (크기 증가, 더 높은 위치에서 시작)
        gpuParticleSystem.addParticle(
          [Math.random() * 1.6 - 0.8, Math.random() * 1.6 - 0.8, 2.0],
          [0, 0, 0],
          0.15
        );
        console.log(`파티클 추가됨! 총 ${gpuParticleSystem.numParticles}개`);
        
        // 바인딩 그룹 업데이트 - 동기화 개선
        if (gpuParticleBindGroup) {
          setupGPUParticleRendering().then(createBindGroups => {
            const bindGroups = createBindGroups();
            if (bindGroups) {
              gpuParticleBindGroup = bindGroups;
              console.log('P키 파티클 바인딩 그룹 업데이트 완료');
            }
          });
        }
      }
    }

    // Update MVP matrix
    const mvpMatrix = computeMVPMatrix();
    webgpu.writeBuffer(mvpBuffer, 0, mvpMatrix);
  });

  // Render loop
  let startTime = performance.now();
  function frame() {
    // Ensure all required resources are available before proceeding.
    if (!wireframeVertexBuffer || !terrainVertexBuffer || !depthTexture) {
      requestAnimationFrame(frame);
      return;
    }

    const now = performance.now();
    const deltaTime = Math.min((now - lastFrameTime) * 0.001, 0.016); // 최대 16ms로 제한
    lastFrameTime = now;

    const encoder = webgpu.createCommandEncoder();

    // GPU 파티클 시뮬레이션 비활성화 - 셰이더에서 시간 기반 물리 사용
    // 물리 시뮬레이션은 사용하지 않고 초기 위치 데이터만 유지

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
        view: depthTexture.createView(),
        depthClearValue: 1.0,
        depthLoadOp: "clear",
        depthStoreOp: "store",
      },
    });

    // Update particle uniforms (MVP, acceleration vector, time) - 기존 단일 파티클용
    const time = (now - startTime) * 0.001; // seconds
    
    // 3차원 가속도 벡터 설정 (x, y, z) - 단위: m/s²
    // 다양한 물리 효과를 위한 가속도 벡터 예시:
    // - 중력만: [0.0, 0.0, -9.8]
    // - 바람 효과: [2.0, 0.0, -9.8]
    // - 회전 효과: [Math.sin(time), Math.cos(time), -9.8]
    // - 진동 효과: [0.0, 5.0 * Math.sin(time * 2), -9.8]
    
    const acceleration = [
      0.0,    // X축 가속도 (좌우)
      0.0,    // Y축 가속도 (앞뒤)
      -9.8    // Z축 가속도 (상하, 중력)
    ];
    
    const mvpMatrix = computeMVPMatrix();
    const uniformArray = new Float32Array(20);
    
    // WebGPU 메모리 정렬에 맞춰 데이터 설정
    uniformArray.set(mvpMatrix, 0);           // 0-15: MVP 매트릭스 (16 floats)
    uniformArray[16] = acceleration[0];       // 16: X축 가속도
    uniformArray[17] = acceleration[1];       // 17: Y축 가속도
    uniformArray[18] = acceleration[2];       // 18: Z축 가속도
    uniformArray[19] = time;                  // 19: 시간
    
    webgpu.writeBuffer(particleUniformBuffer, 0, uniformArray);

    // Render coordinate axes
    const axesBuffers = axesManager.getBuffers();

    pass.setPipeline(pipelines.xAxis);
    pass.setBindGroup(0, bindGroup);
    pass.setVertexBuffer(0, axesBuffers.xAxisVertexBuffer);
    pass.draw(axesBuffers.numAxisVertices, 1, 0, 0);

    pass.setPipeline(pipelines.yAxis);
    pass.setBindGroup(0, bindGroup);
    pass.setVertexBuffer(0, axesBuffers.yAxisVertexBuffer);
    pass.draw(axesBuffers.numAxisVertices, 1, 0, 0);

    pass.setPipeline(pipelines.zAxis);
    pass.setBindGroup(0, bindGroup);
    pass.setVertexBuffer(0, axesBuffers.zAxisVertexBuffer);
    pass.draw(axesBuffers.numAxisVertices, 1, 0, 0);

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

    // Render particle (기존 단일 파티클)
    if (particleVertexBuffer && numParticleVertices > 0) {
      pass.setPipeline(pipelines.particle);
      pass.setBindGroup(0, particleBindGroup);
      pass.setVertexBuffer(0, particleVertexBuffer);
      pass.draw(numParticleVertices, 1, 0, 0);
    }

    // Render GPU particles (인스턴싱) - 다른 객체들 이후에 렌더링
    if (gpuParticleRenderPipeline && gpuParticleBindGroup && particleCubeVertexBuffer && 
        gpuParticleSystem && gpuParticleSystem.numParticles > 0) {
      
      // 디버깅: 렌더링 전 파티클 상태 확인 (한 번만 출력)
      if (time < 1.0 && Math.floor(time * 4) % 4 === 0) { // 0.25초마다 한번씩 출력
        console.log('GPU 파티클 렌더링 중:', {
          numParticles: gpuParticleSystem.numParticles,
          vertexCount: particleCubeVertexCount
        });
      }
      
      pass.setPipeline(gpuParticleRenderPipeline);
      pass.setBindGroup(0, gpuParticleBindGroup.bindGroup0);
      pass.setBindGroup(1, gpuParticleBindGroup.bindGroup1);
      pass.setVertexBuffer(0, particleCubeVertexBuffer);
      pass.draw(particleCubeVertexCount, gpuParticleSystem.numParticles, 0, 0);
      
      // 렌더링 완료 메시지 (한 번만 출력)
      if (time < 0.5) {
        console.log('GPU 파티클 렌더링 완료');
      }
    } else {
      // 디버깅: 렌더링 조건 확인 (한 번만 출력)
      if (time < 1.0) { // 처음 1초 동안만 로그 출력
        console.log('GPU 파티클 렌더링 조건 미충족:', {
          pipeline: !!gpuParticleRenderPipeline,
          bindGroup: !!gpuParticleBindGroup,
          particleSystem: !!gpuParticleSystem,
          numParticles: gpuParticleSystem?.numParticles || 0
        });
      }
    }

    pass.end();
    webgpu.submitCommands([encoder.finish()]);
    requestAnimationFrame(frame);
  }

  // Initialize coordinate axes
  axesManager.initialize(webgpu);

  // Load default mod1 file automatically
  await loadDefaultMod1();

  // Set initial MVP matrix
  const initialMvpMatrix = computeMVPMatrix();
  webgpu.writeBuffer(mvpBuffer, 0, initialMvpMatrix);

  // Start render loop
  requestAnimationFrame(frame);

  // Return cleanup function
  return () => {
    // Remove event listeners
    window.removeEventListener("resize", updateCanvasSize);
    window.removeEventListener("orientationchange", updateCanvasSize);

    if (resizeObserver) {
      resizeObserver.disconnect();
    }
    if (depthTexture) {
      depthTexture.destroy();
    }
  };
}
