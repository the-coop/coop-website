import * as THREE from 'three';

export class PlaneController {
  constructor(scene, physics, position) {
    this.scene = scene;
    this.physics = physics;
    
    // Plane properties
    this.maxThrust = 50.0;
    this.maxPitch = 0.8;
    this.maxRoll = 1.0;
    this.maxYawRate = 1.5;
    this.enginePower = 0;
    this.lift = 0;
    
    // Current state
    this.pitch = 0;
    this.roll = 0;
    this.yaw = 0;
    this.speed = 0;
    
    // Physics objects
    this.body = null;
    this.collider = null;
    
    // Visual objects
    this.mesh = null;
    this.propeller = null;
    
    // Player state
    this.isOccupied = false;
    this.currentPlayer = null;
    
    // Control state
    this.controls = {
      throttleUp: false,
      throttleDown: false,
      pitchForward: false,
      pitchBackward: false,
      rollLeft: false,
      rollRight: false,
      yawLeft: false,
      yawRight: false,
      interact: false  // Add interact key for exit
    };
    
    // Add interaction tracking
    this.wasInteracting = false;
    
    // Create the plane
    this.create(position);
  }
  
  create(position) {
    // Create fuselage mesh
    const fuselageGeometry = new THREE.BoxGeometry(1.5, 1, 6);
    const fuselageMaterial = new THREE.MeshStandardMaterial({
      color: 0x666666,
      metalness: 0.7,
      roughness: 0.3
    });
    
    this.mesh = new THREE.Mesh(fuselageGeometry, fuselageMaterial);
    
    // Add cockpit
    const cockpitGeometry = new THREE.BoxGeometry(1.2, 0.8, 2);
    const cockpitMaterial = new THREE.MeshStandardMaterial({
      color: 0x444488,
      metalness: 0.5,
      roughness: 0.4
    });
    const cockpit = new THREE.Mesh(cockpitGeometry, cockpitMaterial);
    cockpit.position.set(0, 0.3, 1.5);
    this.mesh.add(cockpit);
    
    // Add wings
    const wingGeometry = new THREE.BoxGeometry(8, 0.2, 2);
    const wingMaterial = new THREE.MeshStandardMaterial({
      color: 0x555555,
      metalness: 0.6,
      roughness: 0.4
    });
    const wings = new THREE.Mesh(wingGeometry, wingMaterial);
    wings.position.set(0, 0, -0.5);
    this.mesh.add(wings);
    
    // Add tail
    const tailGeometry = new THREE.BoxGeometry(0.5, 2, 1);
    const tail = new THREE.Mesh(tailGeometry, wingMaterial);
    tail.position.set(0, 0.5, -2.5);
    this.mesh.add(tail);
    
    // Add propeller
    this.createPropeller();
    
    // Position and add to scene
    this.mesh.position.copy(position);
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    this.scene.scene.add(this.mesh);
    
    // Create physics
    this.createPhysics(position);
    
    // Store reference on mesh for interaction (like car does)
    this.mesh.userData.planeController = this;
    this.mesh.userData.interactable = true;
    this.mesh.userData.interactionType = 'vehicle';
    
    console.log('Plane created at', position);
  }
  
  createPropeller() {
    this.propeller = new THREE.Group();
    
    // Propeller hub
    const hubGeometry = new THREE.CylinderGeometry(0.2, 0.2, 0.3);
    const hubMaterial = new THREE.MeshStandardMaterial({
      color: 0x333333,
      metalness: 0.8,
      roughness: 0.2
    });
    const hub = new THREE.Mesh(hubGeometry, hubMaterial);
    hub.rotation.x = Math.PI / 2;
    this.propeller.add(hub);
    
    // Propeller blades
    const bladeGeometry = new THREE.BoxGeometry(0.1, 3, 0.05);
    const bladeMaterial = new THREE.MeshStandardMaterial({
      color: 0x222222,
      metalness: 0.7,
      roughness: 0.3
    });
    
    for (let i = 0; i < 3; i++) {
      const blade = new THREE.Mesh(bladeGeometry, bladeMaterial);
      blade.rotation.z = (Math.PI * 2 / 3) * i;
      this.propeller.add(blade);
    }
    
    this.propeller.position.set(0, 0, 3);
    this.mesh.add(this.propeller);
  }
  
