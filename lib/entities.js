import * as THREE from 'three'
import { PlayerConstants } from '@game/shared'
import { Scene } from './scene.js'
import { Models } from '../lib/models'
import { ModelPaths } from '@game/shared/core/models.js'
import { State } from './state.js'
import { Engine } from './engine.js'
import { Control } from './control.js'

export class Entities {
  static players = new Map()
  static playerMeshes = new Map()
  static projectileMeshes = new Map()
  static debugRayHelper = null

  static async addPlayer(playerData) {
    // Try to load player model first
    let group
    const model = Engine.modelsLoaded ? await Models.loadModel(ModelPaths.PLAYER) : null
    
    if (model) {
      group = model
      // Scale and position the model appropriately
      const box = new THREE.Box3().setFromObject(model)
      const size = box.getSize(new THREE.Vector3())
      const scale = PlayerConstants.HEIGHT / size.y
      group.scale.setScalar(scale)
      
      // Update material color for player identification
      group.traverse((child) => {
        if (child.isMesh) {
          child.material = child.material.clone()
          child.material.color = new THREE.Color(
            playerData.id === State.playerId ? 0x0088ff : 0xff8800
          )
        }
      })
    } else {
      // Fallback to basic capsule mesh
      group = new THREE.Group()
      
      // Body - proper capsule geometry matching server physics
      const capsuleRadius = PlayerConstants.RADIUS
      const capsuleHeight = PlayerConstants.HEIGHT - PlayerConstants.RADIUS * 2
      
      const bodyGeometry = new THREE.CapsuleGeometry(
        capsuleRadius,
        capsuleHeight,
        4, 
        8
      )
      const bodyMaterial = new THREE.MeshLambertMaterial({ 
        color: playerData.id === State.playerId ? 0x0088ff : 0xff8800 
      })
      const bodyMesh = new THREE.Mesh(bodyGeometry, bodyMaterial)
      bodyMesh.castShadow = true
      bodyMesh.receiveShadow = true
      
      group.add(bodyMesh)
    }
    
    // Add name tag
    if (playerData.id !== State.playerId) {
      const canvas = document.createElement('canvas')
      const context = canvas.getContext('2d')
      canvas.width = 256
      canvas.height = 64
      context.fillStyle = 'rgba(0, 0, 0, 0.8)'
      context.fillRect(0, 0, canvas.width, canvas.height)
      context.fillStyle = 'white'
      context.font = '24px Arial'
      context.textAlign = 'center'
      context.fillText(`Player ${playerData.id.substring(0, 6)}`, 128, 40)
      
      const texture = new THREE.CanvasTexture(canvas)
      const spriteMaterial = new THREE.SpriteMaterial({ map: texture })
      const sprite = new THREE.Sprite(spriteMaterial)
      sprite.position.y = PlayerConstants.HEIGHT / 2 + 0.5
      sprite.scale.set(2, 0.5, 1)
      group.add(sprite)
    }
    
    Scene.scene.add(group)
    this.playerMeshes.set(playerData.id, group)
    this.players.set(playerData.id, playerData)
  }

  static updatePlayer(playerData) {
    this.players.set(playerData.id, playerData)
    
    // Update mesh position and rotation
    const mesh = this.playerMeshes.get(playerData.id)
    if (mesh) {
      mesh.position.set(
        playerData.position.x,
        playerData.position.y,
        playerData.position.z
      )
      
      // Update rotation based on look direction
      if (playerData.lookDirection) {
        const angle = Math.atan2(playerData.lookDirection.x, playerData.lookDirection.z)
        mesh.rotation.y = angle
      }
    }
  }

