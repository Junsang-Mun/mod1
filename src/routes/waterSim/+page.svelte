<script>
    import { onMount } from "svelte";
    import waterSimWGSL from "$lib/waterSim/waterSim.wgsl?raw";

    let canvas;
    const NUM_PARTICLES = 4096;

    let animationFrame;

    onMount(async () => {
        if (!navigator.gpu) {
            alert("WebGPU not supported");
            return;
        }

        const adapter = await navigator.gpu.requestAdapter();
        const device = await adapter?.requestDevice();
        if (!device) return;

        const context = canvas.getContext("webgpu");
        const format = navigator.gpu.getPreferredCanvasFormat();
        context.configure({ device, format, alphaMode: "opaque" });

        const particleState = new Float32Array(NUM_PARTICLES * 4);
        for (let i = 0; i < NUM_PARTICLES; i++) {
            const x = (Math.random() - 0.5) * 0.2;
            const y = (Math.random() - 0.5) * 0.2;
            particleState[i * 4 + 0] = x;
            particleState[i * 4 + 1] = y;
            particleState[i * 4 + 2] = 0.0;
            particleState[i * 4 + 3] = 0.0;
        }

        const particleBuffer = device.createBuffer({
            size: particleState.byteLength,
            usage:
                GPUBufferUsage.STORAGE |
                GPUBufferUsage.VERTEX |
                GPUBufferUsage.COPY_DST,
            mappedAtCreation: true,
        });
        new Float32Array(particleBuffer.getMappedRange()).set(particleState);
        particleBuffer.unmap();

        const shaderModule = device.createShaderModule({ code: waterSimWGSL });

        const computePipeline = device.createComputePipeline({
            layout: "auto",
            compute: {
                module: shaderModule,
                entryPoint: "computeMain",
            },
        });

        const renderPipeline = device.createRenderPipeline({
            layout: "auto",
            vertex: {
                module: shaderModule,
                entryPoint: "vertMain",
                buffers: [
                    {
                        arrayStride: 4 * 4,
                        attributes: [
                            {
                                shaderLocation: 0,
                                format: "float32x2",
                                offset: 0,
                            },
                        ],
                    },
                ],
            },
            fragment: {
                module: shaderModule,
                entryPoint: "fragMain",
                targets: [{ format }],
            },
            primitive: { topology: "point-list" },
        });

        const bindGroup = device.createBindGroup({
            layout: computePipeline.getBindGroupLayout(0),
            entries: [{ binding: 0, resource: { buffer: particleBuffer } }],
        });

        const render = () => {
            const commandEncoder = device.createCommandEncoder();

            {
                const pass = commandEncoder.beginComputePass();
                pass.setPipeline(computePipeline);
                pass.setBindGroup(0, bindGroup);
                pass.dispatchWorkgroups(Math.ceil(NUM_PARTICLES / 64));
                pass.end();
            }

            {
                const textureView = context.getCurrentTexture().createView();
                const pass = commandEncoder.beginRenderPass({
                    colorAttachments: [
                        {
                            view: textureView,
                            loadOp: "clear",
                            storeOp: "store",
                            clearValue: { r: 0, g: 0, b: 0, a: 1 },
                        },
                    ],
                });
                pass.setPipeline(renderPipeline);
                pass.setVertexBuffer(0, particleBuffer);
                pass.draw(NUM_PARTICLES);
                pass.end();
            }

            device.queue.submit([commandEncoder.finish()]);
            animationFrame = requestAnimationFrame(render);
        };

        render();
        return () => cancelAnimationFrame(animationFrame);
    });
</script>

<canvas
    bind:this={canvas}
    width={512}
    height={512}
    style="border: 1px solid white; width: 512px; height: 512px;"
/>
