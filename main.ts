import { loadMod1ToJson } from "./utils/mod1Parser.js";
import { MatrixUtils } from "./utils/matrixUtils.js";
import { Camera } from "./graphics/camera.js";
import { WebGPUSetup } from "./graphics/webgpu.js";
import { PipelineFactory } from "./graphics/pipelines.js";
import { GeometryUtils } from "./geometry/geometryUtils.js";
import { AxesManager } from "./graphics/axes.js";
import { GPUParticleSystem } from "./particleSystem.js";
import type { 
  WebGPUContext, 
  Matrix4x4, 
  Vector3, 
  Mod1Point, 
  PipelineSet, 
  GPUParticleBindGroups,
  CanvasSize 
} from "./types/index.js";

// Store resize observer and rendering variables globally
let resizeObserver: ResizeObserver | null = null;
let depthTexture: GPUTexture | null = null;

// GPU 파티클 시스템 전역 변수
let gpuParticleSystem: GPUParticleSystem | null = null;
let lastFrameTime: number = typeof performance !== 'undefined' ? performance.now() : 0;
let terrainHeightData: number[] = [];

  // Check if we're in a browser environment
if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  console.log('Browser environment detected');
  console.log('WebGPU available:', !!navigator.gpu);
  
  window.addEventListener("DOMContentLoaded", () => {
    console.log('DOM loaded, starting initialization...');
    init().catch((err) => console.error("Initialization error:", err));
  });
}

