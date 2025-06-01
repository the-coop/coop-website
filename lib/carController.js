import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { Pyrotechnics } from './pyrotechnics.js';
import { createCarModel } from './models/car.js';

export class CarController {
  constructor(scene, physics, position = new THREE.Vector3(0, 5, 0)) {
    this.scene = scene;
    this.physics = physics;
    
    // Add pyrotechnics system if needed
    this.pyrotechnics = new Pyrotechnics(scene.scene);
    
    // Car properties
    this.chassisSize = new THREE.Vector3(2, 0.5, 4);
    this.wheelRadius = 0.4;
    this.wheelWidth = 0.3;
    
    // Movement properties - increased for stronger gravity
    this.motorSpeed = 40;  // Increased from 20
    this.motorForce = 50;  // Increased from 10
    this.steerAngle = 0;
    this.maxSteerAngle = 0.5;
    this.steerSpeed = 3;
    
    // Collision groups - using proper bit patterns
    // Format: (membership << 16) | filter
    // membership = what group this object belongs to
    // filter = what groups this object can collide with
    this.COLLISION_GROUPS = {
      CHASSIS: 0x0001,
      WHEELS: 0x0002,
      WORLD: 0x0004,
      ALL: 0xFFFF
    };
    
    // State
    this.isOccupied = false;
    this.currentPlayer = null;
    this.isGrounded = true; // Add grounding state
    
    // Multiplayer state
    this.isMultiplayer = false;
    this.objectId = null;
    
    // Physics objects
    this.chassisBody = null;
    this.wheelBodies = [];
    this.wheelJoints = [];
    
    // Visual objects
    this.chassisMesh = null;
    this.wheelMeshes = [];
    
    // Input state - will be set by player when entering
    this.keys = null;
    
    // Control state for vehicle-specific controls
    this.controls = {
      forward: false,
      backward: false,
      left: false,
      right: false,
      brake: false,
      interact: false
    };
    
    // Add interaction tracking
    this.wasInteracting = false;
    
    // Create the car
    this.create(position);
  }
  
  create(position) {
    // Create chassis body exactly at spawn position
    this.chassisBody = this.physics.createDynamicBody(position, {
      linearDamping: 0.3,  // Reduced from 0.5
      angularDamping: 0.5,  // Reduced from 0.8
      canSleep: false
    });
    
    // Create chassis collider with collision groups
    const chassisDesc = this.physics.createBoxCollider(
      new THREE.Vector3(
        this.chassisSize.x / 2,
        this.chassisSize.y / 2,
        this.chassisSize.z / 2
      ),
      {
        friction: 0.3,
        restitution: 0.1,
        density: 1.0  // Reduced from 2.0 for lighter chassis
      }
    );
    
    // Use simpler collision group setup
    // Chassis shouldn't collide with its own wheels
    chassisDesc.setCollisionGroups(0xFFFF0001); // Group 1, collides with all except group 2
    chassisDesc.setSolverGroups(0xFFFF0001);
    
    this.physics.world.createCollider(chassisDesc, this.chassisBody);
    
    // Create chassis mesh
    const chassisGeometry = new THREE.BoxGeometry(
      this.chassisSize.x,
      this.chassisSize.y,
      this.chassisSize.z
    );
    const chassisMaterial = new THREE.MeshStandardMaterial({
      color: 0x3366cc,
      metalness: 0.6,
      roughness: 0.4
    });
    
    this.chassisMesh = new THREE.Mesh(chassisGeometry, chassisMaterial);
    this.chassisMesh.castShadow = true;
    this.chassisMesh.receiveShadow = true;
    this.scene.scene.add(this.chassisMesh);
    
    // Add windshield
    const windshieldGeometry = new THREE.BoxGeometry(
      this.chassisSize.x * 0.8,
      this.chassisSize.y * 0.8,
      0.1
    );
    const windshieldMaterial = new THREE.MeshStandardMaterial({
      color: 0x88ccff,
      transparent: true,
      opacity: 0.3,
      metalness: 0.9,
      roughness: 0.1
    });
    
    const windshield = new THREE.Mesh(windshieldGeometry, windshieldMaterial);
    windshield.position.set(0, this.chassisSize.y * 0.7, -this.chassisSize.z * 0.3);
    windshield.rotation.x = -0.3;
    this.chassisMesh.add(windshield);
    
    // Create wheels at their world positions (like the example)
    this.createWheels(position);
    
    // Store reference on mesh for interaction
    this.chassisMesh.userData.carController = this;
    this.chassisMesh.userData.interactable = true;
    this.chassisMesh.userData.interactionType = 'vehicle';
  }
  
