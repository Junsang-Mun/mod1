<script>
	import { onMount } from 'svelte';
	let file;
	let canvas;
	let debugInfo = "";
	let errorInfo = "";
	let animationId;
	let pointCount = 0;
  
	async function loadMod1File(file) {
		try {
			const text = await file.text();
			debugInfo += `File loaded, length: ${text.length}\n`;
			
			const points = text.trim().split(/\s+/).map(entry => {
				const match = entry.match(/\((\d+),(\d+),(\d+)\)/);
				if (match) {
					return { x: parseFloat(match[1]), y: parseFloat(match[2]), z: parseFloat(match[3]) };
				}
			}).filter(Boolean);
			
			debugInfo += `Parsed ${points.length} points\n`;
			pointCount = points.length;
			return points;
		} catch (err) {
			errorInfo = `Error loading file: ${err.message}`;
			console.error("File loading error:", err);
			return [];
		}
	}
  
	async function initWebGPU() {
		try {
			if (!navigator.gpu) {
				errorInfo = "WebGPU not supported on this browser.";
				return null;
			}
			
			const adapter = await navigator.gpu.requestAdapter();
			if (!adapter) {
				errorInfo = "Failed to get GPU adapter.";
				return null;
			}
			
			const device = await adapter.requestDevice();
			const context = canvas.getContext("webgpu");
			if (!context) {
				errorInfo = "Failed to get WebGPU context.";
				return null;
			}
			
			const format = navigator.gpu.getPreferredCanvasFormat();
			context.configure({ 
				device, 
				format,
				alphaMode: "premultiplied"
			});
			
			return { device, context, format };
		} catch (err) {
			errorInfo = `WebGPU initialization error: ${err.message}`;
			console.error("WebGPU initialization error:", err);
			return null;
		}
	}
  
	async function renderMod1(event) {
		// Reset debug and error info
		debugInfo = "";
		errorInfo = "";
		
		// Cancel any existing animation
		if (animationId) {
			cancelAnimationFrame(animationId);
		}
		
		try {
			const selectedFile = event.target.files[0];
			if (!selectedFile) {
				debugInfo = "No file selected";
				return;
			}
			
			debugInfo = `File selected: ${selectedFile.name}\n`;
			
			const points = await loadMod1File(selectedFile);
			if (points.length === 0) {
				debugInfo += "No points loaded, nothing to render\n";
				return;
			}
			
			const gpuSetup = await initWebGPU();
			if (!gpuSetup) {
				debugInfo += "WebGPU setup failed\n";
				return;
			}
			
			const { device, context, format } = gpuSetup;
			
			// Normalize point coordinates
			let minX = Infinity, minY = Infinity, minZ = Infinity;
			let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
			
			points.forEach(p => {
				minX = Math.min(minX, p.x);
				minY = Math.min(minY, p.y);
				minZ = Math.min(minZ, p.z);
				maxX = Math.max(maxX, p.x);
				maxY = Math.max(maxY, p.y);
				maxZ = Math.max(maxZ, p.z);
			});
			
			const rangeX = maxX - minX || 1;
			const rangeY = maxY - minY || 1;
			const rangeZ = maxZ - minZ || 1;
			const maxRange = Math.max(rangeX, rangeY, rangeZ);
			
			debugInfo += `Point bounds: X[${minX}-${maxX}], Y[${minY}-${maxY}], Z[${minZ}-${maxZ}]\n`;
			
			// Create vertex data with normalized coordinates and colors
			const verticesWithColors = new Float32Array(points.length * 7); // 3 for position, 4 for color
			
			points.forEach((p, i) => {
				// Normalize to [-1, 1]
				const nx = 2 * ((p.x - minX) / maxRange - 0.5);
				const ny = 2 * ((p.y - minY) / maxRange - 0.5);
				const nz = 2 * ((p.z - minZ) / maxRange - 0.5);
				
				// Position
				verticesWithColors[i * 7] = nx;
				verticesWithColors[i * 7 + 1] = ny;
				verticesWithColors[i * 7 + 2] = nz;
				
				// Color (based on normalized position)
				verticesWithColors[i * 7 + 3] = (nx + 1) / 2; // R [0-1]
				verticesWithColors[i * 7 + 4] = (ny + 1) / 2; // G [0-1]
				verticesWithColors[i * 7 + 5] = (nz + 1) / 2; // B [0-1]
				verticesWithColors[i * 7 + 6] = 1.0;          // A (fully opaque)
			});
			
			// Create vertex buffer
			const vertexBuffer = device.createBuffer({
				size: verticesWithColors.byteLength,
				usage: GPUBufferUsage.VERTEX,
				mappedAtCreation: true
			});
			new Float32Array(vertexBuffer.getMappedRange()).set(verticesWithColors);
			vertexBuffer.unmap();
			
			debugInfo += `Created vertex buffer with ${points.length} points\n`;
			
			// Create a uniform buffer for the transformation matrix
			const uniformBufferSize = 4 * 4 * 4; // 4x4 matrix of 4-byte floats
			const uniformBuffer = device.createBuffer({
				size: uniformBufferSize,
				usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
			});
			
			// Create bind group layout and bind group
			const bindGroupLayout = device.createBindGroupLayout({
				entries: [{
					binding: 0,
					visibility: GPUShaderStage.VERTEX,
					buffer: { type: "uniform" }
				}]
			});
			
			const bindGroup = device.createBindGroup({
				layout: bindGroupLayout,
				entries: [{
					binding: 0,
					resource: {
						buffer: uniformBuffer
					}
				}]
			});
			
			// Create shader module
			const shaderModule = device.createShaderModule({
				code: `
					struct Uniforms {
						modelViewProjection: mat4x4<f32>
					}
					
					@binding(0) @group(0) var<uniform> uniforms: Uniforms;
					
					struct VertexInput {
						@location(0) position: vec3<f32>,
						@location(1) color: vec4<f32>
					}
					
					struct VertexOutput {
						@builtin(position) position: vec4<f32>,
						@location(0) color: vec4<f32>
					}
					
					@vertex
					fn vertexMain(input: VertexInput) -> VertexOutput {
						var output: VertexOutput;
						output.position = uniforms.modelViewProjection * vec4<f32>(input.position, 1.0);
						output.color = input.color;
						return output;
					}
					
					@fragment
					fn fragmentMain(@location(0) color: vec4<f32>) -> @location(0) vec4<f32> {
						return color;
					}
				`
			});
			
			// Create pipeline layout
			const pipelineLayout = device.createPipelineLayout({
				bindGroupLayouts: [bindGroupLayout]
			});
			
			// Create pipeline
			const pipeline = device.createRenderPipeline({
				layout: pipelineLayout,
				vertex: {
					module: shaderModule,
					entryPoint: "vertexMain",
					buffers: [{
						arrayStride: 7 * 4, // 7 floats (3 position, 4 color)
						attributes: [
							{
								// position
								shaderLocation: 0,
								offset: 0,
								format: "float32x3"
							},
							{
								// color
								shaderLocation: 1,
								offset: 3 * 4, // after 3 position floats
								format: "float32x4"
							}
						]
					}]
				},
				fragment: {
					module: shaderModule,
					entryPoint: "fragmentMain",
					targets: [{
						format: format
					}]
				},
				primitive: {
					topology: "point-list",
					// Make points larger
					stripIndexFormat: undefined,
				},
				depthStencil: {
					format: "depth24plus",
					depthWriteEnabled: true,
					depthCompare: "less"
				}
			});
			
			// Create depth texture
			const depthTexture = device.createTexture({
				size: [canvas.width, canvas.height],
				format: "depth24plus",
				usage: GPUTextureUsage.RENDER_ATTACHMENT
			});
			
			debugInfo += "Created rendering pipeline\n";
			
			// Animation function
			let rotation = 0;
			
			function animate() {
				rotation += 0.01;
				
				// Create transformation matrix (rotate around Y axis)
				const modelMatrix = createYRotationMatrix(rotation);
				const viewMatrix = createViewMatrix([0, 0, 3], [0, 0, 0], [0, 1, 0]);
				const projectionMatrix = createPerspectiveMatrix(45 * Math.PI / 180, canvas.width / canvas.height, 0.1, 100.0);
				
				// Combine matrices: projection * view * model
				const modelViewMatrix = multiplyMatrices(viewMatrix, modelMatrix);
				const modelViewProjectionMatrix = multiplyMatrices(projectionMatrix, modelViewMatrix);
				
				// Update uniform buffer with the new transformation matrix
				device.queue.writeBuffer(uniformBuffer, 0, new Float32Array(modelViewProjectionMatrix));
				
				// Begin render pass
				const commandEncoder = device.createCommandEncoder();
				const textureView = context.getCurrentTexture().createView();
				
				const renderPass = commandEncoder.beginRenderPass({
					colorAttachments: [{
						view: textureView,
						clearValue: { r: 0.05, g: 0.05, b: 0.15, a: 1.0 },
						loadOp: "clear",
						storeOp: "store"
					}],
					depthStencilAttachment: {
						view: depthTexture.createView(),
						depthClearValue: 1.0,
						depthLoadOp: "clear",
						depthStoreOp: "store"
					}
				});
				
				renderPass.setPipeline(pipeline);
				renderPass.setBindGroup(0, bindGroup);
				renderPass.setVertexBuffer(0, vertexBuffer);
				renderPass.draw(points.length);
				renderPass.end();
				
				device.queue.submit([commandEncoder.finish()]);
				
				// Request next frame
				animationId = requestAnimationFrame(animate);
			}
			
			// Start animation
			animate();
			debugInfo += "Animation started\n";
			
		} catch (err) {
			errorInfo = `Rendering error: ${err.message}`;
			console.error("Rendering error:", err);
		}
	}
	
	// Matrix utility functions
	function createPerspectiveMatrix(fovY, aspect, near, far) {
		const f = 1.0 / Math.tan(fovY / 2);
		const nf = 1 / (near - far);
		
		return [
			f / aspect, 0, 0, 0,
			0, f, 0, 0,
			0, 0, (far + near) * nf, -1,
			0, 0, 2 * far * near * nf, 0
		];
	}
	
	function createViewMatrix(eye, target, up) {
		// Calculate the z axis of the camera (normalized direction from eye to target)
		const zAxis = normalizeVector([
			eye[0] - target[0],
			eye[1] - target[1],
			eye[2] - target[2]
		]);
		
		// Calculate the x axis of the camera (cross product of up and z)
		const xAxis = normalizeVector(crossProduct(up, zAxis));
		
		// Calculate the y axis of the camera (cross product of z and x)
		const yAxis = crossProduct(zAxis, xAxis);
		
		// Create the view matrix
		return [
			xAxis[0], yAxis[0], zAxis[0], 0,
			xAxis[1], yAxis[1], zAxis[1], 0,
			xAxis[2], yAxis[2], zAxis[2], 0,
			-dotProduct(xAxis, eye), -dotProduct(yAxis, eye), -dotProduct(zAxis, eye), 1
		];
	}
	
	function createYRotationMatrix(angle) {
		const c = Math.cos(angle);
		const s = Math.sin(angle);
		
		return [
			c, 0, -s, 0,
			0, 1, 0, 0,
			s, 0, c, 0,
			0, 0, 0, 1
		];
	}
	
	function multiplyMatrices(a, b) {
		const result = new Array(16).fill(0);
		
		for (let i = 0; i < 4; i++) {
			for (let j = 0; j < 4; j++) {
				for (let k = 0; k < 4; k++) {
					result[i * 4 + j] += a[i * 4 + k] * b[k * 4 + j];
				}
			}
		}
		
		return result;
	}
	
	function normalizeVector(v) {
		const length = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
		if (length > 0.00001) {
			return [v[0] / length, v[1] / length, v[2] / length];
		}
		return [0, 0, 0];
	}
	
	function crossProduct(a, b) {
		return [
			a[1] * b[2] - a[2] * b[1],
			a[2] * b[0] - a[0] * b[2],
			a[0] * b[1] - a[1] * b[0]
		];
	}
	
	function dotProduct(a, b) {
		return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
	}
	
	onMount(() => {
		return () => {
			if (animationId) {
				cancelAnimationFrame(animationId);
			}
		};
	});
