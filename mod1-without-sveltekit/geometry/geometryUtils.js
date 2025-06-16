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
        const z = this.interpolateHeight(x, y, points);
        
        gridVertices.push({ x, y, z, i, j });
      }
    }

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

  // Interpolate height at given x,y position using enhanced inverse distance weighting
  static interpolateHeight(x, y, points, maxDistance = 1.0) {
    let totalWeight = 0;
    let weightedSum = 0;
    let minDistance = Infinity;
    let closestPointZ = -1;
    
    // Calculate weights and find closest point
    const weights = [];
    points.forEach(point => {
      const dx = x - point.x;
      const dy = y - point.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      // Track closest point
      if (distance < minDistance) {
        minDistance = distance;
        closestPointZ = point.z;
      }
      
      // Enhanced inverse distance weighting with adaptive power
      let weight;
      if (distance < 0.001) {
        // Very close to a point, return that point's height
        return point.z;
      } else if (distance < 0.1) {
        // Close points have very high influence
        weight = 1 / Math.pow(distance, 3);
      } else if (distance < 0.5) {
        // Medium distance points
        weight = 1 / Math.pow(distance, 2);
      } else {
        // Far points have reduced influence
        weight = 1 / Math.pow(distance, 1.5);
      }
      
      weights.push({ weight, z: point.z, distance });
      totalWeight += weight;
      weightedSum += point.z * weight;
    });
    
    // If we're very close to any point, return that point's height
    if (minDistance < 0.01) {
      return closestPointZ;
    }
    
    // Calculate base interpolated height
    let interpolatedHeight = -1; // Default boundary value
    if (totalWeight > 0) {
      interpolatedHeight = weightedSum / totalWeight;
    }
    
    // Apply boundary blending - interpolate to -1 near edges
    const centerDistance = Math.sqrt(x * x + y * y);
    const boundaryDistance = Math.sqrt(2); // Distance to corner
    const fadeStart = 0.6; // Start fading earlier
    
    if (centerDistance > fadeStart) {
      const fadeFactor = Math.min(1, (centerDistance - fadeStart) / (boundaryDistance - fadeStart));
      // Linear interpolation between interpolated height and -1 (boundary value)
      interpolatedHeight = interpolatedHeight * (1 - fadeFactor) + (-1) * fadeFactor;
    }
    
    return interpolatedHeight;
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