  createWheels(chassisPosition) {
    // Define wheel positions relative to chassis CENTER (not world space)
    const wheelOffsets = [
      // Front left
      new THREE.Vector3(
        -this.chassisSize.x / 2 + this.wheelRadius * 0.5,
        -0.1, // Slightly lower to ensure proper contact
        -this.chassisSize.z / 2 + this.wheelRadius * 2
      ),
      // Front right
      new THREE.Vector3(
        this.chassisSize.x / 2 - this.wheelRadius * 0.5,
        -0.1,
        -this.chassisSize.z / 2 + this.wheelRadius * 2
      ),
      // Rear left
      new THREE.Vector3(
        -this.chassisSize.x / 2 + this.wheelRadius * 0.5,
        -0.1,
        this.chassisSize.z / 2 - this.wheelRadius * 2
      ),
      // Rear right
      new THREE.Vector3(
        this.chassisSize.x / 2 - this.wheelRadius * 0.5,
        -0.1,
        this.chassisSize.z / 2 - this.wheelRadius * 2
      )
    ];
    
    const wheelGeometry = new THREE.CylinderGeometry(
      this.wheelRadius,
      this.wheelRadius,
      this.wheelWidth,
      16
    );
    const wheelMaterial = new THREE.MeshStandardMaterial({
      color: 0x333333,
      roughness: 0.8,
      metalness: 0.2
    });
    
    wheelOffsets.forEach((offset, index) => {
      // Calculate world position for wheel
      const wheelWorldPos = new THREE.Vector3().copy(chassisPosition).add(offset);
      
      // Create wheel body at world position
      const wheelBody = this.physics.createDynamicBody(wheelWorldPos, {
        linearDamping: 0.1,  // Reduced from 0.5
        angularDamping: 0.1   // Reduced from 0.5
      });
      
      // Create wheel collider with collision filtering
      const wheelDesc = RAPIER.ColliderDesc.cylinder(this.wheelWidth / 2, this.wheelRadius)
        .setRotation({ w: 0.707, x: 0, y: 0, z: 0.707 }); // Rotate to align with X axis
      
      wheelDesc.setFriction(3.0);  // Increased from 2.0 for better traction
      wheelDesc.setRestitution(0.1);
      wheelDesc.setDensity(0.5);  // Reduced from 1.0 for lighter wheels
      
      // Wheels don't collide with chassis
      wheelDesc.setCollisionGroups(0xFFFE0002); // Group 2, collides with all except group 1
      wheelDesc.setSolverGroups(0xFFFE0002);
      
      this.physics.world.createCollider(wheelDesc, wheelBody);
      this.wheelBodies.push(wheelBody);
      
      // Create wheel mesh
      const wheelMesh = new THREE.Mesh(wheelGeometry, wheelMaterial);
      // Rotate mesh to match physics collider orientation
      // Physics collider is rotated 90 degrees around Z (quaternion w: 0.707, z: 0.707)
      // This puts the cylinder's axis along X
      wheelMesh.rotation.z = Math.PI / 2;
      wheelMesh.castShadow = true;
      wheelMesh.receiveShadow = true;
      this.scene.scene.add(wheelMesh);
      this.wheelMeshes.push(wheelMesh);
      
      // Create revolute joint with LOCAL anchors
      this.createWheelJoint(wheelBody, offset, index);
    });
  }
  