</script>

<main>
	<div class="container">
		<h1>MOD1 Point Cloud Viewer</h1>
		<div class="upload-container">
			<input type="file" accept=".mod1,.txt" on:change={renderMod1} />
			<p>Upload a MOD1 file to visualize the point cloud</p>
		</div>
		<div class="canvas-container">
			<canvas bind:this={canvas} width="800" height="600"></canvas>
		</div>
		
		{#if pointCount > 0}
			<div class="stats">
				Rendering {pointCount} points
			</div>
		{/if}
		
		<div class="debug-container">
			<details>
				<summary>Debug Information</summary>
				<pre class="debug-info">{debugInfo}</pre>
				
				{#if errorInfo}
					<h3 class="error-title">Error Information</h3>
					<pre class="error-info">{errorInfo}</pre>
				{/if}
			</details>
		</div>
	</div>
</main>

<style>
	.container {
		display: flex;
		flex-direction: column;
		align-items: center;
		margin: 20px;
	}
	
	.upload-container {
		margin-bottom: 20px;
	}
	
	.canvas-container {
		border: 1px solid #ccc;
		background-color: #f0f0f0;
		margin-bottom: 20px;
	}
	
	canvas {
		display: block;
	}
	
	.stats {
		font-weight: bold;
		margin-bottom: 10px;
	}
	
	.debug-container {
		width: 100%;
		max-width: 800px;
		margin-top: 20px;
		font-family: monospace;
	}
	
	.debug-info {
		background-color: #f0f0f0;
		padding: 10px;
		border-radius: 4px;
		overflow-x: auto;
		white-space: pre-wrap;
	}
	
	.error-title {
		color: #d32f2f;
	}
	
	.error-info {
		background-color: #ffebee;
		padding: 10px;
		border-radius: 4px;
		overflow-x: auto;
		white-space: pre-wrap;
		color: #d32f2f;
	}
	
	details summary {
		cursor: pointer;
		padding: 8px;
		background-color: #eee;
		border-radius: 4px;
		user-select: none;
	}
</style>