import * as THREE from 'three'
import { VehicleConstants, VehicleTypes } from '@game/shared'
import { ModelPaths } from '@game/shared/core/models.js'
import { Scene } from './scene.js'
import { Models } from '../lib/models'
import { State } from './state.js'
import { Engine } from './engine.js'

export class Vehicles {
  static vehicles = new Map()
  static vehicleMeshes = new Map()

  static async updateVehicle(vehicleData) {
    const existingVehicle = this.vehicles.get(vehicleData.id)
    
    if (!existingVehicle) {
      // New vehicle
      this.vehicles.set(vehicleData.id, vehicleData)
      await this.createVehicleMesh(vehicleData)
    } else {
      // Update existing vehicle
      this.vehicles.set(vehicleData.id, vehicleData)
      
      // Update mesh position and rotation
      const mesh = this.vehicleMeshes.get(vehicleData.id)
      if (mesh) {
        mesh.position.set(
          vehicleData.position.x,
          vehicleData.position.y,
          vehicleData.position.z
        )
        
        if (vehicleData.rotation && vehicleData.rotation.w !== undefined) {
          mesh.quaternion.set(
            vehicleData.rotation.x,
            vehicleData.rotation.y,
            vehicleData.rotation.z,
            vehicleData.rotation.w
          )
        }
        
        // Store altitude for landing gear animation
        if (vehicleData.type === VehicleTypes.HELICOPTER) {
          mesh.userData.altitude = vehicleData.position.y
        }
      }
      
      // Update current vehicle reference
      if (vehicleData.driver === State.playerId) {
        State.currentVehicle = vehicleData.id
      } else if (State.currentVehicle === vehicleData.id && vehicleData.driver !== State.playerId) {
        State.currentVehicle = null
      }
    }
  }

