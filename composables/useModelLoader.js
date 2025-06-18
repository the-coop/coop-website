import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { ModelPaths, getModelUrl } from '@game/shared'

const loader = new GLTFLoader()
const modelCache = new Map()

export const useModelLoader = () => {
  const loadModel = async (modelPath) => {
    // Check cache first
    if (modelCache.has(modelPath)) {
      return modelCache.get(modelPath).clone()
    }

    const url = getModelUrl(modelPath, false, true)
    
    try {
      const gltf = await loader.loadAsync(url)
      const model = gltf.scene
      
      // Enable shadows on all meshes
      model.traverse((child) => {
        if (child.isMesh) {
          child.castShadow = true
          child.receiveShadow = true
        }
      })
      
      // Cache the model
      modelCache.set(modelPath, model)
      
      return model.clone()
    } catch (error) {
      console.error(`Failed to load model ${modelPath}:`, error)
      return null
    }
  }

  const preloadModels = async () => {
    const modelPaths = Object.values(ModelPaths)
    const promises = modelPaths.map(path => loadModel(path))
    await Promise.all(promises)
  }

  return {
    loadModel,
    preloadModels,
    ModelPaths
  }
}
