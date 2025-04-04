/**
 * @param {GPUDevice} device
 * @param {{ label?: string, code?: string }} options
 * @returns {GPUShaderModule}
 * @description Creates a shader module with the given label and code. If code is not provided, the default code will be used.
 */
function createShaderModule(device, { label = 'default shader', code } = {}) {
  if (!device) {
    throw new Error('Device is required to create shader module')
  }

  const defaultCode = `
    @vertex fn vs(
      @builtin(vertex_index) vertexIndex : u32
    ) -> @builtin(position) vec4f {
      let pos = array(
        vec2f( 0.0,  0.5),  // top center
        vec2f(-0.5, -0.5),  // bottom left
        vec2f( 0.5, -0.5)   // bottom right
      );

      return vec4f(pos[vertexIndex], 0.0, 1.0);
    }

    @fragment fn fs() -> @location(0) vec4f {
      return vec4f(1.0, 0.0, 0.0, 1.0);
    }
  `

  return device.createShaderModule({
    label,
    code: code || defaultCode
  })
}

export { createShaderModule }
