// Geometry generation utilities
export class GeometryUtils {
  
  // Generate cube geometry
  static generateCube(size = 1, center = [0, 0, 0]) {
    const halfSize = size / 2;
    const vertices = [
      [-halfSize, -halfSize, -halfSize],  // 0: 아래 면 왼쪽 뒤
      [halfSize, -halfSize, -halfSize],   // 1: 아래 면 오른쪽 뒤
      [halfSize, halfSize, -halfSize],    // 2: 아래 면 오른쪽 앞
      [-halfSize, halfSize, -halfSize],   // 3: 아래 면 왼쪽 앞
      [-halfSize, -halfSize, halfSize],   // 4: 위 면 왼쪽 뒤
      [halfSize, -halfSize, halfSize],    // 5: 위 면 오른쪽 뒤
      [halfSize, halfSize, halfSize],     // 6: 위 면 오른쪽 앞
      [-halfSize, halfSize, halfSize],    // 7: 위 면 왼쪽 앞
    ];

    // Apply center offset
    const centeredVertices = vertices.map(v => [
      v[0] + center[0],
      v[1] + center[1],
      v[2] + center[2]
    ]);

    return centeredVertices;
  }

  // Generate cube edges for wireframe
  static generateCubeEdges(size = 1, center = [0, 0, 0]) {
    const vertices = this.generateCube(size, center);
    const edges = [
      // 아래 면의 4개 모서리
      [0, 1], [1, 2], [2, 3], [3, 0],
      // 위 면의 4개 모서리  
      [4, 5], [5, 6], [6, 7], [7, 4],
      // 세로 4개 모서리
      [0, 4], [1, 5], [2, 6], [3, 7],
    ];

    const wireframeVertices = [];
    for (const edge of edges) {
      for (const i of edge) {
        wireframeVertices.push(...vertices[i]);
      }
    }

    return wireframeVertices;
  }

  // Generate cube bottom face triangles
  static generateCubeBottomFace(size = 1, center = [0, 0, 0]) {
    const vertices = this.generateCube(size, center);
    const bottomFaceVertices = [];

    // 첫 번째 삼각형: 0, 1, 2
    bottomFaceVertices.push(...vertices[0], ...vertices[1], ...vertices[2]);
    // 두 번째 삼각형: 0, 2, 3
    bottomFaceVertices.push(...vertices[0], ...vertices[2], ...vertices[3]);

    return bottomFaceVertices;
  }

  // Generate terrain mesh from points using interpolation
  static generateTerrain(points, gridResolution = 50, terrainSize = 2) {
    if (!points || points.length === 0) {
      return [];
    }

    // Set bounds to -1 ~ 1 for both x and y
    const minX = -1;
    const maxX = 1;
    const minY = -1;
    const maxY = 1;

    // Generate grid vertices with interpolated heights
    const gridVertices = [];
    const stepX = (maxX - minX) / (gridResolution - 1);
    const stepY = (maxY - minY) / (gridResolution - 1);

    for (let i = 0; i < gridResolution; i++) {
      for (let j = 0; j < gridResolution; j++) {
        const x = minX + i * stepX;
        const y = minY + j * stepY;
        const z = -1;
        gridVertices.push({ x, y, z, i, j });
      }
    }

    this.addHeightToTerrain(gridVertices, points);

    // Generate triangles from grid
    const terrainVertices = [];
    
    for (let i = 0; i < gridResolution - 1; i++) {
      for (let j = 0; j < gridResolution - 1; j++) {
        // Get four corners of current grid cell
        const v1 = gridVertices[i * gridResolution + j];           // bottom-left
        const v2 = gridVertices[(i + 1) * gridResolution + j];     // bottom-right
        const v3 = gridVertices[(i + 1) * gridResolution + (j + 1)]; // top-right
        const v4 = gridVertices[i * gridResolution + (j + 1)];     // top-left

        // First triangle: v1, v2, v3
        terrainVertices.push(v1.x, v1.y, v1.z);
        terrainVertices.push(v2.x, v2.y, v2.z);
        terrainVertices.push(v3.x, v3.y, v3.z);

        // Second triangle: v1, v3, v4
        terrainVertices.push(v1.x, v1.y, v1.z);
        terrainVertices.push(v3.x, v3.y, v3.z);
        terrainVertices.push(v4.x, v4.y, v4.z);
      }
    }

    return terrainVertices;
  }

  static addHeightToTerrain(gridVertices, points) {
    if (!points || points.length === 0) {
      return;
    }

    // RBF 보간을 위한 파라미터
    const sigma = 0.3; // RBF의 스무딩 파라미터
    const sigmaSquared = sigma * sigma;
    const weightCache = new Map(); // Precomputed weights cache

    // 각 격자 점에 대해 RBF 보간 수행
    for (let gridVertex of gridVertices) {
      let numerator = 0;
      let denominator = 0;
      
      // 기존 격자점의 z값을 초기 가중치로 추가
      const originalZ = gridVertex.z;
      const originalWeight = 1.0; // 기존 값의 기본 가중치
      
      numerator += originalWeight * originalZ;
      denominator += originalWeight;

      // 모든 알려진 점들로부터의 영향을 계산
      for (let point of points) {
        // 거리 계산 (2D 거리, x, y만 사용)
        const dx = gridVertex.x - point.x;
        const dy = gridVertex.y - point.y;
        const distanceSquared = (dx * dx + dy * dy);

        // RBF 함수: Gaussian 함수 사용
        // w(r) = exp(-r²/σ²)
        const weight = Math.exp(-(distanceSquared) / (sigma * sigma));

        // 가중 평균 계산
        numerator += weight * point.z;
        denominator += weight;
      }

      // 보간된 높이값 적용
      if (denominator > 0) {
        gridVertex.z = numerator / denominator;
      } else {
        // 모든 가중치가 0인 경우 (매우 드문 경우)
        gridVertex.z = originalZ; // 기존 값 유지
      }
    }
  }

  // Generate coordinate axes
  static generateAxes(length = 1.5) {
    return {
      xAxis: [0.0, 0.0, 0.0, length, 0.0, 0.0],
      yAxis: [0.0, 0.0, 0.0, 0.0, length, 0.0],
      zAxis: [0.0, 0.0, 0.0, 0.0, 0.0, length]
    };
  }

  // Generate cube faces for particle rendering (all 6 faces as triangles)
  static generateCubeFaces(size = 1, center = [0, 0, 0]) {
    const vertices = this.generateCube(size, center);
    const faceVertices = [];

    // Define faces as triangles (2 triangles per face)
    const faces = [
      // Front face (z = +halfSize)
      [4, 5, 6], [4, 6, 7],
      // Back face (z = -halfSize)  
      [1, 0, 3], [1, 3, 2],
      // Top face (y = +halfSize)
      [3, 7, 6], [3, 6, 2],
      // Bottom face (y = -halfSize)
      [0, 1, 5], [0, 5, 4],
      // Right face (x = +halfSize)
      [1, 2, 6], [1, 6, 5],
      // Left face (x = -halfSize)
      [0, 4, 7], [0, 7, 3],
    ];

    // Convert face indices to vertices
    for (const face of faces) {
      for (const vertexIndex of face) {
        faceVertices.push(...vertices[vertexIndex]);
      }
    }

    return faceVertices;
  }

  // Generate single particle cube with faces (optimized for small size)
  static generateParticleCube(size = 0.1, center = [0, 0, 0]) {
    return this.generateCubeFaces(size, center);
  }
} 