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
    this.suspensionStiffness = 30;
    this.suspensionDamping = 5;
    this.suspensionRestLength = 0.3;
    
    // Movement properties
    this.engineForce = 30;
    this.brakeForce = 20;
    this.steerAngle = 0;
    this.maxSteerAngle = 0.5;
    this.steerSpeed = 2;
    
    // State
    this.isOccupied = false;
    this.driver = null;
    
    // Multiplayer state
    this.isMultiplayer = false;
    this.objectId = null;
    
    // Physics objects
    this.chassisBody = null;
    this.wheelBodies = [];
    this.constraints = [];
    
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
    // Create chassis body
    this.chassisBody = this.physics.createDynamicBody(position, {
      linearDamping: 0.3,
      angularDamping: 0.3,
      canSleep: false
    });
    
    // Create chassis collider
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
    
    // Create wheels
    this.createWheels(position);
    
    // Store reference on mesh for interaction
    this.chassisMesh.userData.carController = this;
    this.chassisMesh.userData.interactable = true;
    this.chassisMesh.userData.interactionType = 'vehicle';
  }
  
  createWheels(chassisPosition) {
    const wheelPositions = [
      // Front left
      new THREE.Vector3(
        -this.chassisSize.x / 2 + this.wheelRadius,
        -this.suspensionRestLength,
        -this.chassisSize.z / 2 + this.wheelRadius * 2
      ),
      // Front right
      new THREE.Vector3(
        this.chassisSize.x / 2 - this.wheelRadius,
        -this.suspensionRestLength,
        -this.chassisSize.z / 2 + this.wheelRadius * 2
      ),
      // Rear left
      new THREE.Vector3(
        -this.chassisSize.x / 2 + this.wheelRadius,
        -this.suspensionRestLength,
        this.chassisSize.z / 2 - this.wheelRadius * 2
      ),
      // Rear right
      new THREE.Vector3(
        this.chassisSize.x / 2 - this.wheelRadius,
        -this.suspensionRestLength,
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
    
    wheelPositions.forEach((offset, index) => {
      // Create wheel body at proper distance from chassis
      const wheelPosition = chassisPosition.clone().add(offset);
      const wheelBody = this.physics.createDynamicBody(wheelPosition, {
        linearDamping: 0.1,
        angularDamping: 0.1
      });
      
      // Create wheel collider
      const wheelDesc = RAPIER.ColliderDesc.cylinder(this.wheelWidth / 2, this.wheelRadius)
        .setRotation({ w: 0.707, x: 0, y: 0, z: 0.707 }); // Rotate to align with X axis
      
      wheelDesc.setFriction(1.5);
      wheelDesc.setRestitution(0.1);
      wheelDesc.setDensity(1.0);
      
      this.physics.world.createCollider(wheelDesc, wheelBody);
      this.wheelBodies.push(wheelBody);
      
      // Create wheel mesh
      const wheelMesh = new THREE.Mesh(wheelGeometry, wheelMaterial);
      wheelMesh.rotation.z = Math.PI / 2;
      wheelMesh.castShadow = true;
      wheelMesh.receiveShadow = true;
      this.scene.scene.add(wheelMesh);
      this.wheelMeshes.push(wheelMesh);
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
    
    // Handle steering
    let targetSteer = 0;
    if (this.keys.left) targetSteer = this.maxSteerAngle;
    if (this.keys.right) targetSteer = -this.maxSteerAngle;
    
    this.steerAngle += (targetSteer - this.steerAngle) * this.steerSpeed * deltaTime;
    
    // Get car orientation
    const carRotation = this.chassisBody.rotation();
    const carQuat = new THREE.Quaternion(carRotation.x, carRotation.y, carRotation.z, carRotation.w);
    
    // Apply forces to wheels
    this.wheelBodies.forEach((wheel, index) => {
      // Suspension
      this.applySuspension(wheel, index, deltaTime);
      
      // Steering (only front wheels)
      if (index < 2) {
        this.applySteering(wheel, carQuat);
      }
      
      // Drive force (rear wheels)
      if (index >= 2 && this.isOccupied) {
        this.applyDriveForce(wheel, carQuat, deltaTime);
      }
      
      // Friction
      this.applyFriction(wheel, carQuat, deltaTime);
    });
    
    // Update visual positions
    this.updateVisuals();
  }
  
  applySuspension(wheel, wheelIndex, deltaTime) {
    const chassisPos = this.chassisBody.translation();
    const wheelPos = wheel.translation();
    
    // Calculate suspension direction (local Y axis of car)
    const carRotation = this.chassisBody.rotation();
    const carQuat = new THREE.Quaternion(carRotation.x, carRotation.y, carRotation.z, carRotation.w);
    const suspensionDir = new THREE.Vector3(0, -1, 0).applyQuaternion(carQuat);
    
    // Get wheel attachment point in world space
    const wheelAttachments = [
      new THREE.Vector3(-this.chassisSize.x/2 + this.wheelRadius, -this.chassisSize.y/2, -this.chassisSize.z/2 + this.wheelRadius*2),
      new THREE.Vector3(this.chassisSize.x/2 - this.wheelRadius, -this.chassisSize.y/2, -this.chassisSize.z/2 + this.wheelRadius*2),
      new THREE.Vector3(-this.chassisSize.x/2 + this.wheelRadius, -this.chassisSize.y/2, this.chassisSize.z/2 - this.wheelRadius*2),
      new THREE.Vector3(this.chassisSize.x/2 - this.wheelRadius, -this.chassisSize.y/2, this.chassisSize.z/2 - this.wheelRadius*2)
    ];
    
    const attachPoint = wheelAttachments[wheelIndex].clone().applyQuaternion(carQuat);
    const worldAttachPoint = new THREE.Vector3(chassisPos.x, chassisPos.y, chassisPos.z).add(attachPoint);
    
    // Calculate vector from attachment point to wheel
    const toWheel = new THREE.Vector3(
      wheelPos.x - worldAttachPoint.x,
      wheelPos.y - worldAttachPoint.y,
      wheelPos.z - worldAttachPoint.z
    );
    
    // Project onto suspension axis to get compression
    const currentLength = toWheel.dot(suspensionDir);
    const compression = this.suspensionRestLength - currentLength;
    
    // Only apply force if compressed or within rest length
    if (currentLength < this.suspensionRestLength + 0.1) {
      // Spring force
      const springForce = Math.max(0, compression * this.suspensionStiffness);
      
      // Damping
      const chassisVel = this.chassisBody.linvel();
      const wheelVel = wheel.linvel();
      const relVel = new THREE.Vector3(
        chassisVel.x - wheelVel.x,
        chassisVel.y - wheelVel.y,
        chassisVel.z - wheelVel.z
      );
      const dampingForce = relVel.dot(suspensionDir) * this.suspensionDamping;
      
      const totalForce = (springForce + dampingForce) * deltaTime;
      
      // Apply force to chassis at attachment point
      const force = suspensionDir.clone().multiplyScalar(-totalForce);
      this.chassisBody.applyImpulseAtPoint(
        { x: force.x, y: force.y, z: force.z },
        { x: worldAttachPoint.x, y: worldAttachPoint.y, z: worldAttachPoint.z }
      );
      
      // Apply opposite force to wheel
      wheel.applyImpulse({
        x: -force.x,
        y: -force.y,
        z: -force.z
      });
      
      // Add constraint to keep wheel aligned with chassis
      if (currentLength > this.suspensionRestLength + 0.05) {
        // Pull wheel back if it's too far
        const correction = suspensionDir.multiplyScalar((currentLength - this.suspensionRestLength) * 0.5);
        wheel.setTranslation({
          x: wheelPos.x + correction.x,
          y: wheelPos.y + correction.y,
          z: wheelPos.z + correction.z
        });
      }
    }
  }
  
  applySteering(wheel, carQuat) {
    if (Math.abs(this.steerAngle) < 0.001) return;
    
    // Apply steering torque
    const steerAxis = new THREE.Vector3(0, 1, 0).applyQuaternion(carQuat);
    const torque = steerAxis.multiplyScalar(this.steerAngle * 5);
    
    wheel.applyTorqueImpulse({
      x: torque.x,
      y: torque.y,
      z: torque.z
    });
  }
  
  applyDriveForce(wheel, carQuat, deltaTime) {
    let force = 0;
    if (this.keys.forward) force = this.engineForce;
    if (this.keys.backward) force = -this.engineForce * 0.5;
    if (this.keys.brake) force = 0;
    
    if (Math.abs(force) > 0) {
      // Apply torque to wheel for rolling
      const wheelRight = new THREE.Vector3(1, 0, 0).applyQuaternion(carQuat);
      const torque = wheelRight.multiplyScalar(force * deltaTime);
      
      wheel.applyTorqueImpulse({
        x: torque.x,
        y: torque.y,
        z: torque.z
      });
    }
  }
  
  applyFriction(wheel, carQuat, deltaTime) {
    const wheelVel = wheel.linvel();
    const velocity = new THREE.Vector3(wheelVel.x, wheelVel.y, wheelVel.z);
    
    // Lateral friction
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(carQuat);
    const lateralVel = right.multiplyScalar(velocity.dot(right));
    
    let frictionForce = 8;
    if (this.keys.brake) frictionForce = this.brakeForce;
    
    const friction = lateralVel.multiplyScalar(-frictionForce * deltaTime);
    
    wheel.applyImpulse({
      x: friction.x,
      y: friction.y,
      z: friction.z
    });
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
      new THREE.Vector3(-this.chassisSize.x/2 + this.wheelRadius, -this.suspensionRestLength, -this.chassisSize.z/2 + this.wheelRadius*2),
      new THREE.Vector3(this.chassisSize.x/2 - this.wheelRadius, -this.suspensionRestLength, -this.chassisSize.z/2 + this.wheelRadius*2),
      new THREE.Vector3(-this.chassisSize.x/2 + this.wheelRadius, -this.suspensionRestLength, this.chassisSize.z/2 - this.wheelRadius*2),
      new THREE.Vector3(this.chassisSize.x/2 - this.wheelRadius, -this.suspensionRestLength, this.chassisSize.z/2 - this.wheelRadius*2)
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
