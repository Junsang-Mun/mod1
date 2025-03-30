<script>
    import { onMount } from "svelte";
    import shaderCode from "./mouse_interaction.wgsl";
    import image from "$lib/texture.jpeg";

    let timeBuffer;
    let mouseBuffer;
    let startTime = performance.now();
    let mouseX = 0;
    let mouseY = 0;
    let canvasElement;
    let errorMessage = "";
    let device, context, pipeline, animationFrameId;
    let sampler, imageTexture, msaaTexture, bindGroup;
    let canvasWidth = 768, canvasHeight = 1024;

    function updateMousePosition(event) {
        const rect = canvasElement.getBoundingClientRect();
        // Calculate the scaling factor between the canvas's display size and its internal size
        const scaleX = canvasWidth / rect.width;
        const scaleY = canvasHeight / rect.height;
        
        // Convert client coordinates to normalized coordinates (0-1)
        // Apply scaling to account for any canvas resizing
        mouseX = ((event.clientX - rect.left) * scaleX) / canvasWidth;
        mouseY = ((event.clientY - rect.top) * scaleY) / canvasHeight;
        
        // Clamp values between 0 and 1
        mouseX = Math.max(0, Math.min(1, mouseX));
        mouseY = Math.max(0, Math.min(1, mouseY));
        
        // Update the uniform buffer with new mouse position
        device.queue.writeBuffer(mouseBuffer, 0, new Float32Array([mouseX, mouseY]));
    }

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
        context.configure({
            device,
            format,
            alphaMode: "opaque",
        });

        // 이미지 로딩
        const bitmap = await loadImageBitmap(image);
        canvasWidth = bitmap.width;
        canvasHeight = bitmap.height;

        // 1. 이미지 텍스처 (sampleCount: 1)
        imageTexture = device.createTexture({
            size: [bitmap.width, bitmap.height],
            format: format,
            sampleCount: 1,
            usage:
                GPUTextureUsage.TEXTURE_BINDING |
                GPUTextureUsage.COPY_DST |
                GPUTextureUsage.RENDER_ATTACHMENT,
        });

        // 이미지 복사
        device.queue.copyExternalImageToTexture(
            { source: bitmap },
            { texture: imageTexture },
            [bitmap.width, bitmap.height],
        );

        // 2. 렌더링용 MSAA 텍스처 (sampleCount: 4)
        msaaTexture = device.createTexture({
            size: [canvasWidth, canvasHeight],
            format: format,
            sampleCount: 4,
            usage: 
                GPUTextureUsage.RENDER_ATTACHMENT |
                GPUTextureUsage.TEXTURE_BINDING |
                GPUTextureUsage.COPY_DST
        });

        // 샘플러
        sampler = device.createSampler({
            magFilter: "linear",
            minFilter: "linear",
        });

        // 쉐이더 모듈
        const shaderModule = device.createShaderModule({ code: shaderCode });

        // Create an explicit bind group layout that matches the shader bindings
        const bindGroupLayout = device.createBindGroupLayout({
            entries: [
                {
                    binding: 0,
                    visibility: GPUShaderStage.FRAGMENT,
                    sampler: { type: 'filtering' }
                },
                {
                    binding: 1,
                    visibility: GPUShaderStage.FRAGMENT,
                    texture: { sampleType: 'float', viewDimension: '2d', multisampled: false }
                },
                {
                    binding: 2,
                    visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
                    buffer: { type: 'uniform' }
                },
                {
                    binding: 3,
                    visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
                    buffer: { type: 'uniform' }
                }
            ]
        });

        // Create a pipeline layout with the custom bind group layout
        const pipelineLayout = device.createPipelineLayout({
            bindGroupLayouts: [bindGroupLayout]
        });

        // 렌더 파이프라인 생성
        pipeline = device.createRenderPipeline({
            layout: pipelineLayout,
            vertex: {
                module: shaderModule,
                entryPoint: "vs",
            },
            fragment: {
                module: shaderModule,
                entryPoint: "fs",
                targets: [{ format }],
            },
            multisample: {
                count: 4,
            },
        });

        // 시간 버퍼
        timeBuffer = device.createBuffer({
            size: 4,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });

        // 마우스 버퍼
        mouseBuffer = device.createBuffer({
            size: 8, // Needs to be 8 bytes for two float32 values (mouseX, mouseY)
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });

        // 시간 버퍼 초기화
        device.queue.writeBuffer(timeBuffer, 0, new Float32Array([0.0]));
        
        // 마우스 버퍼 초기화
        device.queue.writeBuffer(mouseBuffer, 0, new Float32Array([0.0, 0.0]));

        // 바인드 그룹 (이미지 텍스처 사용)
        bindGroup = device.createBindGroup({
            layout: bindGroupLayout,
            entries: [
                { binding: 0, resource: sampler },
                { binding: 1, resource: imageTexture.createView() },
                { binding: 2, resource: { buffer: timeBuffer } },
                { binding: 3, resource: { buffer: mouseBuffer } },
            ],
        });
    }

    function render() {
        const elapsed = (performance.now() - startTime) / 1000;
        device.queue.writeBuffer(timeBuffer, 0, new Float32Array([elapsed]));

        const encoder = device.createCommandEncoder();
        const renderPass = encoder.beginRenderPass({
            colorAttachments: [
                {
                    view: msaaTexture.createView(),
                    resolveTarget: context.getCurrentTexture().createView(),
                    clearValue: { r: 0, g: 0, b: 0, a: 1 },
                    loadOp: "clear",
                    storeOp: "store",
                },
            ],
        });

        renderPass.setPipeline(pipeline);
        renderPass.setBindGroup(0, bindGroup);
        renderPass.draw(6);
        renderPass.end();

        device.queue.submit([encoder.finish()]);
        animationFrameId = requestAnimationFrame(render);
    }

    onMount(async () => {
        await initWebGPU();
        canvasElement.addEventListener("mousemove", updateMousePosition);
        render();

        return () => {
            if (animationFrameId) cancelAnimationFrame(animationFrameId);
            canvasElement.removeEventListener("mousemove", updateMousePosition);
        };
    });
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