  createWheelJoint(wheelBody, localOffsetOnChassis, wheelIndex) {
    // Create revolute joint for wheel rotation
    const jointData = RAPIER.JointData.revolute(
      localOffsetOnChassis, // Local anchor on chassis
      { x: 0, y: 0, z: 0 }, // Local anchor on wheel (center)
      { x: 1, y: 0, z: 0 } // X axis for wheel rotation
    );
    
    const joint = this.physics.world.createImpulseJoint(
      jointData,
      this.chassisBody,
      wheelBody,
      true
    );
    
    // Disable contacts between connected bodies
    joint.setContactsEnabled(false);
    
    // Configure motor for rear wheels with better settings
    if (wheelIndex >= 2) {
      joint.configureMotorModel(RAPIER.MotorModel.AccelerationBased); // Switch back to acceleration based
      // Remove limits that were constraining the motor
    }
    
    // Store joint reference
    this.wheelJoints.push({
      joint: joint,
      isRearWheel: wheelIndex >= 2,
      isFrontWheel: wheelIndex < 2,
      wheelIndex: wheelIndex
    });
  }
  
  enterCar(player) {
    if (this.isOccupied) return false;
    
    this.isOccupied = true;
    this.currentPlayer = player;
    
    // Attach camera to car chassis
    if (player.mesh && player.mesh.children.includes(this.scene.camera)) {
      player.mesh.remove(this.scene.camera);
    }
    
    this.chassisMesh.add(this.scene.camera);
    // Position camera further behind and higher up for better view
    this.scene.camera.position.set(0, 4, 12); // Increased from (0, 2, 6)
    this.scene.camera.rotation.set(-0.2, 0, 0); // Increased downward angle
    
    console.log('Player entered car');
    return true;
  }
  
  exitCar() {
    if (!this.isOccupied || !this.currentPlayer) return null;
    
    console.log('exitCar called');
    
    // Calculate safe exit position to the side of the car
    const carPos = this.getPosition();
    const carRotation = this.chassisBody.rotation();
    const carQuat = new THREE.Quaternion(carRotation.x, carRotation.y, carRotation.z, carRotation.w);
    
    // Get car's right direction and move player to the side
    const rightDirection = new THREE.Vector3(1, 0, 0).applyQuaternion(carQuat);
    const exitDistance = 5; // Safe distance from car
    
    const exitPosition = new THREE.Vector3(
      carPos.x + rightDirection.x * exitDistance,
      carPos.y + 1,  // Slightly above car
      carPos.z + rightDirection.z * exitDistance
    );
    
    // Remove camera from car
    if (this.chassisMesh.children.includes(this.scene.camera)) {
      this.chassisMesh.remove(this.scene.camera);
    }
    
    // Store reference to player before clearing
    const player = this.currentPlayer;
    
    // Clear vehicle state first
    this.isOccupied = false;
    this.currentPlayer = null;
    
    // Reset controls
    Object.keys(this.keys).forEach(key => {
      this.keys[key] = false;
    });
    
    console.log('Player exited car');
    
    return {
      exitPosition: exitPosition,
      player: player  // Return player reference for camera restoration
    };
  }
  
  // Add grounding check method
  checkGrounded() {
    const position = this.getPosition();
    
    // Get gravity-based down direction
    const downDirection = this.physics.getDownDirection(position);
    
    // Check if car is on ground (check from bottom of chassis)
    const checkPosition = new THREE.Vector3(
      position.x + downDirection.x * (this.chassisSize.y / 2 + 0.2),
      position.y + downDirection.y * (this.chassisSize.y / 2 + 0.2),
      position.z + downDirection.z * (this.chassisSize.y / 2 + 0.2)
    );
    
    this.isGrounded = this.physics.isPositionGrounded(
      checkPosition,
      downDirection,
      0.5
    );
  }
  