  static removePlayer(playerId) {
    const mesh = this.playerMeshes.get(playerId)
    if (mesh) {
      Scene.scene.remove(mesh)
      // Clean up geometries and materials
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
    
    this.playerMeshes.delete(playerId)
    this.players.delete(playerId)
  }

  static addProjectile(projectileData) {
    const geometry = new THREE.SphereGeometry(0.05, 8, 6)
    const material = new THREE.MeshStandardMaterial({ 
      color: 0xffff00,
      emissive: 0xffff00,
      emissiveIntensity: 0.5
    })
    const mesh = new THREE.Mesh(geometry, material)
    
    mesh.position.set(
      projectileData.position.x,
      projectileData.position.y,
      projectileData.position.z
    )
    
    Scene.scene.add(mesh)
    this.projectileMeshes.set(projectileData.id, mesh)
  }

  static updateProjectile(projectileData) {
    const mesh = this.projectileMeshes.get(projectileData.id)
    if (mesh) {
      mesh.position.set(
        projectileData.position.x,
        projectileData.position.y,
        projectileData.position.z
      )
    }
  }

  static removeProjectile(projectileId) {
    const mesh = this.projectileMeshes.get(projectileId)
    if (mesh) {
      Scene.scene.remove(mesh)
      mesh.geometry.dispose()
      mesh.material.dispose()
      this.projectileMeshes.delete(projectileId)
    }
  }

  static updateDebugVisualization() {
    // Remove existing debug helpers
    if (this.debugRayHelper) {
      Scene.scene.remove(this.debugRayHelper)
      this.debugRayHelper.geometry.dispose()
      this.debugRayHelper.material.dispose()
      this.debugRayHelper = null
    }
    
    if (State.showDebugInfo && State.playerId) {
      // Create ground detection rays visualization (multiple rays)
      const rayCount = 5 // Center + 4 corners
      const positions = new Float32Array(rayCount * 6) // 2 vertices per ray, 3 coordinates each
      const colors = new Float32Array(rayCount * 6) // 2 colors per ray, 3 components each
      
      const rayGeometry = new THREE.BufferGeometry()
      rayGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
      rayGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
      
      const rayMaterial = new THREE.LineBasicMaterial({ 
        vertexColors: true,
        linewidth: 2
      })
      
      this.debugRayHelper = new THREE.LineSegments(rayGeometry, rayMaterial)
      Scene.scene.add(this.debugRayHelper)
    }
  }

  static updateDebugRay() {
    if (!this.debugRayHelper || !State.playerId) return
    
    const player = this.players.get(State.playerId)
    if (!player) return
    
    // Update ray positions
    const positions = this.debugRayHelper.geometry.attributes.position.array
    const colors = this.debugRayHelper.geometry.attributes.color.array
    
    // Ray offsets matching server
    const rayOffsets = [
      { x: 0, z: 0 }, // Center
      { x: PlayerConstants.RADIUS * 0.7, z: 0 }, // Right
      { x: -PlayerConstants.RADIUS * 0.7, z: 0 }, // Left
      { x: 0, z: PlayerConstants.RADIUS * 0.7 }, // Front
      { x: 0, z: -PlayerConstants.RADIUS * 0.7 }, // Back
    ]
    
    const rayLength = PlayerConstants.HEIGHT / 2 + 0.5 // Match server ray length
    const groundedColor = { r: 0, g: 1, b: 0 }
    const airborneColor = { r: 1, g: 0, b: 0 }
    const color = player.isGrounded ? groundedColor : airborneColor
    
    for (let i = 0; i < rayOffsets.length; i++) {
      const offset = rayOffsets[i]
      const idx = i * 6 // Each ray has 2 vertices * 3 coordinates
      
      // Ray start (from capsule center)
      positions[idx] = player.position.x + offset.x
      positions[idx + 1] = player.position.y
      positions[idx + 2] = player.position.z + offset.z
      
      // Ray end
      const actualLength = player.groundDistance !== null && player.groundDistance < rayLength ? 
        player.groundDistance : rayLength
      positions[idx + 3] = player.position.x + offset.x
      positions[idx + 4] = player.position.y - actualLength
      positions[idx + 5] = player.position.z + offset.z
      
      // Colors for both vertices
      colors[idx] = color.r
      colors[idx + 1] = color.g
      colors[idx + 2] = color.b
      colors[idx + 3] = color.r
      colors[idx + 4] = color.g
      colors[idx + 5] = color.b
    }
    
    this.debugRayHelper.geometry.attributes.position.needsUpdate = true
    this.debugRayHelper.geometry.attributes.color.needsUpdate = true
  }

  static cleanup() {
    // Clean up all player meshes
    for (const mesh of this.playerMeshes.values()) {
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
    this.playerMeshes.clear()
    this.players.clear()
    
    // Clean up projectiles
    for (const mesh of this.projectileMeshes.values()) {
      Scene.scene.remove(mesh)
      mesh.geometry.dispose()
      mesh.material.dispose()
    }
    this.projectileMeshes.clear()
    
    // Clean up debug helper
    if (this.debugRayHelper) {
      Scene.scene.remove(this.debugRayHelper)
      this.debugRayHelper.geometry.dispose()
      this.debugRayHelper.material.dispose()
      this.debugRayHelper = null
    }
  }
}
