<script>
  import { onMount, onDestroy } from 'svelte'
  import { SPHController } from '../../lib/webgpu/sph/SPHController'
  import GUI from 'lil-gui'
  
  let canvas
  let controller
  let isInitialized = false
  let errorMessage = ''
  let gui
  let isMouseDown = false
  
  // Simulation parameters
  const params = {
    particleCount: 1000,
    gravity: 9.8,
    viscosity: 1.0,
    density: 1.0,
    timeScale: 1.0,
    particleRadius: 0.01,
    interactionStrength: 0.5,
    paused: false,
    reset: () => resetSimulation()
  }
  
  onMount(async () => {
    if (!canvas) return
    
    controller = new SPHController()
    try {
      await controller.initialize(canvas, {
        particleCount: params.particleCount,
        gravity: params.gravity,
        viscosity: params.viscosity,
        density: params.density,
        timeScale: params.timeScale,
        particleRadius: params.particleRadius
      })
      isInitialized = true
      
      // GUI 설정
      setupGUI()
    } catch (error) {
      errorMessage = error.message
      console.error(error)
    }
  })
  
  onDestroy(() => {
    if (controller) {
      controller.cleanup()
    }
    
    if (gui) {
      gui.destroy()
    }
  })
  
  function setupGUI() {
    gui = new GUI({ title: 'SPH 시뮬레이션 설정', width: 300 })
    
    const particleFolder = gui.addFolder('입자 설정')
    particleFolder.add(params, 'particleCount', 100, 5000, 100).name('입자 수').onChange(value => {
      resetSimulation()
    })
    particleFolder.add(params, 'particleRadius', 0.005, 0.05, 0.001).name('입자 크기').onChange(value => {
      handleParamChange()
    })
    particleFolder.open()
    
    const physicsFolder = gui.addFolder('물리 설정')
    physicsFolder.add(params, 'gravity', 0, 20, 0.1).name('중력').onChange(value => {
      handleParamChange()
    })
    physicsFolder.add(params, 'viscosity', 0.1, 5, 0.1).name('점성').onChange(value => {
      handleParamChange()
    })
    physicsFolder.add(params, 'density', 0.1, 5, 0.1).name('밀도').onChange(value => {
      handleParamChange()
    })
    physicsFolder.add(params, 'timeScale', 0.1, 2, 0.1).name('시간 배율').onChange(value => {
      handleParamChange()
    })
    physicsFolder.add(params, 'interactionStrength', 0.1, 2, 0.1).name('상호작용 강도')
    physicsFolder.open()
    
    const controlFolder = gui.addFolder('컨트롤')
    controlFolder.add(params, 'paused').name('일시정지').onChange(value => {
      if (value) {
        controller.pauseSimulation()
      } else {
        controller.resumeSimulation()
      }
    })
    controlFolder.add(params, 'reset').name('초기화')
    controlFolder.open()
  }
  
  function handleParamChange() {
    if (controller && isInitialized) {
      controller.updateSimulationParams({
        gravity: params.gravity,
        viscosity: params.viscosity,
        density: params.density,
        timeScale: params.timeScale,
        particleRadius: params.particleRadius
      })
    }
  }
  
  function resetSimulation() {
    if (controller && isInitialized) {
      controller.resetParticles(params.particleCount)
    }
  }

  // 상호작용 관련 코드 추가 (SPHController에 연결)
  function applyForceAtPoint(x, y) {
    if (controller && isInitialized) {
      controller.applyForceAtPoint(x, y, params.interactionStrength)
    }
  }
  
  // 마우스 이벤트 핸들러
  function handleMouseDown(event) {
    isMouseDown = true
    const rect = canvas.getBoundingClientRect()
    const mouseX = (event.clientX - rect.left) / rect.width
    const mouseY = (event.clientY - rect.top) / rect.height
    applyForceAtPoint(mouseX, mouseY)
  }
  
  function handleMouseMove(event) {
    if (!isMouseDown) return
    const rect = canvas.getBoundingClientRect()
    const mouseX = (event.clientX - rect.left) / rect.width
    const mouseY = (event.clientY - rect.top) / rect.height
    applyForceAtPoint(mouseX, mouseY)
  }
  
  function handleMouseUp() {
    isMouseDown = false
  }
</script>

<div class="container">
  <h1>SPH 유체 시뮬레이션</h1>
  
  {#if errorMessage}
    <div class="error-message">
      <p>WebGPU 초기화 오류: {errorMessage}</p>
      <p>WebGPU를 지원하는 브라우저(Chrome 113+ 또는 Edge 113+)를 사용해주세요.</p>
    </div>
  {:else}
    <div class="canvas-container">
      <canvas 
        bind:this={canvas} 
        width="800" 
        height="600"
        on:mousedown={handleMouseDown}
        on:mousemove={handleMouseMove}
        on:mouseup={handleMouseUp}
        on:mouseleave={handleMouseUp}
      ></canvas>
    </div>
    
    <div class="instructions">
      <h3>사용법:</h3>
      <ul>
        <li>마우스로 드래그하여 유체에 힘을 가할 수 있습니다.</li>
        <li>화면 오른쪽 GUI를 통해 시뮬레이션 파라미터를 조절할 수 있습니다.</li>
      </ul>
    </div>
  {/if}
</div>

<style>
  .container {
    display: flex;
    flex-direction: column;
    align-items: center;
    max-width: 1000px;
    margin: 0 auto;
    padding: 20px;
  }
  
  h1 {
    margin-bottom: 20px;
  }
  
  .canvas-container {
    width: 800px;
    height: 600px;
    border: 1px solid #ccc;
    margin-bottom: 20px;
  }
  
  canvas {
    width: 100%;
    height: 100%;
    background-color: #000;
  }
  
  .instructions {
    width: 100%;
    margin-top: 20px;
    padding: 15px;
    background-color: #f5f5f5;
    border-radius: 5px;
  }
  
  .instructions h3 {
    margin-top: 0;
    margin-bottom: 10px;
  }
  
  .instructions ul {
    margin: 0;
    padding-left: 20px;
  }
  
  .instructions li {
    margin-bottom: 5px;
  }
  
  .error-message {
    padding: 20px;
    background-color: #ffdddd;
    border: 1px solid #ff0000;
    border-radius: 4px;
    color: #550000;
    max-width: 800px;
    text-align: center;
  }
</style>
