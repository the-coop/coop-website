import * as THREE from 'three'
import { Scene } from './scene.js'
import { Network } from './network.js'
import { Input } from './input.js'
import { Control } from './control.js'
import { Entities } from './entities.js'
import { Vehicles } from './vehicles.js'
import { Ghosts } from './ghosts.js'
import { State } from './state.js'
import { ModelLoader } from '@game/shared/core/models.js'

export class Engine {
  static animationId = null
  static lastTime = performance.now()
  static frameCount = 0
  static fps = 0
  static modelsLoaded = false

  static async init(container) {
    // Initialize scene
    Scene.init(container)
    
    // Setup input and controls
    Input.init(container)
    Control.init()
    
    // Load models before connecting
    try {
      await ModelLoader.loadModels(false, true)
      this.modelsLoaded = true
      console.log('All models loaded successfully')
    } catch (error) {
      console.error('Failed to load models:', error)
    }
    
    // Connect to server
    Network.connect()
    
    // Start render loop
    this.animate()
    
    // Handle window resize
    window.addEventListener('resize', this.onWindowResize)
  }

  static animate() {
    this.animationId = requestAnimationFrame(() => this.animate())
    
    // Calculate FPS
    const currentTime = performance.now()
    this.frameCount++
    if (currentTime - this.lastTime >= 1000) {
      State.fps = this.frameCount
      this.frameCount = 0
      this.lastTime = currentTime
    }
    
    // Update animations
    Vehicles.updateAnimations()
    Ghosts.updateCarriedPhysics()
    
    // Send input to server
    Network.sendInput()
    
    // Update camera
    Control.updateCamera()
    
    // Update debug visuals if enabled
    if (State.showDebugInfo) {
      Entities.updateDebugRay()
    }
    
    // Render scene
    Scene.render()
  }

  static onWindowResize() {
    Scene.camera.aspect = window.innerWidth / window.innerHeight
    Scene.camera.updateProjectionMatrix()
    Scene.renderer.setSize(window.innerWidth, window.innerHeight)
  }

  static cleanup() {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId)
    }
    
    Network.disconnect()
    Input.cleanup()
    window.removeEventListener('resize', this.onWindowResize)
    
    // Clean up all meshes
    Entities.cleanup()
    Vehicles.cleanup()
    Ghosts.cleanup()
    Scene.cleanup()
  }
}
