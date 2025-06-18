import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { ModelPaths, ModelLoader } from '@game/shared/core/models.js'

// Static model loader class that extends shared functionality
export class Models {
  static gltfLoader = new GLTFLoader()

  static async loadModel(modelPath) {
    // Get array buffer from shared loader
    const arrayBuffer = await ModelLoader.fetchModel(modelPath, false, true)
    if (!arrayBuffer) return null

    try {
      // Convert ArrayBuffer to Three.js scene
      const gltf = await new Promise((resolve, reject) => {
        this.gltfLoader.parse(
          arrayBuffer,
          '', // Empty string for URL since we're using ArrayBuffer
          (gltf) => resolve(gltf),
          (error) => reject(error)
        )
      })

      const model = gltf.scene.clone()
      
      // Enable shadows on all meshes
      model.traverse((child) => {
        if (child.isMesh) {
          child.castShadow = true
          child.receiveShadow = true
        }
      })
      
      return model
    } catch (error) {
      console.error(`Failed to parse model ${modelPath}:`, error)
      return null
    }
  }

  static async preloadModels() {
    // Use shared preloader to fetch all models
    await ModelLoader.preloadModels(false, true)
    
    // Then convert them all to Three.js scenes
    const modelPaths = Object.values(ModelPaths)
    const promises = modelPaths.map(path => this.loadModel(path))
    
    try {
      await Promise.all(promises)
      console.log('All models converted to Three.js scenes')
    } catch (error) {
      console.error('Error during model conversion:', error)
    }
  }
}