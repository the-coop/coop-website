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
      
      // Parse model structure
      const structure = this.parseModelStructure(model)
      model.userData.structure = structure
      
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

  static parseModelStructure(model) {
    const structure = {
      meshes: new Map(),
      bones: new Map(),
      animations: []
    }
    
    model.traverse((child) => {
      if (child.isMesh) {
        structure.meshes.set(child.name, child)
        console.log(`Found mesh: ${child.name}`)
      } else if (child.isBone) {
        structure.bones.set(child.name, child)
      }
    })
    
    return structure
  }

  static getNamedMesh(model, name) {
    if (!model.userData.structure) return null
    return model.userData.structure.meshes.get(name)
  }
}