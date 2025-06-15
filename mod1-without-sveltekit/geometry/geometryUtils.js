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

  // Generate point cloud as small cubes
  static generatePointCubes(points, cubeSize = 0.02) {
    const pointVertices = [];
    
    // 정육면체의 8개 정점 (로컬 좌표)
    const cubeVertices = [
      [-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1], // 아래 면
      [-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]      // 위 면
    ];
    
    // 정육면체의 12개 삼각형 (6면 × 2삼각형)
    const cubeTriangles = [
      // 아래 면 (z = -1)
      [0, 1, 2], [0, 2, 3],
      // 위 면 (z = 1)  
      [4, 6, 5], [4, 7, 6],
      // 앞 면 (y = 1)
      [3, 2, 6], [3, 6, 7],
      // 뒤 면 (y = -1)
      [0, 4, 5], [0, 5, 1],
      // 왼쪽 면 (x = -1)
      [0, 3, 7], [0, 7, 4],
      // 오른쪽 면 (x = 1)
      [1, 5, 6], [1, 6, 2]
    ];

    points.forEach(point => {
      // 각 포인트마다 정육면체 생성
      cubeTriangles.forEach(triangle => {
        triangle.forEach(vertexIndex => {
          const localVertex = cubeVertices[vertexIndex];
          pointVertices.push(
            point.x + localVertex[0] * cubeSize,
            point.y + localVertex[1] * cubeSize,
            point.z + localVertex[2] * cubeSize
          );
        });
      });
    });

    return pointVertices;
  }

  // Generate coordinate axes
  static generateAxes(length = 1.5) {
    return {
      xAxis: [0.0, 0.0, 0.0, length, 0.0, 0.0],
      yAxis: [0.0, 0.0, 0.0, 0.0, length, 0.0],
      zAxis: [0.0, 0.0, 0.0, 0.0, 0.0, length]
    };
  }
} 