<script>
  import { onMount } from 'svelte'

  let canvasElement
  let errorMessage = ''

  function resizeCanvas() {
    if (canvasElement) {
      // 컨테이너의 크기에 맞춰 캔버스 크기 조정
      const container = canvasElement.parentElement
      canvasElement.width = container.clientWidth
      canvasElement.height = container.clientHeight
    }
  }

  async function initWebGPU() {
    console.log('initWebGPU')
  }

  onMount(() => {
    initWebGPU()
    resizeCanvas()
    
    // 윈도우 리사이즈 이벤트에 대응
    window.addEventListener('resize', resizeCanvas)
    
    // 컴포넌트 언마운트 시 이벤트 리스너 제거
    return () => {
      window.removeEventListener('resize', resizeCanvas)
    }
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