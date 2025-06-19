import * as THREE from 'three'
import { MessageTypes, VehicleConstants, PlayerConstants, GhostConstants } from '@game/shared'
import { Scene } from './scene.js'
import { Network } from './network.js'
import { Entities } from './entities.js'
import { Vehicles } from './vehicles.js'
import { Ghosts } from './ghosts.js'
import { State } from './state.js'

export class Control {
  static cameraRotation = { x: 0, y: 0 }

  static init() {
    // No callbacks needed anymore!
  }

  static updateCamera() {
    if (!State.playerId || !Entities.players.has(State.playerId)) return
    
    const player = Entities.players.get(State.playerId)
    
    if (State.currentVehicle) {
      // Third-person vehicle camera
      const vehicle = Vehicles.vehicles.get(State.currentVehicle)
      if (vehicle) {
        // Calculate camera position behind vehicle
        const vehicleRotation = new THREE.Quaternion()
        if (vehicle.rotation && vehicle.rotation.w !== undefined) {
          vehicleRotation.set(
            vehicle.rotation.x,
            vehicle.rotation.y,
            vehicle.rotation.z,
            vehicle.rotation.w
          )
        }
        
        // Create offset vector behind and above vehicle
        const offset = new THREE.Vector3(0, 5, 10)
        offset.applyQuaternion(vehicleRotation)
        
        // Set camera position
        Scene.camera.position.set(
          vehicle.position.x + offset.x,
          vehicle.position.y + offset.y,
          vehicle.position.z + offset.z
        )
        
        // Look at vehicle
        Scene.camera.lookAt(
          vehicle.position.x,
          vehicle.position.y + 2,
          vehicle.position.z
        )
      }
    } else if (State.thirdPerson) {
      // Third-person player camera
      const distance = 5
      const height = 3
      
      // Calculate camera offset based on look direction
      const offset = new THREE.Vector3(
        Math.sin(this.cameraRotation.y) * distance,
        height,
        Math.cos(this.cameraRotation.y) * distance
      )
      
      Scene.camera.position.set(
        player.position.x + offset.x,
        player.position.y + offset.y,
        player.position.z + offset.z
      )
      
      // Look at player center
      Scene.camera.lookAt(
        player.position.x,
        player.position.y,
        player.position.z
      )
    } else {
      // First-person camera - at eye level
      const eyeHeight = PlayerConstants.HEIGHT / 2 - 0.1
      Scene.camera.position.set(
        player.position.x,
        player.position.y + eyeHeight,
        player.position.z
      )
      
      // Apply rotation
      Scene.camera.rotation.order = 'YXZ'
      Scene.camera.rotation.y = this.cameraRotation.y
      Scene.camera.rotation.x = this.cameraRotation.x
    }
  }

  static getLookDirection() {
    const direction = new THREE.Vector3(0, 0, -1)
    direction.applyQuaternion(Scene.camera.quaternion)
    return { x: direction.x, y: direction.y, z: direction.z }
  }

  static handleVehicleInteraction() {
    if (!State.playerId || !State.connected) return
    
    if (State.currentVehicle) {
      // Exit vehicle
      Network.send({
        type: MessageTypes.EXIT_VEHICLE
      })
    } else if (State.nearbyVehicle) {
      // Enter vehicle
      Network.send({
        type: MessageTypes.ENTER_VEHICLE,
        vehicleId: State.nearbyVehicle
      })
    }
  }

  static handleGhostInteraction() {
    if (!State.playerId || !State.connected || State.currentVehicle) return
    
    const player = Entities.players.get(State.playerId)
    if (!player) return
    
    if (player.carryingGhost) {
      // Drop ghost
      Network.send({
        type: MessageTypes.DROP_GHOST
      })
    } else if (State.nearbyGhost) {
      // Grab ghost
      Network.send({
        type: MessageTypes.GRAB_GHOST,
        ghostId: State.nearbyGhost
      })
    }
  }

  static handleShoot() {
    if (!State.playerId || !State.connected) return
    
    const player = Entities.players.get(State.playerId)
    if (!player) return
    
    // If carrying a ghost, throw it instead of shooting
    if (player.carryingGhost) {
      const direction = new THREE.Vector3(0, 0, -1)
      direction.applyQuaternion(Scene.camera.quaternion)
      direction.normalize()
      
      Network.send({
        type: MessageTypes.THROW_GHOST,
        direction: { x: direction.x, y: direction.y, z: direction.z }
      })
      return
    }
    
    // Calculate shooting direction from camera
    const direction = new THREE.Vector3(0, 0, -1)
    direction.applyQuaternion(Scene.camera.quaternion)
    direction.normalize()
    
    // Shoot from slightly in front of player
    const origin = {
      x: player.position.x + direction.x * 1,
      y: player.position.y + 1.5,
      z: player.position.z + direction.z * 1
    }
    
    Network.send({
      type: MessageTypes.FIRE,
      direction: { x: direction.x, y: direction.y, z: direction.z },
      origin: origin
    })
  }

  static checkNearbyVehicles() {
    if (!State.playerId || State.currentVehicle) {
      State.nearbyVehicle = null
      return
    }
    
    const player = Entities.players.get(State.playerId)
    if (!player) return
    
    let closestVehicle = null
    let closestDistance = VehicleConstants.INTERACTION_RANGE
    
    for (const [vehicleId, vehicle] of Vehicles.vehicles) {
      if (vehicle.driver) continue // Skip occupied vehicles
      
      const distance = Math.sqrt(
        (player.position.x - vehicle.position.x) ** 2 +
        (player.position.y - vehicle.position.y) ** 2 +
        (player.position.z - vehicle.position.z) ** 2
      )
      
      if (distance < closestDistance) {
        closestDistance = distance
        closestVehicle = vehicleId
      }
    }
    
    State.nearbyVehicle = closestVehicle
  }

  static checkNearbyGhosts() {
    const player = Entities.players.get(State.playerId)
    if (!State.playerId || (player && player.carryingGhost) || State.currentVehicle) {
      State.nearbyGhost = null
      return
    }
    
    if (!player) return
    
    let closestGhost = null
    let closestDistance = GhostConstants.INTERACTION_RANGE
    
    for (const [ghostId, ghost] of Ghosts.ghosts) {
      if (ghost.carrier) continue // Skip carried ghosts
      
      const distance = Math.sqrt(
        (player.position.x - ghost.position.x) ** 2 +
        (player.position.y - ghost.position.y) ** 2 +
        (player.position.z - ghost.position.z) ** 2
      )
      
      if (distance < closestDistance) {
        closestDistance = distance
        closestGhost = ghostId
      }
    }
    
    State.nearbyGhost = closestGhost
  }

  static toggleThirdPerson() {
    State.thirdPerson = !State.thirdPerson
  }

  static toggleDebugInfo() {
    State.showDebugInfo = !State.showDebugInfo
    Entities.updateDebugVisualization()
  }
}