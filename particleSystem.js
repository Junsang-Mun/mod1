// GPU 기반 파티클 시스템 관리자
export class GPUParticleSystem {
  constructor(device, maxParticles = 1000) {
    this.device = device;
    this.maxParticles = maxParticles;
    this.numParticles = 0;
    this.gridSize = 32; // 32x32x32 그리드
    
    console.log('GPU 파티클 시스템 초기화 중...');
    this.setupBuffers();
    this.setupBindGroups();
    this.setupComputePipelines();
    console.log('GPU 파티클 시스템 초기화 완료!');
  }
  
  setupBuffers() {
    // 파티클 데이터 버퍼 (48바이트 * 최대 파티클 수)
    const particleBufferSize = 48 * this.maxParticles;
    
    this.particleBuffer = this.device.createBuffer({
      size: particleBufferSize,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC
    });
    
    // 시뮬레이션 파라미터 버퍼 (64바이트)
    this.paramsBuffer = this.device.createBuffer({
      size: 64,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    });
    
    // 공간 해싱 그리드 버퍼
    // 각 셀: 4바이트(atomic count) + 4바이트(padding) + 32 * 4바이트(indices) = 136바이트
    const cellSize = 136; // 실제 GridCell 구조체 크기
    const gridBufferSize = this.gridSize * this.gridSize * this.gridSize * cellSize;
    
    this.spatialGridBuffer = this.device.createBuffer({
      size: gridBufferSize,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
    });
    
    // 지형 높이 데이터 버퍼 (50x50 그리드)
    this.terrainHeightBuffer = this.device.createBuffer({
      size: 50 * 50 * 4,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
    });
    
    // 지형 파라미터 버퍼
    this.terrainParamsBuffer = this.device.createBuffer({
      size: 16,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    });
  }
  
