// particlePhysics.wgsl - GPU 기반 파티클 물리 시뮬레이션

// 파티클 데이터 구조체 - WebGPU 메모리 정렬 규칙 준수
struct Particle {
    position: vec3<f32>,    // 0-11 바이트
    radius: f32,            // 12-15 바이트
    velocity: vec3<f32>,    // 16-27 바이트
    mass: f32,              // 28-31 바이트
    force: vec3<f32>,       // 32-43 바이트
    id: u32,                // 44-47 바이트
    // 총 48바이트 (16바이트 정렬을 위해 명시적 패딩 제거)
};

// 시뮬레이션 파라미터
struct SimParams {
    numParticles: u32,      // 파티클 개수
    deltaTime: f32,         // 시간 간격
    acceleration: vec3<f32>, // 가속도 벡터 (중력 포함)
    restitution: f32,       // 반발계수
    friction: f32,          // 마찰계수
    gridSize: u32,          // 공간 해싱 그리드 크기
    cellSize: f32,          // 셀 크기
    worldBounds: vec3<f32>, // 월드 경계
    // 총 52바이트 (16바이트 정렬로 64바이트)
};

// 공간 해싱 그리드 셀 - WebGPU 메모리 정렬 규칙 준수
struct GridCell {
    particleCount: atomic<u32>,      // 0-3 바이트
    padding: u32,                    // 4-7 바이트 (정렬용)
    particleIndices: array<u32, 32>, // 8-135 바이트 (32 * 4)
    // 총 136바이트 (4바이트 정렬)
};

// 바인딩 그룹 0: 공통 데이터 (모든 컴퓨트 함수에서 사용)
@group(0) @binding(0) var<storage, read_write> particles: array<Particle>;
@group(0) @binding(1) var<uniform> params: SimParams;
@group(0) @binding(2) var<storage, read_write> spatialGrid: array<GridCell>;
@group(0) @binding(3) var<storage, read> terrainHeights: array<f32>;
@group(0) @binding(4) var<uniform> terrainParams: vec4<f32>; // gridResolution, bounds

// 해싱 함수 (음수 값을 안전하게 처리)
fn spatialHash(position: vec3<f32>) -> u32 {
    let gridPos = vec3<i32>(floor(position / params.cellSize));
    
    // 음수 값도 고유한 해시 값을 가지도록 처리
    let offset = 1000000;
    let x = u32((gridPos.x + offset) % 1000);
    let y = u32((gridPos.y + offset) % 1000);
    let z = u32((gridPos.z + offset) % 1000);
    
    // 더 나은 해싱 함수 사용
    let hash = (x * 73856093u + y * 19349663u + z * 83492791u);
    return hash % (params.gridSize * params.gridSize * params.gridSize);
}

// 지형 높이 가져오기
fn getTerrainHeight(pos: vec2<f32>) -> f32 {
    let gridRes = u32(terrainParams.x);
    let bounds = terrainParams.yz;
    
    // 경계 확인
    if (pos.x < bounds.x || pos.x > bounds.y || pos.y < bounds.x || pos.y > bounds.y) {
        return -1.0;
    }
    
    // 그리드 좌표 계산
    let normalizedPos = (pos - bounds.x) / (bounds.y - bounds.x);
    let gridPos = normalizedPos * f32(gridRes - 1);
    
    let i = u32(floor(gridPos.x));
    let j = u32(floor(gridPos.y));
    
    // 바이리니어 보간
    let fx = gridPos.x - f32(i);
    let fy = gridPos.y - f32(j);
    
    let i1 = min(i + 1, gridRes - 1);
    let j1 = min(j + 1, gridRes - 1);
    
    let h00 = terrainHeights[j * gridRes + i];
    let h10 = terrainHeights[j * gridRes + i1];
    let h01 = terrainHeights[j1 * gridRes + i];
    let h11 = terrainHeights[j1 * gridRes + i1];
    
    let h0 = mix(h00, h10, fx);
    let h1 = mix(h01, h11, fx);
    
    return mix(h0, h1, fy);
}

// 1단계: 공간 해싱 그리드 초기화
@compute @workgroup_size(32)
fn clearGrid(@builtin(global_invocation_id) gid: vec3<u32>) {
    let cellIndex = gid.x;
    let totalCells = params.gridSize * params.gridSize * params.gridSize;
    if (cellIndex >= totalCells) {
        return;
    }
    
    // 원자적 카운터 초기화
    atomicStore(&spatialGrid[cellIndex].particleCount, 0u);
    
    // 패딩 초기화 (필요한 경우)
    spatialGrid[cellIndex].padding = 0u;
    
    // 파티클 인덱스 배열 초기화
    for (var i = 0u; i < 32u; i++) {
        spatialGrid[cellIndex].particleIndices[i] = 0u;
    }
}

