import { WebGPUModel } from './WebGPUModel.js'

export class WebGPUController {
  constructor() {
    this.model = new WebGPUModel()
    this.animationFrameId = null
    this.errorMessage = ''
  }

  async initialize(canvas, shaderCode, imageUrl = null) {
    try {
      await this.model.initialize(canvas, shaderCode, imageUrl)
      this.setupEventListeners(canvas)
      this.startRenderLoop()
      return {
        canvasWidth: this.model.canvasWidth,
        canvasHeight: this.model.canvasHeight
      }
    } catch (error) {
      this.errorMessage = error.message
      return {
        error: this.errorMessage
      }
    }
  }

  setupEventListeners(canvas) {
    canvas.addEventListener('mousemove', (event) => this.handleMouseMove(event, canvas))
  }

  handleMouseMove(event, canvas) {
    const rect = canvas.getBoundingClientRect()
    
    // Calculate the scaling factor between the canvas's display size and its internal size
    const scaleX = this.model.canvasWidth / rect.width
    const scaleY = this.model.canvasHeight / rect.height
    
    // Convert client coordinates to normalized coordinates (0-1)
    // Apply scaling to account for any canvas resizing
    let mouseX = ((event.clientX - rect.left) * scaleX) / this.model.canvasWidth
    let mouseY = ((event.clientY - rect.top) * scaleY) / this.model.canvasHeight
    
    // Clamp values between 0 and 1
    mouseX = Math.max(0, Math.min(1, mouseX))
    mouseY = Math.max(0, Math.min(1, mouseY))
    
    // Update the model with new mouse position
    this.model.updateMousePosition(mouseX, mouseY)
  }

  startRenderLoop() {
    const renderFrame = () => {
      this.model.render()
      this.animationFrameId = requestAnimationFrame(renderFrame)
    }
    
    renderFrame()
  }

  cleanup() {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId)
    }
  }
} 