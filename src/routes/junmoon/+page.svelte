<script>
    import { onMount, onDestroy } from 'svelte'
    import { WebGPUController } from '$lib/webgpu'
    import shaderCode from './mouse_interaction.wgsl'
    import image from '$lib/texture.jpeg'

    let canvasElement
    let errorMessage = ''
    let canvasWidth = 768, canvasHeight = 1024
    let controller

    onMount(async () => {
        controller = new WebGPUController()
        const result = await controller.initialize(canvasElement, shaderCode, image)
        
        if (result.error) {
            errorMessage = result.error
        } else {
            canvasWidth = result.canvasWidth
            canvasHeight = result.canvasHeight
        }
    })

    onDestroy(() => {
        if (controller) {
            controller.cleanup()
        }
    })
</script>

<div class="container">
    <h1>WebGPU 텍스처 테스트</h1>
    {#if errorMessage}
        <p class="error">{errorMessage}</p>
    {/if}
    <canvas bind:this={canvasElement} width={canvasWidth} height={canvasHeight}></canvas>
</div>

<style>
    .container {
        height: 80vh;
        width: 100%;
        justify-content: center;
        align-items: center;
    }

    canvas {
        display: block;
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