  update(deltaTime) {
    if (!this.body) return;
    
    // Handle exit input when occupied - wait for key release
    if (this.isOccupied && this.keys) {
      // Check for exit key with proper release detection
      if (this.keys.interact && !this.wasInteracting) {
        console.log('Car controller triggering exit');
        
        // Trigger exit through the player
        if (this.currentPlayer && this.currentPlayer.exitVehicle) {
          this.currentPlayer.exitVehicle();
        }
      }
      
      // Update interaction state
      this.wasInteracting = this.keys.interact;
    }
    
    // Check grounding
    this.checkGrounded();
    
    // Handle controls only when occupied and keys are connected
    if (this.isOccupied && this.keys) {
      // Check for exit key using the player's keys
      if (this.keys.interact && !this.wasInteracting) {
        this.wasInteracting = true;
        
        // Trigger exit through the player
        if (this.currentPlayer && this.currentPlayer.exitVehicle) {
          console.log('Car controller triggering exit');
          this.currentPlayer.exitVehicle();
        }
      } else if (!this.keys.interact) {
        this.wasInteracting = false;
      }
      
      // Handle steering and driving using player's keys
      let targetSteer = 0;
      if (this.keys.left) targetSteer = this.maxSteerAngle;
      if (this.keys.right) targetSteer = -this.maxSteerAngle;
      
      this.steerAngle += (targetSteer - this.steerAngle) * this.steerSpeed * deltaTime;
      
      // Apply steering by applying torque to chassis
      if (Math.abs(this.steerAngle) > 0.01) {
        // Get chassis velocity for speed-dependent steering
        const velocity = this.chassisBody.linvel();
        const speed = Math.sqrt(velocity.x * velocity.x + velocity.z * velocity.z);
        
        // Reduce steering effectiveness at low speeds
        const speedFactor = Math.min(speed / 5.0, 1.0) + 0.3; // Added base steering
        const steerTorque = this.steerAngle * 30 * speedFactor;
        
        this.chassisBody.applyTorqueImpulse({
          x: 0,
          y: steerTorque,
          z: 0
        });
      }
      
      // Apply motor to rear wheels
      let targetVelocity = 0;
      if (this.keys.forward) targetVelocity = this.motorSpeed;
      if (this.keys.backward) targetVelocity = -this.motorSpeed * 0.5;
      
      this.wheelJoints.forEach((wheelJoint) => {
        if (wheelJoint.isRearWheel && wheelJoint.joint) {
          wheelJoint.joint.configureMotorVelocity(targetVelocity, this.motorForce);
        }
      });
      
      // Apply braking
      if (this.keys.jump) { // Space bar for brake
        const vel = this.chassisBody.linvel();
        this.chassisBody.applyImpulse({
          x: -vel.x * 0.1,  // Increased from 0.05
          y: 0,
          z: -vel.z * 0.1
        });
        
        // Stop all wheels
        this.wheelJoints.forEach((wheelJoint) => {
          if (wheelJoint.joint) {
            wheelJoint.joint.configureMotorVelocity(0, this.motorForce * 3); // Increased brake force
          }
        });
      }
    }
    
    // Update visual positions
    this.updateVisuals();
  }
  
