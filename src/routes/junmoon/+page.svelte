<script>
    import { onMount } from "svelte";
    import shaderCode from "./triangle.wgsl?raw";
    import image from "$lib/texture.jpeg";
    let timeBuffer;
    let startTime = performance.now();

    let canvasElement;
    let errorMessage = "";
    let device, context, pipeline, animationFrameId;
    let sampler, texture, bindGroup;

    async function loadImageBitmap(src) {
        const img = new Image();
        img.src = src;
        img.crossOrigin = "anonymous";
        await img.decode();
        return await createImageBitmap(img);
    }

    async function initWebGPU() {
        const adapter = await navigator.gpu?.requestAdapter();
        device = await adapter?.requestDevice();
        if (!device) {
            errorMessage = "WebGPU 장치를 찾을 수 없습니다.";
            return;
        }

        const canvas = canvasElement;
        context = canvas.getContext("webgpu");
        const format = navigator.gpu.getPreferredCanvasFormat();
        context.configure({ device, format });

        // 이미지 로딩
        const bitmap = await loadImageBitmap(image);

        // 텍스처 생성
        texture = device.createTexture({
            size: [bitmap.width, bitmap.height],
            format: "rgba8unorm",
            usage:
                GPUTextureUsage.TEXTURE_BINDING |
                GPUTextureUsage.COPY_DST |
                GPUTextureUsage.RENDER_ATTACHMENT,
        });

        device.queue.copyExternalImageToTexture(
            { source: bitmap },
            { texture: texture },
            [bitmap.width, bitmap.height],
        );

        // 샘플러
        sampler = device.createSampler({
            magFilter: "linear",
            minFilter: "linear",
        });

        // 쉐이더
        const shaderModule = device.createShaderModule({ code: shaderCode });

        // 파이프라인 생성
        pipeline = device.createRenderPipeline({
            layout: "auto",
            vertex: {
                module: shaderModule,
                entryPoint: "vs",
            },
            fragment: {
                module: shaderModule,
                entryPoint: "fs",
                targets: [{ format }],
            },
        });

        // 타임 버퍼 생
        timeBuffer = device.createBuffer({
            size: 4,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });

        // 바인드 그룹 생성
        bindGroup = device.createBindGroup({
            layout: pipeline.getBindGroupLayout(0),
            entries: [
                { binding: 0, resource: sampler },
                { binding: 1, resource: texture.createView() },
                { binding: 2, resource: { buffer: timeBuffer } },
            ],
        });
    }

    function render() {
        const elapsed = (performance.now() - startTime) / 1000; // seconds
        device.queue.writeBuffer(timeBuffer, 0, new Float32Array([elapsed]));

        const encoder = device.createCommandEncoder();
        const view = context.getCurrentTexture().createView();

        const renderPass = encoder.beginRenderPass({
            colorAttachments: [
                {
                    view,
                    clearValue: { r: 0, g: 0, b: 0, a: 1 },
                    loadOp: "clear",
                    storeOp: "store",
                },
            ],
        });

        renderPass.setPipeline(pipeline);
        renderPass.setBindGroup(0, bindGroup);
        renderPass.draw(3);
        renderPass.end();

        device.queue.submit([encoder.finish()]);
        animationFrameId = requestAnimationFrame(render);
    }

    onMount(async () => {
        await initWebGPU();
        render();

        return () => {
            if (animationFrameId) cancelAnimationFrame(animationFrameId);
        };
    });
</script>

<div class="container">
    <h1>WebGPU 텍스처 테스트</h1>
    {#if errorMessage}
        <p class="error">{errorMessage}</p>
    {/if}
    <canvas bind:this={canvasElement}></canvas>
</div>

<style>
    .container {
        height: 80vh;
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
