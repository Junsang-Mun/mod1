import { SPHModel } from './SPHModel.js'
import sphShaderCode from './sph.wgsl'

export class SPHController {
  constructor() {
    this.model = new SPHModel()
    this.canvas = null
    this.animationFrameId = null
    this.lastFrameTime = 0
    this.isSimulationRunning = false
    
    // Mouse interaction state
    this.isMouseDown = false
    this.lastMouseX = 0
    this.lastMouseY = 0
  }
  
  async initialize(canvas, config = {}) {
    this.canvas = canvas
    
    try {
      await this.model.initialize(canvas, config, sphShaderCode)
      this.setupEventListeners()
      this.startRenderLoop()
      this.isSimulationRunning = true
      return true
    } catch (error) {
      console.error('SPH 시뮬레이션 초기화 오류:', error)
      throw error
    }
  }
  
  setupEventListeners() {
    // Mouse events for interaction
    this.canvas.addEventListener('mousedown', this.handleMouseDown.bind(this))
    this.canvas.addEventListener('mousemove', this.handleMouseMove.bind(this))
    this.canvas.addEventListener('mouseup', this.handleMouseUp.bind(this))
    this.canvas.addEventListener('mouseleave', this.handleMouseUp.bind(this))
    
    // Touch events for mobile
    this.canvas.addEventListener('touchstart', this.handleTouchStart.bind(this))
    this.canvas.addEventListener('touchmove', this.handleTouchMove.bind(this))
    this.canvas.addEventListener('touchend', this.handleTouchEnd.bind(this))
  }
  
  handleMouseDown(event) {
    this.isMouseDown = true
    const rect = this.canvas.getBoundingClientRect()
    this.lastMouseX = (event.clientX - rect.left) / rect.width
    this.lastMouseY = (event.clientY - rect.top) / rect.height
  }
  
  handleMouseMove(event) {
    if (!this.isMouseDown) return
    
    const rect = this.canvas.getBoundingClientRect()
    const mouseX = (event.clientX - rect.left) / rect.width
    const mouseY = (event.clientY - rect.top) / rect.height
    
    // Apply force at mouse position with default strength
    this.applyForceAtPoint(mouseX, mouseY)
    
    this.lastMouseX = mouseX
    this.lastMouseY = mouseY
  }
  
  handleMouseUp() {
    this.isMouseDown = false
  }
  
  handleTouchStart(event) {
    event.preventDefault()
    if (event.touches.length > 0) {
      this.isMouseDown = true
      const rect = this.canvas.getBoundingClientRect()
      const touch = event.touches[0]
      this.lastMouseX = (touch.clientX - rect.left) / rect.width
      this.lastMouseY = (touch.clientY - rect.top) / rect.height
    }
  }
  
  handleTouchMove(event) {
    event.preventDefault()
    if (!this.isMouseDown || event.touches.length === 0) return
    
    const rect = this.canvas.getBoundingClientRect()
    const touch = event.touches[0]
    const mouseX = (touch.clientX - rect.left) / rect.width
    const mouseY = (touch.clientY - rect.top) / rect.height
    
    // Apply force at touch position
    this.applyForceAtPoint(mouseX, mouseY)
    
    this.lastMouseX = mouseX
    this.lastMouseY = mouseY
  }
  
  handleTouchEnd(event) {
    event.preventDefault()
    this.isMouseDown = false
  }
  
  applyForceAtPoint(x, y, strength = 0.5) {
    if (this.model && this.isSimulationRunning) {
      this.model.addInteractionForce(x, y, strength)
    }
  }
  
  startRenderLoop() {
    const renderFrame = () => {
      const now = performance.now()
      const dt = now - this.lastFrameTime
      this.lastFrameTime = now
      
      if (this.model && this.isSimulationRunning) {
        this.model.render()
      }
      
      this.animationFrameId = requestAnimationFrame(renderFrame)
    }
    
    this.lastFrameTime = performance.now()
    renderFrame()
  }
  
  updateSimulationParams(params) {
    if (this.model && this.isSimulationRunning) {
      this.model.updateSimulationParams(params)
    }
  }
  
  resetParticles(particleCount) {
    if (this.model && this.isSimulationRunning) {
      this.model.resetParticles(particleCount)
    }
  }
  
  pauseSimulation() {
    this.isSimulationRunning = false
  }
  
  resumeSimulation() {
    this.isSimulationRunning = true
  }
  
  cleanup() {
    // Stop render loop
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId)
      this.animationFrameId = null
    }
    
    // Remove event listeners
    if (this.canvas) {
      this.canvas.removeEventListener('mousedown', this.handleMouseDown)
      this.canvas.removeEventListener('mousemove', this.handleMouseMove)
      this.canvas.removeEventListener('mouseup', this.handleMouseUp)
      this.canvas.removeEventListener('mouseleave', this.handleMouseUp)
      this.canvas.removeEventListener('touchstart', this.handleTouchStart)
      this.canvas.removeEventListener('touchmove', this.handleTouchMove)
      this.canvas.removeEventListener('touchend', this.handleTouchEnd)
    }
    
    this.isSimulationRunning = false
  }
} 