  createPhysics(position) {
    // Create main body
    this.body = this.physics.createDynamicBody(position, {
      linearDamping: 0.5,
      angularDamping: 1.0
    });
    
    // Create collider
    const collider = this.physics.createBoxCollider(
      new THREE.Vector3(0.75, 0.5, 3),
      {
        density: 0.3,
        friction: 0.4,
        restitution: 0.2
      }
    );
    
    this.collider = this.physics.world.createCollider(collider, this.body);
  }
  
  getPosition() {
    if (!this.body) return new THREE.Vector3();
    const pos = this.body.translation();
    return new THREE.Vector3(pos.x, pos.y, pos.z);
  }
  
  getVelocity() {
    if (!this.body) return new THREE.Vector3();
    const vel = this.body.linvel();
    return new THREE.Vector3(vel.x, vel.y, vel.z);
  }
  
  enterPlane(player) {
    if (this.isOccupied) return false;
    
    this.isOccupied = true;
    this.currentPlayer = player;
    
    // Attach camera to plane
    if (player.mesh && player.mesh.children.includes(this.scene.camera)) {
      player.mesh.remove(this.scene.camera);
    }
    
    this.mesh.add(this.scene.camera);
    // Position camera behind and above the plane
    this.scene.camera.position.set(0, 3, 8);
    this.scene.camera.rotation.set(-0.15, 0, 0);
    
    console.log('Player entered plane');
    return true;
  }
  
  exitPlane() {
    if (!this.isOccupied || !this.currentPlayer) return null;
    
    console.log('exitPlane called');
    
    // Calculate safe exit position to the side of the plane
    const planePos = this.getPosition();
    const planeRotation = this.body.rotation();
    const planeQuat = new THREE.Quaternion(planeRotation.x, planeRotation.y, planeRotation.z, planeRotation.w);
    
    // Get plane's right direction and move player to the side
    const rightDirection = new THREE.Vector3(1, 0, 0).applyQuaternion(planeQuat);
    const exitDistance = 8; // Increased distance
    
    const exitPosition = new THREE.Vector3(
      planePos.x + rightDirection.x * exitDistance,
      planePos.y + 1, // Slightly above plane
      planePos.z + rightDirection.z * exitDistance
    );
    
    // Remove camera from plane
    if (this.mesh && this.mesh.children.includes(this.scene.camera)) {
      this.mesh.remove(this.scene.camera);
    }
    
    // Store reference to player before clearing
    const player = this.currentPlayer;
    
    // Clear vehicle state first
    this.isOccupied = false;
    this.currentPlayer = null;
    
    // Reset controls - reset all control flags properly
    this.controls.throttleUp = false;
    this.controls.throttleDown = false;
    this.controls.pitchForward = false;
    this.controls.pitchBackward = false;
    this.controls.rollLeft = false;
    this.controls.rollRight = false;
    this.controls.yawLeft = false;
    this.controls.yawRight = false;
    this.controls.interact = false;
    
    // Reset plane state
    this.enginePower = 0;
    this.pitch = 0;
    this.roll = 0;
    this.yaw = 0;
    
    console.log('Player exited plane');
    
    return {
      exitPosition: exitPosition,
      player: player  // Return player reference for camera restoration
    };
  }
  
