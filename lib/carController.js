import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';

export class CarController {
  constructor(scene, physics, position = new THREE.Vector3(0, 5, 0)) {
    this.scene = scene;
    this.physics = physics;
    
    // Car properties
    this.chassisSize = new THREE.Vector3(2, 0.5, 4);
    this.wheelRadius = 0.4;
    this.wheelWidth = 0.3;
    
    // Movement properties
    this.motorSpeed = 20;
    this.motorForce = 10;
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
    this.driver = null;
    
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
    
    // Input state
    this.keys = {
      forward: false,
      backward: false,
      left: false,
      right: false,
      brake: false
    };
    
    // Create the car
    this.create(position);
  }
  
  create(position) {
    // Create chassis body exactly at spawn position
    this.chassisBody = this.physics.createDynamicBody(position, {
      linearDamping: 0.5,
      angularDamping: 0.8,
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
        density: 2.0
      }
    );
    
    // Set collision groups - chassis is in group 1, collides with everything except wheels (group 2)
    // membership = CHASSIS (0x0001)
    // filter = ALL except WHEELS = 0xFFFF & ~0x0002 = 0xFFFD
    chassisDesc.setCollisionGroups(
      (this.COLLISION_GROUPS.CHASSIS << 16) | 0xFFFD
    );
    
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
        0, // At chassis center height
        -this.chassisSize.z / 2 + this.wheelRadius * 2
      ),
      // Front right
      new THREE.Vector3(
        this.chassisSize.x / 2 - this.wheelRadius * 0.5,
        0,
        -this.chassisSize.z / 2 + this.wheelRadius * 2
      ),
      // Rear left
      new THREE.Vector3(
        -this.chassisSize.x / 2 + this.wheelRadius * 0.5,
        0,
        this.chassisSize.z / 2 - this.wheelRadius * 2
      ),
      // Rear right
      new THREE.Vector3(
        this.chassisSize.x / 2 - this.wheelRadius * 0.5,
        0,
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
        linearDamping: 0.2,
        angularDamping: 0.2
      });
      
      // Create wheel collider with collision filtering
      const wheelDesc = RAPIER.ColliderDesc.cylinder(this.wheelWidth / 2, this.wheelRadius)
        .setRotation({ w: 0.707, x: 0, y: 0, z: 0.707 }); // Rotate to align with X axis
      
      wheelDesc.setFriction(2.0);
      wheelDesc.setRestitution(0.1);
      wheelDesc.setDensity(1.0);
      
      // Set collision groups - wheels are in group 2, collide with everything except chassis (group 1)
      // membership = WHEELS (0x0002)
      // filter = ALL except CHASSIS = 0xFFFF & ~0x0001 = 0xFFFE
      wheelDesc.setCollisionGroups(
        (this.COLLISION_GROUPS.WHEELS << 16) | 0xFFFE
      );
      
      this.physics.world.createCollider(wheelDesc, wheelBody);
      this.wheelBodies.push(wheelBody);
      
      // Create wheel mesh
      const wheelMesh = new THREE.Mesh(wheelGeometry, wheelMaterial);
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
    // The rotation axis should be in the wheel's local X direction (sideways)
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
    
    // Configure motor for rear wheels
    if (wheelIndex >= 2) {
      joint.configureMotorModel(RAPIER.MotorModel.AccelerationBased);
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
    this.driver = player;
    
    // Move camera to car
    if (this.scene.camera && player.mesh) {
      player.mesh.remove(this.scene.camera);
      this.chassisMesh.add(this.scene.camera);
      this.scene.camera.position.set(0, 2, 5);
      this.scene.camera.rotation.set(-0.2, 0, 0);
    }
    
    console.log('Entered car');
    return true;
  }
  
  exitCar() {
    if (!this.isOccupied || !this.driver) return null;
    
    // Calculate exit position (to the left of the car)
    const exitOffset = new THREE.Vector3(-3, 2, 0);
    const carRotation = this.chassisBody.rotation();
    const carQuat = new THREE.Quaternion(carRotation.x, carRotation.y, carRotation.z, carRotation.w);
    exitOffset.applyQuaternion(carQuat);
    
    const carPos = this.chassisBody.translation();
    const exitPosition = new THREE.Vector3(carPos.x, carPos.y, carPos.z).add(exitOffset);
    
    // Return camera to player
    if (this.scene.camera && this.driver.mesh) {
      this.chassisMesh.remove(this.scene.camera);
      this.driver.mesh.add(this.scene.camera);
      this.scene.camera.position.set(0, this.driver.height * 0.8, 0);
      this.scene.camera.rotation.set(0, 0, 0);
    }
    
    const driver = this.driver;
    this.isOccupied = false;
    this.driver = null;
    
    // Reset input
    Object.keys(this.keys).forEach(key => {
      this.keys[key] = false;
    });
    this.steerAngle = 0;
    
    console.log('Exited car');
    return { driver, exitPosition };
  }
  
  update(deltaTime) {
    if (!this.chassisBody) return;
    
    // Apply gravity
    this.physics.applyGravityToBody(this.chassisBody, deltaTime);
    this.wheelBodies.forEach(wheel => {
      this.physics.applyGravityToBody(wheel, deltaTime);
    });
    
    // Handle steering for front wheels
    if (this.isOccupied) {
      let targetSteer = 0;
      if (this.keys.left) targetSteer = this.maxSteerAngle;
      if (this.keys.right) targetSteer = -this.maxSteerAngle;
      
      this.steerAngle += (targetSteer - this.steerAngle) * this.steerSpeed * deltaTime;
      
      // Apply steering by rotating front wheels around Y axis
      this.wheelJoints.forEach((wheelJoint, index) => {
        if (wheelJoint.isFrontWheel && index < 2) {
          // Get wheel body
          const wheelBody = this.wheelBodies[index];
          if (wheelBody) {
            // Apply steering rotation
            const chassisRot = this.chassisBody.rotation();
            const chassisQuat = new THREE.Quaternion(chassisRot.x, chassisRot.y, chassisRot.z, chassisRot.w);
            
            // Calculate steered rotation
            const steerQuat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), this.steerAngle);
            const finalQuat = chassisQuat.clone().multiply(steerQuat);
            
            // Add wheel spin rotation
            const wheelRotation = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI / 2);
            finalQuat.multiply(wheelRotation);
            
            wheelBody.setRotation({
              x: finalQuat.x,
              y: finalQuat.y,
              z: finalQuat.z,
              w: finalQuat.w
            });
          }
        }
      });
      
      // Apply motor to rear wheels (like the example)
      let targetVelocity = 0;
      if (this.keys.forward) targetVelocity = -this.motorSpeed;
      if (this.keys.backward) targetVelocity = this.motorSpeed * 0.5;
      
      this.wheelJoints.forEach((wheelJoint) => {
        if (wheelJoint.isRearWheel && wheelJoint.joint) {
          wheelJoint.joint.configureMotorVelocity(targetVelocity, this.motorForce);
        }
      });
      
      // Apply braking
      if (this.keys.brake) {
        const vel = this.chassisBody.linvel();
        this.chassisBody.applyImpulse({
          x: -vel.x * 0.1,
          y: 0,
          z: -vel.z * 0.1
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
      
      this.wheelMeshes[index].position.set(wheelPos.x, wheelPos.y, wheelPos.z);
      this.wheelMeshes[index].quaternion.set(wheelRot.x, wheelRot.y, wheelRot.z, wheelRot.w);
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
