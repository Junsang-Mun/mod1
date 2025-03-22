<script>
  import { onMount } from 'svelte'
  import { createShaderModule } from '$lib/shader-module'

  let canvasElement
  let errorMessage = ''
  let device
  let context
  let pipeline

  async function initWebGPU() {
    const adapter = await navigator.gpu?.requestAdapter()
    device = await adapter?.requestDevice()
    if (!device) {
      errorMessage = 'WebGPU 장치를 찾을 수 없습니다.'
      return
    }
    const canvas = canvasElement
    context = canvas.getContext('webgpu')
    if (!context) {
      errorMessage = 'WebGPU 컨텍스트를 찾을 수 없습니다.'
      return
    }
    const presentationFormat = navigator.gpu.getPreferredCanvasFormat()
    context.configure({
      device,
      format: presentationFormat,
    })

    const shaderModule = createShaderModule(device, {
      label: 'draw red triangle',
    })

    pipeline = device.createRenderPipeline({
      label: 'draw red triangle',
      layout: 'auto',
      vertex: {
        module: shaderModule,
        entryPoint: 'vs',
      },
      fragment: {
        module: shaderModule,
        entryPoint: 'fs',
        targets: [{ format: presentationFormat }],
          },
    })
  }

  function render() {
    const renderPassDescriptor = {
      label: 'canvas render pass',
      colorAttachments: [{
        // clearValue: { r: 0, g: 0, b: 0, a: 1 },
        clearValue: [0, 0, 0, 1],
        loadOp: 'clear',
        storeOp: 'store',
      }],
    }
    renderPassDescriptor.colorAttachments[0].view = context.getCurrentTexture().createView()
    const encoder = device.createCommandEncoder({ label: 'command encoder' })

    const pass = encoder.beginRenderPass(renderPassDescriptor)
    pass.setPipeline(pipeline)
    pass.draw(3)
    pass.end()

    const commandBuffer = encoder.finish()
    device.queue.submit([commandBuffer])
  }

  onMount(async () => {
    await initWebGPU()
    render()
  })
</script>

<div class="container">
  <h1>WebGPU 테스트</h1>
  
  {#if errorMessage}
    <p class="error">{errorMessage}</p>
  {/if}
  
  <canvas
    bind:this={canvasElement}
  />
</div>

<style>
  .container {
    height: 80vh; /* 뷰포트 높이의 80%로 설정 */
    width: 100%;
    justify-content: center;
    align-items: center;
  }

  canvas {
    border: 1px solid #ccc;
    background-color: #000;
    width: 100%;
    height: 100%;
  }

  .error {
    color: red;
    margin: 10px 0;
  }
</style> 