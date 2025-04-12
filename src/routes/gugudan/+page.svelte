<script>
    import gugudan from "$lib/gugudan/gugudan.wgsl?raw";

    let outputText = "";

    async function computeGugudan() {
        if (!navigator.gpu) {
            outputText = "WebGPU not supported";
            return;
        }

        const adapter = await navigator.gpu.requestAdapter();
        const device = await adapter.requestDevice();

        const baseNumbers = new Uint32Array([2, 3, 4, 5, 6, 7, 8, 9]);

        const inputBuffer = device.createBuffer({
            size: baseNumbers.byteLength,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
            mappedAtCreation: false,
        });

        const outputBufferSize = 8 * 9 * 4;
        const outputBuffer = device.createBuffer({
            size: outputBufferSize,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
        });

        const readbackBuffer = device.createBuffer({
            size: outputBufferSize,
            usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
        });

        device.queue.writeBuffer(inputBuffer, 0, baseNumbers);

        const shaderModule = device.createShaderModule({
            code: gugudan, // 이게 핵심 수정!! fetch 안 함
        });

        const pipeline = device.createComputePipeline({
            layout: "auto",
            compute: {
                module: shaderModule,
                entryPoint: "main",
            },
        });

        const bindGroup = device.createBindGroup({
            layout: pipeline.getBindGroupLayout(0),
            entries: [
                { binding: 0, resource: { buffer: inputBuffer } },
                { binding: 1, resource: { buffer: outputBuffer } },
            ],
        });

        const commandEncoder = device.createCommandEncoder();
        const pass = commandEncoder.beginComputePass();
        pass.setPipeline(pipeline);
        pass.setBindGroup(0, bindGroup);
        pass.dispatchWorkgroups(9, 8);
        pass.end();

        commandEncoder.copyBufferToBuffer(
            outputBuffer,
            0,
            readbackBuffer,
            0,
            outputBufferSize,
        );

        device.queue.submit([commandEncoder.finish()]);

        await readbackBuffer.mapAsync(GPUMapMode.READ);
        const arrayBuffer = readbackBuffer.getMappedRange();
        const results = new Uint32Array(arrayBuffer);

        let result = "";
        for (let y = 0; y < 8; y++) {
            for (let x = 0; x < 9; x++) {
                result += `${baseNumbers[y]}×${x + 1}=${results[y * 9 + x]}\t`;
            }
            result += "\n";
        }
        outputText = result;

        readbackBuffer.unmap();
    }
</script>

<button on:click={computeGugudan}>99단</button>

<pre>{outputText}</pre>