  setupBindGroups() {
    // 바인딩 그룹 레이아웃 생성 - 모든 리소스를 하나의 그룹에 통합
    this.bindGroupLayout = this.device.createBindGroupLayout({
      entries: [
        { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } }, // particles
        { binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'uniform' } }, // params
        { binding: 2, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } }, // spatialGrid
        { binding: 3, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'read-only-storage' } }, // terrainHeights
        { binding: 4, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'uniform' } }  // terrainParams
      ]
    });
    
    // 바인딩 그룹 생성
    this.bindGroup = this.device.createBindGroup({
      layout: this.bindGroupLayout,
      entries: [
        { binding: 0, resource: { buffer: this.particleBuffer } },
        { binding: 1, resource: { buffer: this.paramsBuffer } },
        { binding: 2, resource: { buffer: this.spatialGridBuffer } },
        { binding: 3, resource: { buffer: this.terrainHeightBuffer } },
        { binding: 4, resource: { buffer: this.terrainParamsBuffer } }
      ]
    });
  }
  
  async setupComputePipelines() {
    try {
      // 컴퓨트 셰이더 모듈 생성
      const shaderSource = await fetch('./particlePhysics.wgsl').then(r => r.text());
      console.log('셰이더 소스 로드됨:', shaderSource.length, '바이트');
      
      const shaderModule = this.device.createShaderModule({ 
        code: shaderSource,
        label: 'ParticlePhysicsShader'
      });
      
      // 파이프라인 레이아웃
      const pipelineLayout = this.device.createPipelineLayout({
        bindGroupLayouts: [this.bindGroupLayout],
        label: 'ParticlePhysicsPipelineLayout'
      });
      
      // 컴퓨트 파이프라인들 생성
      console.log('clearGrid 파이프라인 생성 중...');
      this.clearGridPipeline = this.device.createComputePipeline({
        layout: pipelineLayout,
        compute: { module: shaderModule, entryPoint: 'clearGrid' },
        label: 'ClearGridPipeline'
      });
      
      console.log('assignParticlesToGrid 파이프라인 생성 중...');
      this.assignParticlesPipeline = this.device.createComputePipeline({
        layout: pipelineLayout,
        compute: { module: shaderModule, entryPoint: 'assignParticlesToGrid' },
        label: 'AssignParticlesPipeline'
      });
      
      console.log('updatePhysics 파이프라인 생성 중...');
      this.updatePhysicsPipeline = this.device.createComputePipeline({
        layout: pipelineLayout,
        compute: { module: shaderModule, entryPoint: 'updatePhysics' },
        label: 'UpdatePhysicsPipeline'
      });
      
      console.log('detectCollisions 파이프라인 생성 중...');
      this.detectCollisionsPipeline = this.device.createComputePipeline({
        layout: pipelineLayout,
        compute: { module: shaderModule, entryPoint: 'detectCollisions' },
        label: 'DetectCollisionsPipeline'
      });
      
      console.log('모든 컴퓨트 파이프라인 생성 완료');
      
    } catch (error) {
      console.error('컴퓨트 파이프라인 생성 실패:', error);
      // 에러를 throw하지 않고 계속 진행하도록 함
      console.warn('컴퓨트 파이프라인 없이 계속 진행합니다.');
    }
  }
  
  // 파티클 추가
  addParticle(position, velocity = [0, 0, 0], radius = 0.05, mass = 1.0) {
    if (this.numParticles >= this.maxParticles) {
      console.warn('최대 파티클 수에 도달했습니다.');
      return;
    }
    
    // 파티클 데이터 생성 (48바이트)
    const buffer = new ArrayBuffer(48);
    const floatView = new Float32Array(buffer);
    const uint32View = new Uint32Array(buffer);
    
    // position (3 floats) - 0-11 바이트
    floatView[0] = position[0];
    floatView[1] = position[1];
    floatView[2] = position[2];
    
    // radius (1 float) - 12-15 바이트
    floatView[3] = radius;
    
    // velocity (3 floats) - 16-27 바이트
    floatView[4] = velocity[0];
    floatView[5] = velocity[1];
    floatView[6] = velocity[2];
    
    // mass (1 float) - 28-31 바이트
    floatView[7] = mass;
    
    // force (3 floats) - 32-43 바이트 - 초기값 0
    floatView[8] = 0.0;
    floatView[9] = 0.0;
    floatView[10] = 0.0;
    
    // 현재 파티클 인덱스 저장
    const currentIndex = this.numParticles;
    const bufferOffset = currentIndex * 48;
    
    // id (1 uint32) - 44-47 바이트 (올바른 인덱스 사용)
    uint32View[11] = currentIndex;
    
    // 버퍼에 데이터 쓰기
    this.device.queue.writeBuffer(
      this.particleBuffer,
      bufferOffset,
      buffer
    );
    
    // 파티클 수 증가
    this.numParticles++;
    
    // 디버깅 정보 출력 (간단하게)
    console.log(`파티클 ${currentIndex} 추가: 위치(${position[0].toFixed(2)}, ${position[1].toFixed(2)}, ${position[2].toFixed(2)}) 총 ${this.numParticles}개`);
  }
  
  // 시뮬레이션 파라미터 업데이트
  updateParams(deltaTime, acceleration = [0, 0, -9.8]) {
    // 64바이트 정렬된 버퍼 생성
    const buffer = new ArrayBuffer(64);
    const floatView = new Float32Array(buffer);
    const uintView = new Uint32Array(buffer);
    
    // u32와 f32를 정확한 위치에 배치
    uintView[0] = this.numParticles;     // numParticles: u32 (0-3 바이트)
    floatView[1] = deltaTime;            // deltaTime: f32 (4-7 바이트)
    floatView[2] = acceleration[0];      // acceleration.x: f32 (8-11 바이트)
    floatView[3] = acceleration[1];      // acceleration.y: f32 (12-15 바이트)
    floatView[4] = acceleration[2];      // acceleration.z: f32 (16-19 바이트)
    floatView[5] = 0.6;                  // restitution: f32 (20-23 바이트) - 반발 계수 증가
    floatView[6] = 0.8;                  // friction: f32 (24-27 바이트) - 마찰 감소
    uintView[7] = this.gridSize;         // gridSize: u32 (28-31 바이트)
    floatView[8] = 0.2;                  // cellSize: f32 (32-35 바이트)
    floatView[9] = 1.0;                  // worldBounds.x: f32 (36-39 바이트)
    floatView[10] = 1.0;                 // worldBounds.y: f32 (40-43 바이트)
    floatView[11] = 2.0;                 // worldBounds.z: f32 (44-47 바이트)
    
    this.device.queue.writeBuffer(this.paramsBuffer, 0, buffer);
  }
  
  // 지형 데이터 업데이트
  updateTerrain(heightData, gridResolution = 50) {
    // 지형 높이 데이터 업데이트
    const heightArray = new Float32Array(heightData);
    this.device.queue.writeBuffer(this.terrainHeightBuffer, 0, heightArray.buffer);
    
    // 지형 파라미터 업데이트
    const terrainParams = new Float32Array([
      gridResolution, // gridResolution
      -1.0,           // bounds.min
      1.0,            // bounds.max
      0.0             // unused
    ]);
    this.device.queue.writeBuffer(this.terrainParamsBuffer, 0, terrainParams.buffer);
  }
  
  // 시뮬레이션 실행
  simulate(commandEncoder) {
    if (this.numParticles === 0) return;
    
    // 컴퓨트 파이프라인이 초기화되지 않은 경우 건너뛰기
    if (!this.clearGridPipeline || !this.assignParticlesPipeline || 
        !this.updatePhysicsPipeline || !this.detectCollisionsPipeline) {
      console.warn('컴퓨트 파이프라인이 초기화되지 않았습니다. 물리 시뮬레이션을 건너뜁니다.');
      return;
    }
    
    const computePass = commandEncoder.beginComputePass({
      label: 'ParticlePhysicsComputePass'
    });
    
    // 1단계: 그리드 초기화
    computePass.setPipeline(this.clearGridPipeline);
    computePass.setBindGroup(0, this.bindGroup);
    const gridWorkgroups = Math.ceil(this.gridSize * this.gridSize * this.gridSize / 32);
    computePass.dispatchWorkgroups(gridWorkgroups);
    
    // 2단계: 파티클을 그리드에 배치
    computePass.setPipeline(this.assignParticlesPipeline);
    computePass.setBindGroup(0, this.bindGroup);
    const particleWorkgroups = Math.ceil(this.numParticles / 32);
    computePass.dispatchWorkgroups(particleWorkgroups);
    
    // 3단계: 물리 업데이트
    computePass.setPipeline(this.updatePhysicsPipeline);
    computePass.setBindGroup(0, this.bindGroup);
    computePass.dispatchWorkgroups(particleWorkgroups);
    
    // 4단계: 충돌 감지 및 응답
    computePass.setPipeline(this.detectCollisionsPipeline);
    computePass.setBindGroup(0, this.bindGroup);
    computePass.dispatchWorkgroups(particleWorkgroups);
    
    computePass.end();
    
    // 디버깅: 물리 시뮬레이션 실행 정보 (가끔 출력)
    if (Math.random() < 0.01) { // 1% 확률로 출력
      console.log('물리 시뮬레이션 단계 완료:', {
        particles: this.numParticles,
        gridWorkgroups: gridWorkgroups,
        particleWorkgroups: particleWorkgroups,
        gridSize: this.gridSize
      });
    }
  }
  
  // 파티클 데이터 읽기 (렌더링용)
  async readParticleData() {
    if (this.numParticles === 0) return [];
    
    const stagingBuffer = this.device.createBuffer({
      size: this.numParticles * 48,
      usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST
    });
    
    const commandEncoder = this.device.createCommandEncoder();
    commandEncoder.copyBufferToBuffer(
      this.particleBuffer, 0,
      stagingBuffer, 0,
      this.numParticles * 48
    );
    
    this.device.queue.submit([commandEncoder.finish()]);
    
    await stagingBuffer.mapAsync(GPUMapMode.READ);
    const buffer = stagingBuffer.getMappedRange();
    
    const particles = [];
    for (let i = 0; i < this.numParticles; i++) {
      const byteOffset = i * 48;
      const floatView = new Float32Array(buffer, byteOffset, 11); // 11 floats
      const uint32View = new Uint32Array(buffer, byteOffset + 44, 1); // 1 uint32 at offset 44
      
      particles.push({
        position: [floatView[0], floatView[1], floatView[2]],
        radius: floatView[3],
        velocity: [floatView[4], floatView[5], floatView[6]],
        mass: floatView[7],
        force: [floatView[8], floatView[9], floatView[10]],
        id: uint32View[0]
      });
    }
    
    stagingBuffer.unmap();
    stagingBuffer.destroy();
    
    return particles;
  }
  
  // 파티클 데이터를 동기적으로 가져오기 (렌더링용)
  getParticleVertices() {
    // 이 메서드는 GPU에서 CPU로 데이터를 복사하는 비동기 작업을 피하기 위해
    // 별도의 렌더링 전용 버퍼를 사용할 수 있습니다.
    // 현재는 간단히 빈 배열을 반환합니다.
    return [];
  }
  
  // 리소스 정리
  destroy() {
    this.particleBuffer?.destroy();
    this.paramsBuffer?.destroy();
    this.spatialGridBuffer?.destroy();
    this.terrainHeightBuffer?.destroy();
    this.terrainParamsBuffer?.destroy();
  }
} 