  static async createVehicleMesh(vehicleData) {
    let group
    let modelPath
    
    // Determine model path based on vehicle type
    switch (vehicleData.type) {
      case VehicleTypes.HELICOPTER:
        modelPath = ModelPaths.HELICOPTER
        break
      case VehicleTypes.PLANE:
        modelPath = ModelPaths.PLANE
        break
      default:
        modelPath = ModelPaths.CAR
    }
    
    // Try to load model
    const model = Engine.modelsLoaded ? await Models.loadModel(modelPath) : null
    
    if (model) {
      group = model
      
      // Scale model to match vehicle constants
      const box = new THREE.Box3().setFromObject(model)
      const size = box.getSize(new THREE.Vector3())
      
      let targetSize
      switch (vehicleData.type) {
        case VehicleTypes.HELICOPTER:
          targetSize = VehicleConstants.HELICOPTER_SIZE
          break
        case VehicleTypes.PLANE:
          targetSize = VehicleConstants.PLANE_SIZE
          break
        default:
          targetSize = VehicleConstants.CAR_SIZE
      }
      
      const scaleX = targetSize.width / size.x
      const scaleY = targetSize.height / size.y
      const scaleZ = targetSize.length / size.z
      const scale = Math.min(scaleX, scaleY, scaleZ)
      group.scale.setScalar(scale)
      
      // Adjust position to match server physics collider
      if (vehicleData.type === VehicleTypes.HELICOPTER) {
        // The server creates the collider with its center at the vehicle position
        // We need to ensure the visual model aligns with this
        const scaledBox = new THREE.Box3().setFromObject(group)
        const modelBottom = scaledBox.min.y
        
        // Create a wrapper group to handle the offset
        const wrapper = new THREE.Group()
        wrapper.add(group)
        
        // The physics collider is centered at the spawn position
        // Move the model up so its bottom aligns with the bottom of the physics collider
        // Physics collider bottom = position.y - (height/2)
        // We want model bottom to match this, so offset the model up
        const physicsHeight = targetSize.height
        const offsetY = -modelBottom - physicsHeight / 2
        group.position.y = offsetY
        
        group = wrapper
      }
      
      // Find animated parts
      const actualModel = group.children[0] || group
      if (vehicleData.type === VehicleTypes.HELICOPTER) {
        const mainRotor = Models.getNamedMesh(actualModel, 'MainRotor')
        if (mainRotor) {
          // Store the original rotation to preserve any tilt
          group.userData.mainRotor = mainRotor
          group.userData.mainRotorOriginalRotation = mainRotor.rotation.clone()
        }
        
        const tailRotor = Models.getNamedMesh(actualModel, 'TailRotor')
        if (tailRotor) {
          group.userData.tailRotor = tailRotor
          group.userData.tailRotorOriginalRotation = tailRotor.rotation.clone()
        }
        
        // Find landing gear parts
        const leftGear = Models.getNamedMesh(actualModel, 'LeftGear') || 
                        Models.getNamedMesh(actualModel, 'LeftLandingGear') ||
                        Models.getNamedMesh(actualModel, 'LGear')
        const rightGear = Models.getNamedMesh(actualModel, 'RightGear') || 
                         Models.getNamedMesh(actualModel, 'RightLandingGear') ||
                         Models.getNamedMesh(actualModel, 'RGear')
        const frontGear = Models.getNamedMesh(actualModel, 'FrontGear') || 
                         Models.getNamedMesh(actualModel, 'NoseGear') ||
                         Models.getNamedMesh(actualModel, 'FGear')
        const rearGear = Models.getNamedMesh(actualModel, 'RearGear') || 
                        Models.getNamedMesh(actualModel, 'TailGear')
        
        // Store gear references and original rotations
        if (leftGear) {
          group.userData.leftGear = leftGear
          group.userData.leftGearOriginalRotation = leftGear.rotation.clone()
          group.userData.leftGearOriginalPosition = leftGear.position.clone()
        }
        if (rightGear) {
          group.userData.rightGear = rightGear
          group.userData.rightGearOriginalRotation = rightGear.rotation.clone()
          group.userData.rightGearOriginalPosition = rightGear.position.clone()
        }
        if (frontGear) {
          group.userData.frontGear = frontGear
          group.userData.frontGearOriginalRotation = frontGear.rotation.clone()
          group.userData.frontGearOriginalPosition = frontGear.position.clone()
        }
        if (rearGear) {
          group.userData.rearGear = rearGear
          group.userData.rearGearOriginalRotation = rearGear.rotation.clone()
          group.userData.rearGearOriginalPosition = rearGear.position.clone()
        }
        
        // Initialize gear state
        group.userData.gearExtended = true
        group.userData.gearTransition = 0 // 0 = extended, 1 = retracted
      } else if (vehicleData.type === VehicleTypes.PLANE) {
        const propeller = actualModel.getObjectByName('propeller') || 
                         actualModel.getObjectByName('prop')
        if (propeller) group.userData.propeller = propeller
      }
    } else {
      // Fallback to procedural meshes
      group = new THREE.Group()
      
      if (vehicleData.type === VehicleTypes.HELICOPTER) {
        // Helicopter body
        const bodyGeometry = new THREE.BoxGeometry(
          VehicleConstants.HELICOPTER_SIZE.width,
          VehicleConstants.HELICOPTER_SIZE.height * 0.6,
          VehicleConstants.HELICOPTER_SIZE.length
        )
        const bodyMaterial = new THREE.MeshLambertMaterial({ color: 0x445566 })
        const bodyMesh = new THREE.Mesh(bodyGeometry, bodyMaterial)
        bodyMesh.castShadow = true
        bodyMesh.receiveShadow = true
        
        // Cockpit
        const cockpitGeometry = new THREE.SphereGeometry(1.2, 8, 6)
        const cockpitMaterial = new THREE.MeshLambertMaterial({ color: 0x222233 })
        const cockpitMesh = new THREE.Mesh(cockpitGeometry, cockpitMaterial)
        cockpitMesh.position.z = -1.5
        cockpitMesh.scale.z = 1.5
        cockpitMesh.castShadow = true
        
        // Main rotor (simplified)
        const rotorGeometry = new THREE.CylinderGeometry(0.1, 0.1, 0.1, 8)
        const rotorMaterial = new THREE.MeshLambertMaterial({ color: 0x333333 })
        const rotorHub = new THREE.Mesh(rotorGeometry, rotorMaterial)
        rotorHub.position.y = 1
        
        // Rotor blades
        const bladeGeometry = new THREE.BoxGeometry(8, 0.05, 0.3)
        const bladeMaterial = new THREE.MeshLambertMaterial({ color: 0x222222 })
        const rotorBlades = new THREE.Mesh(bladeGeometry, bladeMaterial)
        rotorBlades.position.y = 1.1
        
        // Tail
        const tailGeometry = new THREE.CylinderGeometry(0.3, 0.5, 3, 8)
        const tailMaterial = new THREE.MeshLambertMaterial({ color: 0x445566 })
        const tailMesh = new THREE.Mesh(tailGeometry, tailMaterial)
        tailMesh.rotation.z = Math.PI / 2
        tailMesh.position.z = 3
        tailMesh.castShadow = true
        
        group.add(bodyMesh)
        group.add(cockpitMesh)
        group.add(rotorHub)
        group.add(rotorBlades)
        group.add(tailMesh)
        
        // Store rotor reference for animation
        group.userData.rotor = rotorBlades
    
      } else if (vehicleData.type === VehicleTypes.PLANE) {
        // Plane fuselage
        const fuselageGeometry = new THREE.CylinderGeometry(0.8, 0.8, VehicleConstants.PLANE_SIZE.length, 8)
        const fuselageMaterial = new THREE.MeshLambertMaterial({ color: 0xcccccc })
        const fuselageMesh = new THREE.Mesh(fuselageGeometry, fuselageMaterial)
        fuselageMesh.rotation.z = Math.PI / 2
        fuselageMesh.castShadow = true
        fuselageMesh.receiveShadow = true
        
        // Wings
        const wingGeometry = new THREE.BoxGeometry(VehicleConstants.PLANE_SIZE.width, 0.2, 1.5)
        const wingMaterial = new THREE.MeshLambertMaterial({ color: 0xaaaaaa })
        const wingMesh = new THREE.Mesh(wingGeometry, wingMaterial)
        wingMesh.castShadow = true
        
        // Tail wing
        const tailWingGeometry = new THREE.BoxGeometry(2, 0.2, 0.8)
        const tailWingMesh = new THREE.Mesh(tailWingGeometry, wingMaterial)
        tailWingMesh.position.z = 2
        tailWingMesh.castShadow = true
        
        // Vertical stabilizer
        const stabilizerGeometry = new THREE.BoxGeometry(0.2, 1.5, 0.8)
        const stabilizerMesh = new THREE.Mesh(stabilizerGeometry, wingMaterial)
        stabilizerMesh.position.z = 2
        stabilizerMesh.position.y = 0.5
        stabilizerMesh.castShadow = true
        
        // Cockpit
        const cockpitGeometry = new THREE.SphereGeometry(0.6, 8, 6)
        const cockpitMaterial = new THREE.MeshLambertMaterial({ color: 0x333344 })
        const cockpitMesh = new THREE.Mesh(cockpitGeometry, cockpitMaterial)
        cockpitMesh.position.z = -2
        cockpitMesh.position.y = 0.3
        cockpitMesh.scale.z = 1.5
        
        // Propeller
        const propGeometry = new THREE.BoxGeometry(0.1, 2, 0.2)
        const propMaterial = new THREE.MeshLambertMaterial({ color: 0x444444 })
        const propeller = new THREE.Mesh(propGeometry, propMaterial)
        propeller.position.z = -2.5
        
        group.add(fuselageMesh)
        group.add(wingMesh)
        group.add(tailWingMesh)
        group.add(stabilizerMesh)
        group.add(cockpitMesh)
        group.add(propeller)
        
        // Store propeller reference for animation
        group.userData.propeller = propeller
      
      } else {
        // Existing car creation code
        const bodyGeometry = new THREE.BoxGeometry(
          VehicleConstants.CAR_SIZE.width,
          VehicleConstants.CAR_SIZE.height,
          VehicleConstants.CAR_SIZE.length
        )
        const bodyMaterial = new THREE.MeshLambertMaterial({ color: 0x4444ff })
        const bodyMesh = new THREE.Mesh(bodyGeometry, bodyMaterial)
        bodyMesh.position.y = 0.2
        bodyMesh.castShadow = true
        bodyMesh.receiveShadow = true
        
        // Car roof
        const roofGeometry = new THREE.BoxGeometry(
          VehicleConstants.CAR_SIZE.width * 0.8,
          VehicleConstants.CAR_SIZE.height * 0.6,
          VehicleConstants.CAR_SIZE.length * 0.5
        )
        const roofMaterial = new THREE.MeshLambertMaterial({ color: 0x3333cc })
        const roofMesh = new THREE.Mesh(roofGeometry, roofMaterial)
        roofMesh.position.y = VehicleConstants.CAR_SIZE.height * 0.8
        roofMesh.castShadow = true
        
        // Wheels
        const wheelGeometry = new THREE.CylinderGeometry(0.3, 0.3, 0.2, 8)
        const wheelMaterial = new THREE.MeshLambertMaterial({ color: 0x222222 })
        
        const wheelPositions = [
          { x: -0.8, z: -1.5 },
          { x: 0.8, z: -1.5 },
          { x: -0.8, z: 1.5 },
          { x: 0.8, z: 1.5 }
        ]
        
        for (const pos of wheelPositions) {
          const wheel = new THREE.Mesh(wheelGeometry, wheelMaterial)
          wheel.rotation.z = Math.PI / 2
          wheel.position.set(pos.x, -0.3, pos.z)
          wheel.castShadow = true
          group.add(wheel)
        }
        
        group.add(bodyMesh)
        group.add(roofMesh)
      }
    }
    
    Scene.scene.add(group)
    this.vehicleMeshes.set(vehicleData.id, group)
  }

