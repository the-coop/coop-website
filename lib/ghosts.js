import * as THREE from 'three'
import { GhostTypes, GhostConstants } from '@game/shared'
import { ModelPaths } from '@game/shared/core/models.js'
import { Scene } from './scene.js'
import { Models } from '../lib/models'
import { State } from './state.js'
import { Entities } from './entities.js'
import { Engine } from './engine.js'

export class Ghosts {
  static ghosts = new Map()
  static ghostMeshes = new Map()
  static ghostPhysics = new Map() // Client-side physics simulation

  static async updateGhost(ghostData) {
    const existingGhost = this.ghosts.get(ghostData.id)
    
    if (!existingGhost) {
      // New ghost
      this.ghosts.set(ghostData.id, ghostData)
      await this.createGhostMesh(ghostData)
    } else {
      // Update existing ghost
      this.ghosts.set(ghostData.id, ghostData)
      
      // Update mesh
      const mesh = this.ghostMeshes.get(ghostData.id)
      if (mesh) {
        // Update position only if not being carried by the local player
        if (ghostData.carrier !== State.playerId) {
          mesh.position.set(
            ghostData.position.x,
            ghostData.position.y,
            ghostData.position.z
          )
          
          if (ghostData.rotation) {
            mesh.quaternion.set(
              ghostData.rotation.x,
              ghostData.rotation.y,
              ghostData.rotation.z,
              ghostData.rotation.w
            )
          }
        }
        
        // Update opacity based on carried state
        mesh.traverse((child) => {
          if (child.isMesh && child.material) {
            child.material.opacity = ghostData.carrier ? 0.8 : 1.0
          }
        })
      }
    }
  }

  static async createGhostMesh(ghostData) {
    let mesh
    let modelPath
    
    // Determine model path based on ghost type
    switch (ghostData.type) {
      case GhostTypes.BOX:
        modelPath = ModelPaths.GHOST_BOX
        break
      case GhostTypes.SPHERE:
        modelPath = ModelPaths.GHOST_SPHERE
        break
      case GhostTypes.CYLINDER:
        modelPath = ModelPaths.GHOST_CYLINDER
        break
    }
    
    // Try to load model
    const model = Engine.modelsLoaded ? await Models.loadModel(modelPath) : null
    
    if (model) {
      mesh = model
      
      // Scale to match ghost size
      const box = new THREE.Box3().setFromObject(model)
      const size = box.getSize(new THREE.Vector3())
      
      let scale
      switch (ghostData.type) {
        case GhostTypes.BOX:
          scale = Math.min(
            ghostData.size.width / size.x,
            ghostData.size.height / size.y,
            ghostData.size.depth / size.z
          )
          break
        case GhostTypes.SPHERE:
          scale = (ghostData.size.radius * 2) / Math.max(size.x, size.y, size.z)
          break
        case GhostTypes.CYLINDER:
          scale = Math.min(
            (ghostData.size.radius * 2) / Math.max(size.x, size.z),
            ghostData.size.height / size.y
          )
          break
      }
      
      mesh.scale.setScalar(scale)
      
      // Update material opacity for carried state
      mesh.traverse((child) => {
        if (child.isMesh) {
          child.material = child.material.clone()
          child.material.transparent = true
          child.material.opacity = ghostData.carrier ? 0.8 : 1.0
        }
      })
    } else {
      // Fallback to procedural geometry
      let geometry
      const material = new THREE.MeshLambertMaterial({ 
        color: ghostData.color,
        transparent: true,
        opacity: ghostData.carrier ? 0.8 : 1.0
      })
      
      switch (ghostData.type) {
        case GhostTypes.BOX:
          geometry = new THREE.BoxGeometry(
            ghostData.size.width,
            ghostData.size.height,
            ghostData.size.depth
          )
          break
        case GhostTypes.SPHERE:
          geometry = new THREE.SphereGeometry(ghostData.size.radius, 16, 12)
          break
        case GhostTypes.CYLINDER:
          geometry = new THREE.CylinderGeometry(
            ghostData.size.radius,
            ghostData.size.radius,
            ghostData.size.height,
            16
          )
          break
      }
      
      mesh = new THREE.Mesh(geometry, material)
      mesh.castShadow = true
      mesh.receiveShadow = true
    }
    
    Scene.scene.add(mesh)
    this.ghostMeshes.set(ghostData.id, mesh)
    
    // Initialize client physics for this ghost
    this.ghostPhysics.set(ghostData.id, {
      velocity: { x: 0, y: 0, z: 0 },
      angularVelocity: { x: 0, y: 0, z: 0 }
    })
  }

  static updateCarriedPhysics() {
    // Update physics for ghosts carried by local player
    const player = Entities.players.get(State.playerId)
    if (!player || !player.carryingGhost) return
    
    const ghostData = this.ghosts.get(player.carryingGhost)
    if (!ghostData || ghostData.carrier !== State.playerId) return
    
    const mesh = this.ghostMeshes.get(ghostData.id)
    const physics = this.ghostPhysics.get(ghostData.id)
    
    if (!mesh || !physics) return
    
    // Calculate target position (in front of player)
    const targetPos = new THREE.Vector3(
      player.position.x + player.lookDirection.x * GhostConstants.CARRY_DISTANCE,
      player.position.y + 0.5 + player.lookDirection.y * GhostConstants.CARRY_DISTANCE,
      player.position.z + player.lookDirection.z * GhostConstants.CARRY_DISTANCE
    )
    
    // Spring physics for smooth movement
    const springStrength = 0.2
    const damping = 0.8
    
    // Calculate spring force
    const dx = targetPos.x - mesh.position.x
    const dy = targetPos.y - mesh.position.y
    const dz = targetPos.z - mesh.position.z
    
    physics.velocity.x = physics.velocity.x * damping + dx * springStrength
    physics.velocity.y = physics.velocity.y * damping + dy * springStrength
    physics.velocity.z = physics.velocity.z * damping + dz * springStrength
    
    // Apply velocity
    mesh.position.x += physics.velocity.x
    mesh.position.y += physics.velocity.y
    mesh.position.z += physics.velocity.z
    
    // Rotate based on movement
    physics.angularVelocity.x *= 0.9
    physics.angularVelocity.y *= 0.9
    physics.angularVelocity.z = physics.velocity.x * 0.1
    
    mesh.rotation.x += physics.angularVelocity.x
    mesh.rotation.y += physics.angularVelocity.y
    mesh.rotation.z += physics.angularVelocity.z
  }

  static cleanup() {
    // Clean up ghost meshes
    for (const mesh of this.ghostMeshes.values()) {
      Scene.scene.remove(mesh)
      mesh.traverse((child) => {
        if (child.geometry) child.geometry.dispose()
        if (child.material) {
          if (Array.isArray(child.material)) {
            child.material.forEach(material => material.dispose())
          } else {
            child.material.dispose()
          }
        }
      })
    }
    this.ghostMeshes.clear()
    this.ghosts.clear()
    this.ghostPhysics.clear()
  }
}
