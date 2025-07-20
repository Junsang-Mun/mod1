// WebGPU Type Declarations
declare global {
  // Navigator interface extension
  interface Navigator {
    gpu: GPU;
  }

  interface GPU {
    requestAdapter(options?: GPURequestAdapterOptions): Promise<GPUAdapter | null>;
    getPreferredCanvasFormat(): GPUTextureFormat;
  }

  interface GPURequestAdapterOptions {
    powerPreference?: 'low-power' | 'high-performance';
    forceFallbackAdapter?: boolean;
  }

  interface GPUAdapter {
    requestDevice(descriptor?: GPUDeviceDescriptor): Promise<GPUDevice>;
    name: string;
    features: GPUSupportedFeatures;
    limits: GPUSupportedLimits;
  }

  interface GPUDeviceDescriptor {
    label?: string;
    requiredFeatures?: string[];
    requiredLimits?: Record<string, number>;
  }

  interface GPUSupportedFeatures {
    has(feature: string): boolean;
  }

  interface GPUSupportedLimits {
    maxTextureDimension1D: number;
    maxTextureDimension2D: number;
    maxTextureDimension3D: number;
    maxTextureArrayLayers: number;
    maxBindGroups: number;
    maxBindGroupsPlusVertexBuffers: number;
    maxBindingsPerBindGroup: number;
    maxDynamicUniformBuffersPerPipelineLayout: number;
    maxDynamicStorageBuffersPerPipelineLayout: number;
    maxSampledTexturesPerShaderStage: number;
    maxSamplersPerShaderStage: number;
    maxStorageBuffersPerShaderStage: number;
    maxStorageTexturesPerShaderStage: number;
    maxUniformBuffersPerShaderStage: number;
    maxUniformBufferBindingSize: number;
    maxStorageBufferBindingSize: number;
    minUniformBufferOffsetAlignment: number;
    minStorageBufferOffsetAlignment: number;
    maxVertexBuffers: number;
    maxBufferSize: number;
    maxVertexAttributes: number;
    maxVertexBufferArrayStride: number;
    maxInterStageShaderComponents: number;
    maxInterStageShaderVariables: number;
    maxColorAttachments: number;
    maxColorAttachmentBytesPerSample: number;
    maxComputeWorkgroupStorageSize: number;
    maxComputeInvocationsPerWorkgroup: number;
    maxComputeWorkgroupSizeX: number;
    maxComputeWorkgroupSizeY: number;
    maxComputeWorkgroupSizeZ: number;
    maxComputeWorkgroupsPerDimension: number;
  }

  // Canvas context extension
  interface HTMLCanvasElement {
    getContext(contextId: 'webgpu'): GPUCanvasContext | null;
  }
  interface GPUDevice {
    createBuffer(descriptor: GPUBufferDescriptor): GPUBuffer;
    createTexture(descriptor: GPUTextureDescriptor): GPUTexture;
    createShaderModule(descriptor: GPUShaderModuleDescriptor): GPUShaderModule;
    createBindGroupLayout(descriptor: GPUBindGroupLayoutDescriptor): GPUBindGroupLayout;
    createBindGroup(descriptor: GPUBindGroupDescriptor): GPUBindGroup;
    createPipelineLayout(descriptor: GPUPipelineLayoutDescriptor): GPUPipelineLayout;
    createRenderPipeline(descriptor: GPURenderPipelineDescriptor): GPURenderPipeline;
    createComputePipeline(descriptor: GPUComputePipelineDescriptor): GPUComputePipeline;
    createComputePipelineAsync(descriptor: GPUComputePipelineDescriptor): Promise<GPUComputePipeline>;
    createCommandEncoder(descriptor?: GPUCommandEncoderDescriptor): GPUCommandEncoder;
    queue: GPUQueue;
  }

  interface GPUCanvasContext {
    configure(descriptor: GPUCanvasConfiguration): void;
    getCurrentTexture(): GPUTexture;
  }

  interface GPUBuffer {
    destroy(): void;
    mapAsync(mode: GPUMapModeFlags, offset?: number, size?: number): Promise<void>;
    getMappedRange(offset?: number, size?: number): ArrayBuffer;
    unmap(): void;
  }

  interface GPUTexture {
    createView(descriptor?: GPUTextureViewDescriptor): GPUTextureView;
    destroy(): void;
  }

  interface GPUShaderModule {
    getCompilationInfo(): Promise<GPUCompilationInfo>;
  }

  interface GPUCompilationInfo {
    messages: GPUCompilationMessage[];
  }

  interface GPUCompilationMessage {
    type: 'info' | 'warning' | 'error';
    message: string;
    lineNum: number;
    linePos: number;
    offset: number;
    length: number;
  }

  interface GPUBindGroupLayout {
    // Bind group layout methods
  }

  interface GPUBindGroup {
    // Bind group methods
  }

  interface GPUPipelineLayout {
    // Pipeline layout methods
  }

  interface GPURenderPipeline {
    // Render pipeline methods
  }

  interface GPUComputePipeline {
    // Compute pipeline methods
  }

  interface GPUCommandEncoder {
    beginRenderPass(descriptor: GPURenderPassDescriptor): GPURenderPassEncoder;
    beginComputePass(descriptor?: GPUComputePassDescriptor): GPUComputePassEncoder;
    copyBufferToBuffer(source: GPUBuffer, sourceOffset: number, destination: GPUBuffer, destinationOffset: number, size: number): void;
    finish(): GPUCommandBuffer;
  }

  interface GPURenderPassEncoder {
    setPipeline(pipeline: GPURenderPipeline): void;
    setBindGroup(index: number, bindGroup: GPUBindGroup, dynamicOffsets?: number[]): void;
    setVertexBuffer(slot: number, buffer: GPUBuffer, offset?: number, size?: number): void;
    draw(vertexCount: number, instanceCount?: number, firstVertex?: number, firstInstance?: number): void;
    end(): void;
  }

  interface GPUComputePassEncoder {
    setPipeline(pipeline: GPUComputePipeline): void;
    setBindGroup(index: number, bindGroup: GPUBindGroup, dynamicOffsets?: number[]): void;
    dispatchWorkgroups(workgroupCountX: number, workgroupCountY?: number, workgroupCountZ?: number): void;
    end(): void;
  }

  interface GPUCommandBuffer {
    // Command buffer methods
  }

  interface GPUQueue {
    writeBuffer(buffer: GPUBuffer, bufferOffset: number, data: BufferSource, dataOffset?: number, size?: number): void;
    writeTexture(destination: GPUImageCopyTexture, data: BufferSource, dataLayout: GPUImageDataLayout, size: GPUExtent3D): void;
    submit(commandBuffers: GPUCommandBuffer[]): void;
  }

  interface GPUImageCopyTexture {
    texture: GPUTexture;
    mipLevel?: number;
    origin?: GPUOrigin3D;
    aspect?: GPUTextureAspect;
  }

  interface GPUImageDataLayout {
    offset?: number;
    bytesPerRow?: number;
    rowsPerImage?: number;
  }

  type GPUOrigin3D = [number, number, number] | { x?: number; y?: number; z?: number };
  type GPUTextureAspect = 'all' | 'stencil-only' | 'depth-only';

  // Descriptor interfaces
  interface GPUBufferDescriptor {
    size: number;
    usage: GPUBufferUsageFlags;
    mappedAtCreation?: boolean;
    label?: string;
  }

  interface GPUTextureDescriptor {
    size: GPUExtent3D;
    format: GPUTextureFormat;
    usage: GPUTextureUsageFlags;
    mipLevelCount?: number;
    sampleCount?: number;
    dimension?: GPUTextureDimension;
    viewFormats?: GPUTextureFormat[];
    label?: string;
  }

  interface GPUShaderModuleDescriptor {
    code: string;
    label?: string;
  }

  interface GPUBindGroupLayoutDescriptor {
    entries: GPUBindGroupLayoutEntry[];
    label?: string;
  }

  interface GPUBindGroupLayoutEntry {
    binding: number;
    visibility: GPUShaderStageFlags;
    buffer?: GPUBufferBindingLayout;
    texture?: GPUTextureBindingLayout;
    sampler?: GPUSamplerBindingLayout;
    storageTexture?: GPUStorageTextureBindingLayout;
  }

  interface GPUBindGroupDescriptor {
    layout: GPUBindGroupLayout;
    entries: GPUBindGroupEntry[];
    label?: string;
  }

  interface GPUBindGroupEntry {
    binding: number;
    resource: GPUBindingResource;
  }

  interface GPUPipelineLayoutDescriptor {
    bindGroupLayouts: GPUBindGroupLayout[];
    label?: string;
  }

  interface GPURenderPipelineDescriptor {
    vertex: GPUVertexState;
    fragment?: GPUFragmentState;
    primitive?: GPUPrimitiveState;
    depthStencil?: GPUDepthStencilState;
    multisample?: GPUMultisampleState;
    layout?: GPUPipelineLayout;
    label?: string;
  }

  interface GPUComputePipelineDescriptor {
    compute: GPUProgrammableStage;
    layout?: GPUPipelineLayout;
    label?: string;
  }

  interface GPUCommandEncoderDescriptor {
    label?: string;
  }

  interface GPUCanvasConfiguration {
    device: GPUDevice;
    format: GPUTextureFormat | null;
    alphaMode?: GPUCanvasAlphaMode;
    width?: number;
    height?: number;
  }

  interface GPURenderPassDescriptor {
    colorAttachments: GPURenderPassColorAttachment[];
    depthStencilAttachment?: GPURenderPassDepthStencilAttachment;
    occlusionQuerySet?: GPUQuerySet;
    timestampWrites?: GPURenderPassTimestampWrites;
    label?: string;
  }

  interface GPUComputePassDescriptor {
    timestampWrites?: GPUComputePassTimestampWrites;
    label?: string;
  }

  // State interfaces
  interface GPUVertexState {
    module: GPUShaderModule;
    entryPoint: string;
    buffers?: GPUVertexBufferLayout[];
  }

  interface GPUFragmentState {
    module: GPUShaderModule;
    entryPoint: string;
    targets: GPUColorTargetState[];
  }

  interface GPUProgrammableStage {
    module: GPUShaderModule;
    entryPoint: string;
    constants?: Record<string, number>;
  }

  // Buffer and texture layouts
  interface GPUBufferBindingLayout {
    type: 'uniform' | 'storage' | 'read-only-storage';
    hasDynamicOffset?: boolean;
    minBindingSize?: number;
  }

  interface GPUTextureBindingLayout {
    sampleType: 'unfilterable-float' | 'filterable-float' | 'unfilterable-uint' | 'depth' | 'sint';
    viewDimension?: GPUTextureViewDimension;
    multisampled?: boolean;
  }

  interface GPUSamplerBindingLayout {
    type: 'filtering' | 'non-filtering' | 'comparison';
  }

  interface GPUStorageTextureBindingLayout {
    access: 'write-only' | 'read-only' | 'read-write';
    format: GPUTextureFormat;
    viewDimension?: GPUTextureViewDimension;
  }

  // Resource interfaces
  interface GPUBindingResource {
    buffer?: GPUBuffer;
    texture?: GPUTextureView;
    sampler?: GPUSampler;
    externalTexture?: GPUExternalTexture;
  }

  // Attachment interfaces
  interface GPURenderPassColorAttachment {
    view: GPUTextureView;
    resolveTarget?: GPUTextureView;
    clearValue?: GPUColor | { r: number; g: number; b: number; a: number };
    loadOp: 'clear' | 'load';
    storeOp: 'store' | 'discard';
  }

  interface GPURenderPassDepthStencilAttachment {
    view: GPUTextureView;
    depthClearValue?: number;
    depthLoadOp: 'clear' | 'load';
    depthStoreOp: 'store' | 'discard';
    depthReadOnly?: boolean;
    stencilClearValue?: number;
    stencilLoadOp?: 'clear' | 'load';
    stencilStoreOp?: 'store' | 'discard';
    stencilReadOnly?: boolean;
  }

  // Vertex buffer layout
  interface GPUVertexBufferLayout {
    arrayStride: number;
    stepMode?: GPUVertexStepMode;
    attributes: GPUVertexAttribute[];
  }

  interface GPUVertexAttribute {
    format: GPUVertexFormat;
    offset: number;
    shaderLocation: number;
  }

  // Color target state
  interface GPUColorTargetState {
    format: GPUTextureFormat;
    blend?: GPUBlendState;
    writeMask?: GPUColorWriteFlags;
  }

  // Primitive state
  interface GPUPrimitiveState {
    topology?: GPUPrimitiveTopology;
    stripIndexFormat?: GPUIndexFormat;
    frontFace?: GPUFrontFace;
    cullMode?: GPUCullMode;
    unclippedDepth?: boolean;
  }

  // Depth stencil state
  interface GPUDepthStencilState {
    format: GPUTextureFormat;
    depthWriteEnabled?: boolean;
    depthCompare?: GPUCompareFunction;
    stencilFront?: GPUStencilFaceState;
    stencilBack?: GPUStencilFaceState;
    stencilReadMask?: number;
    stencilWriteMask?: number;
    depthBias?: number;
    depthBiasSlopeScale?: number;
    depthBiasClamp?: number;
  }

  // Multisample state
  interface GPUMultisampleState {
    count?: number;
    mask?: number;
    alphaToCoverageEnabled?: boolean;
  }

  // Blend state
  interface GPUBlendState {
    color: GPUBlendComponent;
    alpha: GPUBlendComponent;
  }

  interface GPUBlendComponent {
    srcFactor?: GPUBlendFactor;
    dstFactor?: GPUBlendFactor;
    operation?: GPUBlendOperation;
  }

  // Stencil face state
  interface GPUStencilFaceState {
    compare?: GPUCompareFunction;
    failOp?: GPUStencilOperation;
    depthFailOp?: GPUStencilOperation;
    passOp?: GPUStencilOperation;
  }

  // Extent and size types
  type GPUExtent3D = [number, number, number] | { width: number; height?: number; depthOrArrayLayers?: number };

  // Enums
  type GPUTextureFormat = 
    | 'r8unorm' | 'r8snorm' | 'r8uint' | 'r8sint'
    | 'r16uint' | 'r16sint' | 'r16float'
    | 'rg8unorm' | 'rg8snorm' | 'rg8uint' | 'rg8sint'
    | 'r32uint' | 'r32sint' | 'r32float'
    | 'rg16uint' | 'rg16sint' | 'rg16float'
    | 'rgba8unorm' | 'rgba8unorm-srgb' | 'rgba8snorm' | 'rgba8uint' | 'rgba8sint'
    | 'bgra8unorm' | 'bgra8unorm-srgb'
    | 'rgb9e5ufloat'
    | 'rgb10a2uint' | 'rgb10a2unorm'
    | 'rg11b10ufloat'
    | 'rg32uint' | 'rg32sint' | 'rg32float'
    | 'rgba16uint' | 'rgba16sint' | 'rgba16float'
    | 'rgba32uint' | 'rgba32sint' | 'rgba32float'
    | 'stencil8' | 'depth16unorm' | 'depth24plus' | 'depth24plus-stencil8' | 'depth32float'
    | 'depth32float-stencil8' | 'bc1-rgba-unorm' | 'bc1-rgba-unorm-srgb'
    | 'bc2-rgba-unorm' | 'bc2-rgba-unorm-srgb' | 'bc3-rgba-unorm' | 'bc3-rgba-unorm-srgb'
    | 'bc4-r-unorm' | 'bc4-r-snorm' | 'bc5-rg-unorm' | 'bc5-rg-snorm'
    | 'bc6h-rgb-ufloat' | 'bc6h-rgb-float' | 'bc7-rgba-unorm' | 'bc7-rgba-unorm-srgb'
    | 'etc2-rgb8unorm' | 'etc2-rgb8unorm-srgb' | 'etc2-rgb8a1unorm' | 'etc2-rgb8a1unorm-srgb'
    | 'etc2-rgba8unorm' | 'etc2-rgba8unorm-srgb' | 'eac-r11unorm' | 'eac-r11snorm'
    | 'eac-rg11unorm' | 'eac-rg11snorm' | 'astc-4x4-unorm' | 'astc-4x4-unorm-srgb'
    | 'astc-5x4-unorm' | 'astc-5x4-unorm-srgb' | 'astc-5x5-unorm' | 'astc-5x5-unorm-srgb'
    | 'astc-6x5-unorm' | 'astc-6x5-unorm-srgb' | 'astc-6x6-unorm' | 'astc-6x6-unorm-srgb'
    | 'astc-8x5-unorm' | 'astc-8x5-unorm-srgb' | 'astc-8x6-unorm' | 'astc-8x6-unorm-srgb'
    | 'astc-8x8-unorm' | 'astc-8x8-unorm-srgb' | 'astc-10x5-unorm' | 'astc-10x5-unorm-srgb'
    | 'astc-10x6-unorm' | 'astc-10x6-unorm-srgb' | 'astc-10x8-unorm' | 'astc-10x8-unorm-srgb'
    | 'astc-10x10-unorm' | 'astc-10x10-unorm-srgb' | 'astc-12x10-unorm' | 'astc-12x10-unorm-srgb'
    | 'astc-12x12-unorm' | 'astc-12x12-unorm-srgb';

  type GPUBufferUsageFlags = number;
  type GPUTextureUsageFlags = number;
  type GPUShaderStageFlags = number;
  type GPUMapModeFlags = number;
  type GPUColorWriteFlags = number;

  type GPUTextureDimension = '1d' | '2d' | '3d';
  type GPUTextureViewDimension = '1d' | '2d' | '2d-array' | 'cube' | 'cube-array' | '3d';
  type GPUCanvasAlphaMode = 'opaque' | 'premultiplied';
  type GPUVertexStepMode = 'vertex' | 'instance';
  type GPUVertexFormat = 
    | 'uint8x2' | 'uint8x4' | 'sint8x2' | 'sint8x4'
    | 'unorm8x2' | 'unorm8x4' | 'snorm8x2' | 'snorm8x4'
    | 'uint16x2' | 'uint16x4' | 'sint16x2' | 'sint16x4'
    | 'unorm16x2' | 'unorm16x4' | 'snorm16x2' | 'snorm16x4'
    | 'float16x2' | 'float16x4' | 'float32' | 'float32x2' | 'float32x3' | 'float32x4'
    | 'uint32' | 'uint32x2' | 'uint32x3' | 'uint32x4'
    | 'sint32' | 'sint32x2' | 'sint32x3' | 'sint32x4';
  type GPUPrimitiveTopology = 'point-list' | 'line-list' | 'line-strip' | 'triangle-list' | 'triangle-strip';
  type GPUIndexFormat = 'uint16' | 'uint32';
  type GPUFrontFace = 'ccw' | 'cw';
  type GPUCullMode = 'none' | 'front' | 'back';
  type GPUCompareFunction = 'never' | 'less' | 'equal' | 'less-equal' | 'greater' | 'not-equal' | 'greater-equal' | 'always';
  type GPUStencilOperation = 'keep' | 'zero' | 'replace' | 'invert' | 'increment-clamp' | 'decrement-clamp' | 'increment-wrap' | 'decrement-wrap';
  type GPUBlendFactor = 'zero' | 'one' | 'src' | 'one-minus-src' | 'src-alpha' | 'one-minus-src-alpha' | 'dst' | 'one-minus-dst' | 'dst-alpha' | 'one-minus-dst-alpha' | 'src-alpha-saturated' | 'constant' | 'one-minus-constant';
  type GPUBlendOperation = 'add' | 'subtract' | 'reverse-subtract' | 'min' | 'max';

  // Color type
  type GPUColor = [number, number, number, number];

  // WebGPU Constants
  const GPUBufferUsage: {
    readonly MAP_READ: 1;
    readonly MAP_WRITE: 2;
    readonly COPY_SRC: 4;
    readonly COPY_DST: 8;
    readonly INDEX: 16;
    readonly VERTEX: 32;
    readonly UNIFORM: 64;
    readonly STORAGE: 128;
    readonly INDIRECT: 256;
    readonly QUERY_RESOLVE: 512;
  };

  const GPUTextureUsage: {
    readonly COPY_SRC: 1;
    readonly COPY_DST: 2;
    readonly TEXTURE_BINDING: 4;
    readonly STORAGE_BINDING: 8;
    readonly RENDER_ATTACHMENT: 16;
  };

  const GPUShaderStage: {
    readonly VERTEX: 1;
    readonly FRAGMENT: 2;
    readonly COMPUTE: 4;
  };

  const GPUMapMode: {
    readonly READ: 1;
    readonly WRITE: 2;
  };

  // Additional interfaces
  interface GPUTextureView {
    // Texture view methods
  }

  interface GPUSampler {
    // Sampler methods
  }

  interface GPUExternalTexture {
    // External texture methods
  }

  interface GPUQuerySet {
    // Query set methods
  }

  interface GPURenderPassTimestampWrites {
    querySet: GPUQuerySet;
    beginningOfPassWriteIndex?: number;
    endOfPassWriteIndex?: number;
  }

  interface GPUComputePassTimestampWrites {
    querySet: GPUQuerySet;
    beginningOfPassWriteIndex?: number;
    endOfPassWriteIndex?: number;
  }
}

export {}; 