  static updateAnimations() {
    for (const [vehicleId, mesh] of this.vehicleMeshes) {
      const vehicle = this.vehicles.get(vehicleId)
      if (!vehicle) continue
      
      // Animate helicopter rotors and landing gear
      if (vehicle.type === VehicleTypes.HELICOPTER) {
        // Animate main rotor while preserving its tilt
        if (mesh.userData.mainRotor && mesh.userData.mainRotorOriginalRotation) {
          const rotor = mesh.userData.mainRotor
          const originalRotation = mesh.userData.mainRotorOriginalRotation
          
          // Create a rotation around local Y-axis
          const rotationSpeed = 0.5
          const time = Date.now() * 0.001
          
          // Reset to original rotation then apply spin
          rotor.rotation.copy(originalRotation)
          rotor.rotateY(time * rotationSpeed * Math.PI * 2)
        }
        
        // Animate tail rotor
        if (mesh.userData.tailRotor && mesh.userData.tailRotorOriginalRotation) {
          const tailRotor = mesh.userData.tailRotor
          const originalRotation = mesh.userData.tailRotorOriginalRotation
          
          // Tail rotor typically spins around Z axis (forward/back)
          const rotationSpeed = 0.8
          const time = Date.now() * 0.001
          
          // Reset to original rotation
          tailRotor.rotation.copy(originalRotation)
          
          // Tail rotors rotate around their local Z axis
          tailRotor.rotateZ(time * rotationSpeed * Math.PI * 2)
        }
        
        // Animate landing gear retraction/extension
        const targetGearState = vehicle.altitude > 5 ? 1 : 0 // Retract when above 5 meters
        const gearSpeed = 0.02 // Speed of gear animation
        
        if (mesh.userData.gearTransition !== undefined) {
          // Smoothly transition gear state
          if (targetGearState > mesh.userData.gearTransition) {
            mesh.userData.gearTransition = Math.min(mesh.userData.gearTransition + gearSpeed, 1)
          } else if (targetGearState < mesh.userData.gearTransition) {
            mesh.userData.gearTransition = Math.max(mesh.userData.gearTransition - gearSpeed, 0)
          }
          
          const t = mesh.userData.gearTransition
          
          // Animate left gear
          if (mesh.userData.leftGear && mesh.userData.leftGearOriginalRotation) {
            const gear = mesh.userData.leftGear
            const originalRot = mesh.userData.leftGearOriginalRotation
            
            // Rotate forward and up when retracting
            gear.rotation.copy(originalRot)
            gear.rotateX(t * Math.PI * 0.5) // 90 degrees rotation
          }
          
          // Animate right gear
          if (mesh.userData.rightGear && mesh.userData.rightGearOriginalRotation) {
            const gear = mesh.userData.rightGear
            const originalRot = mesh.userData.rightGearOriginalRotation
            
            // Rotate forward and up when retracting
            gear.rotation.copy(originalRot)
            gear.rotateX(t * Math.PI * 0.5) // 90 degrees rotation
          }
          
          // Animate front gear (if exists)
          if (mesh.userData.frontGear && mesh.userData.frontGearOriginalRotation) {
            const gear = mesh.userData.frontGear
            const originalRot = mesh.userData.frontGearOriginalRotation
            
            // Rotate backward and up when retracting
            gear.rotation.copy(originalRot)
            gear.rotateX(-t * Math.PI * 0.5) // -90 degrees rotation
          }
          
          // Animate rear gear (if exists)
          if (mesh.userData.rearGear && mesh.userData.rearGearOriginalRotation) {
            const gear = mesh.userData.rearGear
            const originalRot = mesh.userData.rearGearOriginalRotation
            
            // Rotate up when retracting
            gear.rotation.copy(originalRot)
            gear.rotateX(t * Math.PI * 0.4) // 72 degrees rotation
          }
          
          mesh.userData.gearExtended = t < 0.5
        }
      }
      
      // Animate plane propeller
      if (vehicle.type === VehicleTypes.PLANE && mesh.userData.propeller) {
        const throttle = vehicle.throttle || 0
        mesh.userData.propeller.rotation.z += 0.3 + throttle * 0.5
      }
    }
  }

  static cleanup() {
    // Clean up vehicle meshes
    for (const mesh of this.vehicleMeshes.values()) {
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
    this.vehicleMeshes.clear()
    this.vehicles.clear()
  }
}