  handleControls(deltaTime) {
    if (!this.isOccupied || !this.body) return;
    
    // Remove the exit key check from here - it's now in update()
    
    // Update engine power
    if (this.controls.throttleUp) {
      this.enginePower = Math.min(1.0, this.enginePower + deltaTime * 0.5);
    }
    if (this.controls.throttleDown) {
      this.enginePower = Math.max(0, this.enginePower - deltaTime * 0.5);
    }
    
    // Update control surfaces
    const controlRate = 2.0;
    
    if (this.controls.pitchForward) {
      this.pitch = Math.max(-this.maxPitch, this.pitch - deltaTime * controlRate);
    } else if (this.controls.pitchBackward) {
      this.pitch = Math.min(this.maxPitch, this.pitch + deltaTime * controlRate);
    } else {
      this.pitch *= 0.95; // Auto-center
    }
    
    if (this.controls.rollLeft) {
      this.roll = Math.max(-this.maxRoll, this.roll - deltaTime * controlRate);
    } else if (this.controls.rollRight) {
      this.roll = Math.min(this.maxRoll, this.roll + deltaTime * controlRate);
    } else {
      this.roll *= 0.95; // Auto-center
    }
    
    if (this.controls.yawLeft) {
      this.yaw = -this.maxYawRate;
    } else if (this.controls.yawRight) {
      this.yaw = this.maxYawRate;
    } else {
      this.yaw = 0;
    }
    
    // Apply forces
    const rotation = this.body.rotation();
    const quat = new THREE.Quaternion(rotation.x, rotation.y, rotation.z, rotation.w);
    
    // Forward thrust
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(quat);
    const thrustForce = forward.multiplyScalar(this.enginePower * this.maxThrust);
    
    this.body.addForce({
      x: thrustForce.x,
      y: thrustForce.y,
      z: thrustForce.z
    }, true);
    
    // Apply torques for pitch, roll, and yaw
    const torque = new THREE.Vector3(
      this.pitch * 15,
      this.yaw * 8,
      -this.roll * 12
    ).applyQuaternion(quat);
    
    this.body.addTorque({
      x: torque.x,
      y: torque.y,
      z: torque.z
    }, true);
    
    // Add basic lift when moving forward
    const velocity = this.body.linvel();
    const speed = Math.sqrt(velocity.x * velocity.x + velocity.y * velocity.y + velocity.z * velocity.z);
    this.speed = speed;
    
    if (speed > 5) {
      const up = new THREE.Vector3(0, 1, 0).applyQuaternion(quat);
      const liftForce = up.multiplyScalar(speed * 0.5 * this.enginePower);
      
      this.body.addForce({
        x: liftForce.x,
        y: liftForce.y,
        z: liftForce.z
      }, true);
    }
  }
  
  update(deltaTime) {
    if (!this.body || !this.mesh) return;
    
    // Handle exit input when occupied - same pattern as car
    if (this.isOccupied) {
      // Check for exit key
      if (this.controls.interact && !this.wasInteracting) {
        this.wasInteracting = true;
        
        // Trigger exit through the player
        if (this.currentPlayer && this.currentPlayer.exitVehicle) {
          console.log('Plane controller triggering exit');
          this.currentPlayer.exitVehicle();
        }
      } else if (!this.controls.interact) {
        this.wasInteracting = false;
      }
    }
    
    // Update mesh position and rotation from physics
    const position = this.body.translation();
    this.mesh.position.set(position.x, position.y, position.z);
    
    const rotation = this.body.rotation();
    this.mesh.quaternion.set(rotation.x, rotation.y, rotation.z, rotation.w);
    
    // Rotate propeller
    if (this.propeller) {
      this.propeller.rotation.z += this.enginePower * deltaTime * 20;
    }
    
    // Handle controls if occupied
    if (this.isOccupied && this.controls) {
      this.handleControls(deltaTime);
    }
  }
  
  destroy() {
    if (this.mesh) {
      this.scene.scene.remove(this.mesh);
      this.mesh.traverse(child => {
        if (child.geometry) child.geometry.dispose();
        if (child.material) child.material.dispose();
      });
    }
    
    // Remove collider and body
    if (this.collider && this.physics.world) {
      this.physics.world.removeCollider(this.collider, true);
    }
    
    if (this.body && this.physics.world) {
      this.physics.world.removeRigidBody(this.body);
    }
  }
  
  updateFromServer(state) {
    if (!this.body || this.isOccupied) return;
    
    // Update position
    if (state.position) {
      this.body.setTranslation({
        x: state.position.x,
        y: state.position.y,
        z: state.position.z
      });
    }
    
    // Update rotation
    if (state.rotation) {
      this.body.setRotation({
        x: state.rotation.x,
        y: state.rotation.y,
        z: state.rotation.z,
        w: state.rotation.w
      });
    }
    
    // Update velocity
    if (state.velocity) {
      this.body.setLinvel({
        x: state.velocity.x,
        y: state.velocity.y,
        z: state.velocity.z
      });
    }
  }
}