async function init(): Promise<(() => void) | undefined> {
  console.log('Initializing WebGPU application...');
  
  // Check if we're in a browser environment
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    console.warn('Browser environment not available. Skipping initialization.');
    return;
  }

  const canvas = document.getElementById("gpu-canvas") as HTMLCanvasElement;
  const mod1Input = document.getElementById("mod1Input") as HTMLInputElement;

  if (!canvas) {
    console.error('Canvas element not found');
    return;
  }
  
  console.log('Canvas found:', canvas);

  // Add resize handler to window and orientation change for mobile devices
  window.addEventListener("resize", updateCanvasSize);
  window.addEventListener("orientationchange", updateCanvasSize);

  // Initialize WebGPU
  console.log('Initializing WebGPU...');
  const webgpu = new WebGPUSetup();
  const { device, context, format } = await webgpu.initialize(canvas);
  console.log('WebGPU initialized:', { device: !!device, context: !!context, format });

  // Set canvas size to actual size in device pixels
  function updateCanvasSize(): void {
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
          size: [canvas.width, canvas.height, 1],
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
  function initializeCanvasSize(): void {
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
      size: [canvas.width, canvas.height, 1],
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
      buffer: { type: 'uniform' },
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

  // Create rendering pipelines
  const pipelineFactory = new PipelineFactory(device, format);
  const pipelines = pipelineFactory.createAllPipelines(
    shaderModule,
    bindGroupLayout,
  );

  // GPU 파티클 렌더링을 위한 별도 파이프라인 설정
  let gpuParticleRenderPipeline: GPURenderPipeline | null = null;
  let gpuParticleBindGroup: GPUParticleBindGroups | null = null;
  let particleSphereVertexBuffer: GPUBuffer | null = null;
  let particleSphereVertexCount = 0;

  // Initialize camera
  const camera = new Camera();

  // Initialize axes manager
  const axesManager = new AxesManager();

  // Initialize GPU particle system
  gpuParticleSystem = new GPUParticleSystem(device, 1000);

  // Create model matrix
  function createModelMatrix(): Matrix4x4 {
    return MatrixUtils.identity();
  }

  // Compute MVP matrix
  function computeMVPMatrix(): Matrix4x4 {
    const modelMatrix = createModelMatrix();
    const viewMatrix = camera.createViewMatrix();
    const projectionMatrix = camera.createProjectionMatrix(canvas);
    
    return MatrixUtils.multiply(
      MatrixUtils.multiply(projectionMatrix, viewMatrix),
      modelMatrix
    );
  }

  // Global variables for vertex buffers
  let terrainVertexBuffer: GPUBuffer | null = null;
  let wireframeVertexBuffer: GPUBuffer | null = null;
  let numTerrainVertices = 0;
  let numWireframeVertices = 0;

  // Load mod1 file
  async function loadMod1File(text: string, fileName: string): Promise<void> {
    try {
      const mod1Data = loadMod1ToJson(text, fileName);
      console.log('Mod1 데이터 로드됨:', mod1Data);

      // Generate terrain from points
      const terrainVertices = GeometryUtils.generateTerrain(mod1Data.points);
      
      // Create terrain vertex buffer
      terrainVertexBuffer = webgpu.createVertexBuffer(new Float32Array(terrainVertices));
      numTerrainVertices = terrainVertices.length / 3;

      // Generate wireframe from points
      const wireframeVertices = GeometryUtils.generateCubeEdges(2.0, [0, 0, 0]);
      wireframeVertexBuffer = webgpu.createVertexBuffer(new Float32Array(wireframeVertices));
      numWireframeVertices = wireframeVertices.length / 3;

      // Update terrain height data for particle physics
      terrainHeightData = generateTerrainHeightData(mod1Data.points);
      if (gpuParticleSystem) {
        gpuParticleSystem.updateTerrain(terrainHeightData);
      }

      console.log('지형 생성 완료:', {
        terrainVertices: numTerrainVertices,
        wireframeVertices: numWireframeVertices,
        points: mod1Data.points.length
      });

    } catch (error) {
      console.error('Mod1 파일 로드 실패:', error);
    }
  }

  // Generate terrain height data
  function generateTerrainHeightData(points: Mod1Point[]): number[] {
    const gridResolution = 50;
    const heightData: number[] = [];
    
    for (let i = 0; i < gridResolution; i++) {
      for (let j = 0; j < gridResolution; j++) {
        const x = (i / (gridResolution - 1)) * 2 - 1;
        const y = (j / (gridResolution - 1)) * 2 - 1;
        
        // Find closest point and use its height
        let minDistance = Infinity;
        let height = -1;
        
        for (const point of points) {
          const distance = Math.sqrt((x - point.x) ** 2 + (y - point.y) ** 2);
          if (distance < minDistance) {
            minDistance = distance;
            height = point.z;
          }
        }
        
        heightData.push(height);
      }
    }
    
    return heightData;
  }

  // Load default mod1 file
  async function loadDefaultMod1(): Promise<void> {
    try {
      const response = await fetch('./assets/demo1.mod1');
      const text = await response.text();
      await loadMod1File(text, 'demo1.mod1');
    } catch (error) {
      console.error('기본 Mod1 파일 로드 실패:', error);
    }
  }

  // Setup GPU particle rendering
  async function setupGPUParticleRendering(): Promise<void> {
    console.log('GPU 파티클 렌더링 설정 시작...');
    
    // GPU 파티클 렌더링 셰이더 모듈 생성
    const gpuParticleShaderModule = await webgpu.createShaderModule("gpuParticleRender.wgsl");
    console.log('GPU 파티클 셰이더 모듈 생성 완료');
    
    // 바인딩 그룹 레이아웃
    const gpuParticleBindGroupLayout0 = webgpu.createBindGroupLayout([
      {
        binding: 0,
        visibility: GPUShaderStage.VERTEX,
        buffer: { type: 'uniform' },
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
    console.log('GPU 파티클 렌더링 파이프라인 생성 완료');

    // 파티클 구체 지오메트리 생성 (작은 구체)
    const sphereVertices = GeometryUtils.generateSphereFaces(0.05, [0, 0, 0]); // 반지름을 0.05로 줄임
    particleSphereVertexCount = sphereVertices.length / 3;
    
    const sphereData = new Float32Array(sphereVertices);
    particleSphereVertexBuffer = webgpu.createVertexBuffer(sphereData);
    console.log('파티클 구체 지오메트리 생성 완료:', particleSphereVertexCount, '버텍스');

    // 바인딩 그룹 생성 함수
    function createGPUParticleBindGroups(): GPUParticleBindGroups | null {
      if (!gpuParticleSystem) {
        console.warn('GPU 파티클 시스템이 초기화되지 않았습니다.');
        return null;
      }

      console.log('GPU 파티클 바인딩 그룹 생성 중...');
      
      const bindGroup0 = webgpu.createBindGroup(gpuParticleBindGroupLayout0, [
        {
          binding: 0,
          resource: { buffer: particleUniformBuffer },
        },
      ]);
      
      const bindGroup1 = webgpu.createBindGroup(gpuParticleBindGroupLayout1, [
        {
          binding: 0,
          resource: { buffer: gpuParticleSystem.particleBufferForRendering },
        },
      ]);

      console.log('GPU 파티클 바인딩 그룹 생성 완료');
      
      return {
        bindGroup0,
        bindGroup1,
      };
    }

    // 초기 바인딩 그룹 생성
    gpuParticleBindGroup = createGPUParticleBindGroups();
    
    // 초기 파티클 추가 (테스트용)
    if (gpuParticleSystem) {
      console.log('초기 파티클 추가 중...');
      for (let i = 0; i < 5; i++) {
        const x = (Math.random() - 0.5) * 1.5;
        const y = (Math.random() - 0.5) * 1.5;
        const z = Math.random() * 1.5 + 0.5; // 지형 위에 생성
        gpuParticleSystem.addParticle([x, y, z]);
      }
      console.log('초기 파티클 추가 완료. 총 파티클 수:', gpuParticleSystem.particleCount);
    }
    
    console.log('GPU 파티클 렌더링 설정 완료');
  }

  // Camera movement speed
  const CAMERA_MOVE_SPEED = 0.1;
  const CAMERA_ROTATION_SPEED = 2.0;
  const CAMERA_ZOOM_SPEED = 0.1;

  // Add keyboard event listeners for camera and particle controls
  document.addEventListener('keydown', (event: KeyboardEvent) => {
    const moveSpeed = CAMERA_MOVE_SPEED;
    const rotationSpeed = CAMERA_ROTATION_SPEED;
    const zoomSpeed = CAMERA_ZOOM_SPEED;

    switch (event.key.toLowerCase()) {
      // Camera movement
      case 'w':
        // Move forward
        camera.moveRelative(moveSpeed, 0, 0);
        console.log('Camera moved forward');
        break;
      case 's':
        // Move backward
        camera.moveRelative(-moveSpeed, 0, 0);
        console.log('Camera moved backward');
        break;
      case 'a':
        // Move left
        camera.moveRelative(0, -moveSpeed, 0);
        console.log('Camera moved left');
        break;
      case 'd':
        // Move right
        camera.moveRelative(0, moveSpeed, 0);
        console.log('Camera moved right');
        break;
      case 'q':
        // Move up
        camera.moveRelative(0, 0, moveSpeed);
        console.log('Camera moved up');
        break;
      case 'e':
        // Move down
        camera.moveRelative(0, 0, -moveSpeed);
        console.log('Camera moved down');
        break;
      
      // Camera rotation
      case 'arrowleft':
        // Rotate left
        camera.rotation -= rotationSpeed;
        camera.updatePosition();
        break;
      case 'arrowright':
        // Rotate right
        camera.rotation += rotationSpeed;
        camera.updatePosition();
        break;
      
      // Camera zoom
      case '+':
      case '=':
        // Zoom in
        camera.zoom = Math.max(0.1, camera.zoom - zoomSpeed);
        camera.updatePosition();
        break;
      case '-':
        // Zoom out
        camera.zoom = Math.min(10.0, camera.zoom + zoomSpeed);
        camera.updatePosition();
        break;
      
      // Reset camera
      case 'r':
        camera.position = { x: 3, y: 3, z: 3 };
        camera.target = { x: 0, y: 0, z: 0 };
        camera.rotation = 0;
        camera.zoom = 1.0;
        camera.updatePosition();
        break;
      
      // Particle controls
      case 'p':
        // Add particles
        if (gpuParticleSystem) {
          for (let i = 0; i < 10; i++) {
            const x = (Math.random() - 0.5) * 2;
            const y = (Math.random() - 0.5) * 2;
            const z = Math.random() * 2;
            gpuParticleSystem.addParticle([x, y, z]);
          }
          console.log('파티클 추가됨. 총 파티클 수:', gpuParticleSystem.particleCount);
        }
        break;
      case 'c':
        // Clear particles
        if (gpuParticleSystem) {
          gpuParticleSystem = new GPUParticleSystem(device, 1000);
          console.log('파티클 초기화됨');
        }
        break;
    }
  });

  // Add mouse wheel support for zoom
  canvas.addEventListener('wheel', (event: WheelEvent) => {
    event.preventDefault();
    const zoomSpeed = CAMERA_ZOOM_SPEED * 2;
    
    if (event.deltaY > 0) {
      // Zoom out
      camera.zoom = Math.min(10.0, camera.zoom + zoomSpeed);
    } else {
      // Zoom in
      camera.zoom = Math.max(0.1, camera.zoom - zoomSpeed);
    }
    camera.updatePosition();
  });

  // Add debug info display
  const debugInfo = document.createElement('div');
  debugInfo.id = 'debugInfo';
  debugInfo.style.cssText = `
    position: fixed;
    top: 10px;
    right: 10px;
    background: rgba(0, 0, 0, 0.7);
    color: white;
    padding: 10px;
    border-radius: 5px;
    font-family: monospace;
    font-size: 12px;
    z-index: 1000;
  `;
  document.body.appendChild(debugInfo);

  // Update debug info in render loop
  function updateDebugInfo(): void {
    if (debugInfo) {
      debugInfo.innerHTML = `
        Camera Position: (${camera.position.x.toFixed(2)}, ${camera.position.y.toFixed(2)}, ${camera.position.z.toFixed(2)})<br>
        Camera Target: (${camera.target.x.toFixed(2)}, ${camera.target.y.toFixed(2)}, ${camera.target.z.toFixed(2)})<br>
        Camera Zoom: ${camera.zoom.toFixed(2)}<br>
        Camera Rotation: ${camera.rotation.toFixed(1)}°<br>
        Particles: ${gpuParticleSystem?.particleCount || 0}
      `;
    }
  }

  // Update MVP matrix
  const mvpMatrix = computeMVPMatrix();
  webgpu.writeBuffer(mvpBuffer, 0, mvpMatrix);

  // Render loop
  let startTime: number = typeof performance !== 'undefined' ? performance.now() : 0;
  
  function frame(): void {
    // Check if we're in a browser environment
    if (typeof window === 'undefined' || typeof requestAnimationFrame === 'undefined') {
      return;
    }

    // Ensure all required resources are available before proceeding.
    if (!wireframeVertexBuffer || !terrainVertexBuffer || !depthTexture) {
      console.log('Waiting for resources:', {
        wireframeVertexBuffer: !!wireframeVertexBuffer,
        terrainVertexBuffer: !!terrainVertexBuffer,
        depthTexture: !!depthTexture
      });
      requestAnimationFrame(frame);
      return;
    }

    const now: number = typeof performance !== 'undefined' ? performance.now() : 0;
    const deltaTime: number = Math.min((now - lastFrameTime) * 0.001, 0.016); // 최대 16ms로 제한
    lastFrameTime = now;

    // Update MVP matrix every frame for camera changes
    const mvpMatrix = computeMVPMatrix();
    webgpu.writeBuffer(mvpBuffer, 0, mvpMatrix);

    // Update debug info
    updateDebugInfo();

    const encoder = webgpu.createCommandEncoder();

    // GPU 파티클 물리 시뮬레이션 실행
    if (gpuParticleSystem && gpuParticleSystem.particleCount > 0) {
      // 물리 시뮬레이션 파라미터 업데이트
      gpuParticleSystem.updateParams(deltaTime, [0, 0, -9.8]);
      
      // 물리 시뮬레이션 실행
      gpuParticleSystem.simulate(encoder);
    }

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

    // Update particle uniforms (MVP, acceleration vector, time) - GPU 파티클용
    const time = (now - startTime) * 0.001; // seconds
    
    // 3차원 가속도 벡터 설정 (x, y, z) - 단위: m/s²
    const acceleration: Vector3 = [
      0.0,    // X축 가속도 (좌우)
      0.0,    // Y축 가속도 (앞뒤)
      -9.8    // Z축 가속도 (상하, 중력)
    ];
    
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

    // Render GPU particles (인스턴싱) - 다른 객체들 이후에 렌더링
    if (gpuParticleRenderPipeline && gpuParticleBindGroup && particleSphereVertexBuffer && 
      gpuParticleSystem && gpuParticleSystem.particleCount > 0) {
      pass.setPipeline(gpuParticleRenderPipeline);
      pass.setBindGroup(0, gpuParticleBindGroup.bindGroup0);
      pass.setBindGroup(1, gpuParticleBindGroup.bindGroup1);
      pass.setVertexBuffer(0, particleSphereVertexBuffer);
      pass.draw(particleSphereVertexCount, gpuParticleSystem.particleCount, 0, 0);
    } else {
      // 파티클 렌더링이 실패한 경우 디버깅 정보 출력
      if (Math.random() < 0.01) { // 1% 확률로만 출력하여 로그 스팸 방지
        console.log('파티클 렌더링 조건 확인:', {
          pipeline: !!gpuParticleRenderPipeline,
          bindGroup: !!gpuParticleBindGroup,
          vertexBuffer: !!particleSphereVertexBuffer,
          particleSystem: !!gpuParticleSystem,
          particleCount: gpuParticleSystem?.particleCount || 0
        });
      }
    }

    pass.end();
    webgpu.submitCommands([encoder.finish()]);
    if (typeof requestAnimationFrame !== 'undefined') {
      requestAnimationFrame(frame);
    }
  }

  // Initialize coordinate axes
  axesManager.initialize(webgpu);

  // Setup GPU particle rendering
  await setupGPUParticleRendering();

  // Load default mod1 file automatically
  await loadDefaultMod1();

  // Set initial MVP matrix
  const initialMvpMatrix = computeMVPMatrix();
  webgpu.writeBuffer(mvpBuffer, 0, initialMvpMatrix);

  // Start render loop
  if (typeof requestAnimationFrame !== 'undefined') {
    requestAnimationFrame(frame);
  }

  // Return cleanup function
  return () => {
    // Check if we're in a browser environment
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      return;
    }

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