// 2단계: 파티클을 그리드에 배치
@compute @workgroup_size(32)
fn assignParticlesToGrid(@builtin(global_invocation_id) gid: vec3<u32>) {
    let particleIndex = gid.x;
    if (particleIndex >= params.numParticles) {
        return;
    }
    
    let particle = particles[particleIndex];
    let cellIndex = spatialHash(particle.position);
    
    // 원자적 연산으로 파티클 추가
    let insertIndex = atomicAdd(&spatialGrid[cellIndex].particleCount, 1u);
    
    // 셀이 꽉 찬 경우 무시 (오버플로우 방지)
    if (insertIndex < 32u) {
        spatialGrid[cellIndex].particleIndices[insertIndex] = particleIndex;
    }
}

// 3단계: 물리 업데이트 (중력, 속도, 위치)
@compute @workgroup_size(32)
fn updatePhysics(@builtin(global_invocation_id) gid: vec3<u32>) {
    let particleIndex = gid.x;
    if (particleIndex >= params.numParticles) {
        return;
    }
    var particle = particles[particleIndex];
    
    // 1. 중력 적용 (질량에 따른 중력 가속도)
    let gravity = params.acceleration * particle.mass;
    particle.force += gravity;
    
    // 2. 공기 저항 적용 (속도에 비례)
    let airResistance = 0.02; // 공기 저항 계수
    let dragForce = -particle.velocity * airResistance * particle.mass;
    particle.force += dragForce;
    
    // 3. 지형과의 충돌 체크
    let terrainHeight = getTerrainHeight(particle.position.xy);
    if (terrainHeight > -0.99 && particle.position.z <= terrainHeight + particle.radius) {
        // 지형 위에 있을 때
        particle.position.z = terrainHeight + particle.radius;
        
        // 수직 속도 제거 (지형과의 충돌)
        if (particle.velocity.z < 0.0) {
            particle.velocity.z = -particle.velocity.z * params.restitution;
        }
        
        // 지형에서의 마찰
        let terrainFriction = 0.9;
        particle.velocity.x *= terrainFriction;
        particle.velocity.y *= terrainFriction;
        
        // 지형에서의 정지 마찰 (속도가 매우 작을 때)
        if (length(particle.velocity.xy) < 0.1) {
            particle.velocity.x *= 0.95;
            particle.velocity.y *= 0.95;
        }
    }
    
    // 4. 뉴턴의 운동 법칙 적용: F = ma, a = F/m
    let acceleration = particle.force / particle.mass;
    
    // 5. 속도 업데이트 (Verlet integration 방식)
    particle.velocity += acceleration * params.deltaTime;
    
    // 6. 위치 업데이트
    particle.position += particle.velocity * params.deltaTime;
    
    // 7. 속도 감쇠 (에너지 손실)
    let velocityDamping = 0.999;
    particle.velocity *= velocityDamping;
    
    // 8. 힘 초기화 (다음 프레임을 위해)
    particle.force = vec3<f32>(0.0, 0.0, 0.0);
    
    particles[particleIndex] = particle;
}

// 4단계: 월드 경계 충돌 감지 및 응답
@compute @workgroup_size(32)
fn detectCollisions(@builtin(global_invocation_id) gid: vec3<u32>) {
    let particleIndex = gid.x;
    if (particleIndex >= params.numParticles) {
        return;
    }
    
    var particle = particles[particleIndex];

    // 월드 경계 체크 및 충돌 처리
    var collisionOccurred = false;
    
    // X축 경계 체크
    if (particle.position.x < -params.worldBounds.x) {
        particle.position.x = -params.worldBounds.x;
        particle.velocity.x = -particle.velocity.x * params.restitution;
        collisionOccurred = true;
    } else if (particle.position.x > params.worldBounds.x) {
        particle.position.x = params.worldBounds.x;
        particle.velocity.x = -particle.velocity.x * params.restitution;
        collisionOccurred = true;
    }
    
    // Y축 경계 체크
    if (particle.position.y < -params.worldBounds.y) {
        particle.position.y = -params.worldBounds.y;
        particle.velocity.y = -particle.velocity.y * params.restitution;
        collisionOccurred = true;
    } else if (particle.position.y > params.worldBounds.y) {
        particle.position.y = params.worldBounds.y;
        particle.velocity.y = -particle.velocity.y * params.restitution;
        collisionOccurred = true;
    }
    
    // Z축 경계 체크 (바닥과 천장)
    if (particle.position.z < -params.worldBounds.z) {
        particle.position.z = -params.worldBounds.z;
        particle.velocity.z = -particle.velocity.z * params.restitution;
        // 바닥 충돌 시 마찰 효과 적용
        particle.velocity.x *= params.friction;
        particle.velocity.y *= params.friction;
        collisionOccurred = true;
    } else if (particle.position.z > params.worldBounds.z) {
        particle.position.z = params.worldBounds.z;
        particle.velocity.z = -particle.velocity.z * params.restitution;
        collisionOccurred = true;
    }
    
    // 충돌 후 속도가 매우 작을 때 정지 처리
    if (collisionOccurred) {
        let minVelocity = 0.01;
        if (length(particle.velocity) < minVelocity) {
            particle.velocity *= 0.5;
        }
    }
    
    particles[particleIndex] = particle;
} 