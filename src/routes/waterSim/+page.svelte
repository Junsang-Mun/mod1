<script>
    import { onMount } from "svelte";
    import wgsl from "$lib/waterSim/waterSim.wgsl?raw";

    let canvas;
    const GRID = 128;
    let frameId, device, ctx, format;

    // precomputed isometric viewProj matrix:
    // rotateY(45°) then rotateX(35.264°), orthographic –1..1
    const viewProjMatrix = new Float32Array([
        0.7071068, 0.4082483, -0.5773503, 0, 0.0, 0.8164966, 0.5773503, 0,
        0.7071068, -0.4082483, 0.5773503, 0, 0, 0, 0, 1,
    ]);

    onMount(async () => {
        if (!navigator.gpu) {
            alert("WebGPU not supported");
            return;
        }
        const adapter = await navigator.gpu.requestAdapter();
        device = await adapter.requestDevice();
        ctx = canvas.getContext("webgpu");
        format = navigator.gpu.getPreferredCanvasFormat();
        ctx.configure({ device, format, alphaMode: "premultiplied" });

        // ─── grid buffers
        const count = GRID * GRID;
        const data = new Float32Array(count * 4);
        for (let i = 0; i < count; i++) {
            data[i * 4 + 0] = Math.random() * 0.02 - 0.01;
            data[i * 4 + 1] = 0;
            data[i * 4 + 2] = 0;
            data[i * 4 + 3] = 0;
        }
        const makeBuf = (arr, usage) => {
            const b = device.createBuffer({
                size: arr.byteLength,
                usage,
                mappedAtCreation: true,
            });
            new arr.constructor(b.getMappedRange()).set(arr);
            b.unmap();
            return b;
        };
        const bufA = makeBuf(
            data,
            GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
        );
        const bufB = makeBuf(
            data,
            GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
        );

        // ─── simulation params
        const simBuf = device.createBuffer({
            size: 40,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });
        device.queue.writeBuffer(
            simBuf,
            0,
            new Float32Array([GRID, GRID, 0.016, 0.02, 0.4]),
        );
        device.queue.writeBuffer(simBuf, 24, new Float32Array([0.5, 0.5, 0]));

        // ─── camera matrix
        const camBuf = device.createBuffer({
            size: 64,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });
        device.queue.writeBuffer(camBuf, 0, viewProjMatrix);

        // ─── bind‑group layouts
        const bgl0 = device.createBindGroupLayout({
            entries: [
                {
                    binding: 0,
                    visibility:
                        GPUShaderStage.COMPUTE |
                        GPUShaderStage.VERTEX |
                        GPUShaderStage.FRAGMENT,
                    buffer: { type: "read-only-storage" },
                },
                {
                    binding: 1,
                    visibility: GPUShaderStage.COMPUTE,
                    buffer: { type: "storage" },
                },
                {
                    binding: 2,
                    visibility:
                        GPUShaderStage.COMPUTE |
                        GPUShaderStage.VERTEX |
                        GPUShaderStage.FRAGMENT,
                    buffer: { type: "uniform" },
                },
            ],
        });
        const cameraBGL = device.createBindGroupLayout({
            entries: [
                {
                    binding: 0,
                    visibility: GPUShaderStage.VERTEX,
                    buffer: { type: "uniform" },
                },
            ],
        });

        // split layouts:
        const computePipelineLayout = device.createPipelineLayout({
            bindGroupLayouts: [bgl0], // only group 0
        });
        const renderPipelineLayout = device.createPipelineLayout({
            bindGroupLayouts: [bgl0, cameraBGL], // group 0 + 1
        });

        // ─── pipelines
        const module = device.createShaderModule({ code: wgsl });
        const computePipeline = device.createComputePipeline({
            layout: computePipelineLayout,
            compute: { module, entryPoint: "computeMain" },
        });
        const renderPipeline = device.createRenderPipeline({
            layout: renderPipelineLayout,
            vertex: {
                module,
                entryPoint: "vertMain",
                buffers: [
                    {
                        arrayStride: 16,
                        attributes: [
                            {
                                shaderLocation: 0,
                                offset: 0,
                                format: "float32x2",
                            },
                            {
                                shaderLocation: 1,
                                offset: 8,
                                format: "float32x2",
                            },
                        ],
                    },
                ],
            },
            fragment: {
                module,
                entryPoint: "fragMain",
                targets: [
                    {
                        format,
                        blend: {
                            color: {
                                srcFactor: "src-alpha",
                                dstFactor: "one-minus-src-alpha",
                            },
                            alpha: {
                                srcFactor: "one",
                                dstFactor: "one-minus-src-alpha",
                            },
                        },
                    },
                ],
            },
            primitive: { topology: "triangle-list", cullMode: "none" },
            depthStencil: {
                format: "depth24plus",
                depthWriteEnabled: true,
                depthCompare: "less",
            },
        });

        // ─── bind groups
        const bgA = device.createBindGroup({
            layout: bgl0,
            entries: [
                { binding: 0, resource: { buffer: bufA } },
                { binding: 1, resource: { buffer: bufB } },
                { binding: 2, resource: { buffer: simBuf } },
            ],
        });
        const bgB = device.createBindGroup({
            layout: bgl0,
            entries: [
                { binding: 0, resource: { buffer: bufB } },
                { binding: 1, resource: { buffer: bufA } },
                { binding: 2, resource: { buffer: simBuf } },
            ],
        });
        const cameraBG = device.createBindGroup({
            layout: cameraBGL,
            entries: [{ binding: 0, resource: { buffer: camBuf } }],
        });

        // ─── mesh & depth
        const RES = 64;
        const verts = new Float32Array(RES * RES * 4);
        const idxs = [];
        for (let y = 0; y < RES; y++) {
            for (let x = 0; x < RES; x++) {
                const i = (y * RES + x) * 4;
                verts[i] = (x / (RES - 1)) * 2 - 1;
                verts[i + 1] = (y / (RES - 1)) * 2 - 1;
                verts[i + 2] = x / (RES - 1);
                verts[i + 3] = y / (RES - 1);
            }
        }
        for (let y = 0; y < RES - 1; y++) {
            for (let x = 0; x < RES - 1; x++) {
                const i0 = y * RES + x,
                    i1 = i0 + 1,
                    i2 = i0 + RES,
                    i3 = i2 + 1;
                idxs.push(i0, i2, i1, i1, i2, i3);
            }
        }
        const vb = makeBuf(verts, GPUBufferUsage.VERTEX);
        const ib = makeBuf(new Uint16Array(idxs), GPUBufferUsage.INDEX);
        const depthTex = device.createTexture({
            size: [canvas.width, canvas.height],
            format: "depth24plus",
            usage: GPUTextureUsage.RENDER_ATTACHMENT,
        });

        // ─── interaction & loop
        let flip = false;
        const splash = (x, y, s) => {
            device.queue.writeBuffer(simBuf, 24, new Float32Array([x, y, s]));
        };
        canvas.addEventListener("pointerdown", (e) => {
            const r = canvas.getBoundingClientRect();
            splash(
                (e.clientX - r.left) / r.width,
                1 - (e.clientY - r.top) / r.height,
                0.4,
            );
        });
        canvas.addEventListener(
            "pointermove",
            (e) =>
                e.buttons &&
                canvas.dispatchEvent(new PointerEvent("pointerdown", e)),
        );
        canvas.addEventListener("pointerup", () => splash(0, 0, 0));
        canvas.addEventListener("pointerleave", () => splash(0, 0, 0));
        splash(0.5, 0.5, 0.8);

        function frame() {
            const enc = device.createCommandEncoder();

            // compute pass (only group 0)
            {
                const pass = enc.beginComputePass();
                pass.setPipeline(computePipeline);
                pass.setBindGroup(0, flip ? bgB : bgA);
                pass.dispatchWorkgroups(
                    Math.ceil(GRID / 16),
                    Math.ceil(GRID / 16),
                );
                pass.end();
            }

            // render pass (groups 0 + 1)
            {
                const view = ctx.getCurrentTexture().createView();
                const rp = enc.beginRenderPass({
                    colorAttachments: [
                        {
                            view,
                            loadOp: "clear",
                            storeOp: "store",
                            clearValue: { r: 0, g: 0.05, b: 0.1, a: 1 },
                        },
                    ],
                    depthStencilAttachment: {
                        view: depthTex.createView(),
                        depthLoadOp: "clear",
                        depthStoreOp: "store",
                        depthClearValue: 1.0,
                    },
                });
                rp.setPipeline(renderPipeline);
                rp.setBindGroup(0, flip ? bgB : bgA);
                rp.setBindGroup(1, cameraBG);
                rp.setVertexBuffer(0, vb);
                rp.setIndexBuffer(ib, "uint16");
                rp.drawIndexed(idxs.length);
                rp.end();
            }

            device.queue.submit([enc.finish()]);
            flip = !flip;
            frameId = requestAnimationFrame(frame);
        }
        frame();

        return () => cancelAnimationFrame(frameId);
    });

    function makeBuf(arr, usage) {
        const buf = device.createBuffer({
            size: arr.byteLength,
            usage,
            mappedAtCreation: true,
        });
        new arr.constructor(buf.getMappedRange()).set(arr);
        buf.unmap();
        return buf;
    }
</script>

<canvas
    bind:this={canvas}
    width={512}
    height={512}
    style="border:1px solid white; background:#001628;"
></canvas>
<div class="instructions">Click & drag to create waves.</div>

<style>
    .instructions {
        margin-top: 10px;
        color: #fff;
        font-family: sans-serif;
        text-align: center;
    }
</style>