  updateVisuals() {
    // Update chassis
    const chassisPos = this.chassisBody.translation();
    const chassisRot = this.chassisBody.rotation();
    
    this.chassisMesh.position.set(chassisPos.x, chassisPos.y, chassisPos.z);
    this.chassisMesh.quaternion.set(chassisRot.x, chassisRot.y, chassisRot.z, chassisRot.w);
    
    // Update wheels
    this.wheelBodies.forEach((wheel, index) => {
      const wheelPos = wheel.translation();
      const wheelRot = wheel.rotation();
      
      // Update position
      this.wheelMeshes[index].position.set(wheelPos.x, wheelPos.y, wheelPos.z);
      
      // For rotation, we need to combine the physics rotation with the base mesh rotation
      // The mesh needs to be rotated 90 degrees around Z to match the collider
      const physicsQuat = new THREE.Quaternion(wheelRot.x, wheelRot.y, wheelRot.z, wheelRot.w);
      
      // Base rotation for cylinder mesh (90 degrees around Z)
      const baseRotation = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI / 2);
      
      // Combine rotations: physics rotation * base rotation
      const finalQuat = physicsQuat.clone().multiply(baseRotation);
      
      this.wheelMeshes[index].quaternion.copy(finalQuat);
    });
  }
  
  getPosition() {
    if (!this.chassisBody) return new THREE.Vector3();
    const pos = this.chassisBody.translation();
    return new THREE.Vector3(pos.x, pos.y, pos.z);
  }
  
  getVelocity() {
    if (!this.chassisBody) return new THREE.Vector3();
    const vel = this.chassisBody.linvel();
    return new THREE.Vector3(vel.x, vel.y, vel.z);
  }
  
  destroy() {
    // Remove joints first
    this.wheelJoints.forEach(joint => {
      if (joint && this.physics.world) {
        this.physics.world.removeImpulseJoint(joint, true);
      }
    });
    
    // Remove meshes
    if (this.chassisMesh) {
      this.scene.scene.remove(this.chassisMesh);
      if (this.chassisMesh.geometry) this.chassisMesh.geometry.dispose();
      if (this.chassisMesh.material) this.chassisMesh.material.dispose();
    }
    
    this.wheelMeshes.forEach(mesh => {
      this.scene.scene.remove(mesh);
      if (mesh.geometry) mesh.geometry.dispose();
      if (mesh.material) mesh.material.dispose();
    });
    
    // Remove physics bodies
    if (this.physics.world) {
      if (this.chassisBody) {
        this.physics.world.removeRigidBody(this.chassisBody);
      }
      
      this.wheelBodies.forEach(wheel => {
        this.physics.world.removeRigidBody(wheel);
      });
    }
  }
  
  updateFromServer(state) {
    if (!this.chassisBody || this.isOccupied) return;
    
    // Update position
    if (state.position) {
      this.chassisBody.setTranslation({
        x: state.position.x,
        y: state.position.y,
        z: state.position.z
      });
    }
    
    // Update rotation
    if (state.rotation) {
      this.chassisBody.setRotation({
        x: state.rotation.x,
        y: state.rotation.y,
        z: state.rotation.z,
        w: state.rotation.w
      });
    }
    
    // Update velocity
    if (state.velocity) {
      this.chassisBody.setLinvel({
        x: state.velocity.x,
        y: state.velocity.y,
        z: state.velocity.z
      });
    }
    
    // Update wheel positions to match
    this.updateWheelPositions();
  }
  
  updateWheelPositions() {
    if (!this.chassisBody) return;
    
    const chassisPos = this.chassisBody.translation();
    const chassisRot = this.chassisBody.rotation();
    const chassisQuat = new THREE.Quaternion(chassisRot.x, chassisRot.y, chassisRot.z, chassisRot.w);
    
    const wheelOffsets = [
      new THREE.Vector3(-this.chassisSize.x/2 + this.wheelRadius * 0.5, 0, -this.chassisSize.z/2 + this.wheelRadius*2),
      new THREE.Vector3(this.chassisSize.x/2 - this.wheelRadius * 0.5, 0, -this.chassisSize.z/2 + this.wheelRadius*2),
      new THREE.Vector3(-this.chassisSize.x/2 + this.wheelRadius * 0.5, 0, this.chassisSize.z/2 - this.wheelRadius*2),
      new THREE.Vector3(this.chassisSize.x/2 - this.wheelRadius * 0.5, 0, this.chassisSize.z/2 - this.wheelRadius*2)
    ];
    
    this.wheelBodies.forEach((wheel, index) => {
      const offset = wheelOffsets[index].clone().applyQuaternion(chassisQuat);
      wheel.setTranslation({
        x: chassisPos.x + offset.x,
        y: chassisPos.y + offset.y,
        z: chassisPos.z + offset.z
      });
    });
  }
}
