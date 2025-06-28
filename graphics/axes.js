import { GeometryUtils } from "../geometry/geometryUtils.js";

/**
 * Manages coordinate axes rendering buffers and initialization
 */
export class AxesManager {
  constructor() {
    this.xAxisVertexBuffer = null;
    this.yAxisVertexBuffer = null;
    this.zAxisVertexBuffer = null;
    this.numAxisVertices = 2; // Each axis is a line, so 2 vertices
  }

  /**
   * Initialize coordinate axes buffers
   * @param {WebGPUSetup} webgpu - WebGPU setup instance
   */
  initialize(webgpu) {
    const axes = GeometryUtils.generateAxes();

    // Create axis vertex buffers
    this.xAxisVertexBuffer = webgpu.createVertexBuffer(new Float32Array(axes.xAxis));
    this.yAxisVertexBuffer = webgpu.createVertexBuffer(new Float32Array(axes.yAxis));
    this.zAxisVertexBuffer = webgpu.createVertexBuffer(new Float32Array(axes.zAxis));
  }

  /**
   * Get vertex buffers for rendering
   */
  getBuffers() {
    return {
      xAxisVertexBuffer: this.xAxisVertexBuffer,
      yAxisVertexBuffer: this.yAxisVertexBuffer,
      zAxisVertexBuffer: this.zAxisVertexBuffer,
      numAxisVertices: this.numAxisVertices
    };
  }

  /**
   * Clean up resources
   */
  destroy() {
    if (this.xAxisVertexBuffer) {
      this.xAxisVertexBuffer.destroy();
      this.xAxisVertexBuffer = null;
    }
    if (this.yAxisVertexBuffer) {
      this.yAxisVertexBuffer.destroy();
      this.yAxisVertexBuffer = null;
    }
    if (this.zAxisVertexBuffer) {
      this.zAxisVertexBuffer.destroy();
      this.zAxisVertexBuffer = null;
    }
  }
} 