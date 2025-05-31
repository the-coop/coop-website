import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';

export class PlaneController {
  constructor(scene, physics, position) {
    this.scene = scene;
    this.physics = physics;
    
    // Plane properties
    this.wingSpan = 8;
    this.length = 6;
    this.height = 2;
    
    // Flight properties
    this.throttle = 0;
    this.maxThrust = 80;
    this.liftCoefficient = 0.8;
    this.dragCoefficient = 0.05;
    this.minSpeed = 10; // Minimum speed for lift
    this.maxSpeed = 50;
    
    // Control surfaces
    this.elevatorAngle = 0;
    this.rudderAngle = 0;
    this.aileronAngle = 0;
    this.maxControlAngle = 0.5;
    this.controlSpeed = 2;
    
    // State
    this.isOccupied = false;
    this.driver = null;
    this.engineOn = false;
    
    // Multiplayer state
    this.isMultiplayer = false;
    this.objectId = null;
    
    // Physics objects
    this.body = null;
    this.collider = null;
    
    // Visual objects
    this.mesh = null;
    this.propeller = null;
    
    // Input state
    this.keys = {
      throttleUp: false,
      throttleDown: false,
      pitchUp: false,
      pitchDown: false,
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
    // Create fuselage body
    this.body = this.physics.createDynamicBody(position, {
      linearDamping: 0.1,
      angularDamping: 0.3,
      canSleep: false
    });
    
    // Create fuselage collider
    const fuselageDesc = this.physics.createBoxCollider(
      new THREE.Vector3(this.length / 2, this.height / 2, this.wingSpan / 8),
      {
        friction: 0.3,
        restitution: 0.1,
        density: 0.5
      }
    );
    
    this.physics.world.createCollider(fuselageDesc, this.body);
    
    // Create wing colliders
    const wingDesc = this.physics.createBoxCollider(
      new THREE.Vector3(this.length / 4, 0.1, this.wingSpan / 2),
      {
        friction: 0.3,
        restitution: 0.1,
        density: 0.2
      }
    );
    
    this.physics.world.createCollider(wingDesc, this.body);
    
    // Create visual mesh
    const group = new THREE.Group();
    
    // Fuselage
    const fuselageGeometry = new THREE.BoxGeometry(this.length, this.height, this.wingSpan / 4);
    const fuselageMaterial = new THREE.MeshStandardMaterial({
      color: 0xff6600,
      metalness: 0.7,
      roughness: 0.3
    });
    
    const fuselage = new THREE.Mesh(fuselageGeometry, fuselageMaterial);
    fuselage.castShadow = true;
    fuselage.receiveShadow = true;
    group.add(fuselage);
    
    // Wings
    const wingGeometry = new THREE.BoxGeometry(this.length / 2, 0.2, this.wingSpan);
    const wingMaterial = new THREE.MeshStandardMaterial({
      color: 0xff8800,
      metalness: 0.6,
      roughness: 0.4
    });
    
    const wings = new THREE.Mesh(wingGeometry, wingMaterial);
    wings.castShadow = true;
    wings.receiveShadow = true;
    group.add(wings);
    
    // Tail
    const tailGeometry = new THREE.BoxGeometry(0.5, this.height * 1.5, this.wingSpan / 3);
    const tail = new THREE.Mesh(tailGeometry, wingMaterial);
    tail.position.set(-this.length / 2 + 0.5, this.height / 2, 0);
    tail.castShadow = true;
    tail.receiveShadow = true;
    group.add(tail);
    
    // Propeller
    const propGeometry = new THREE.BoxGeometry(0.2, 3, 0.5);
    const propMaterial = new THREE.MeshStandardMaterial({
      color: 0x333333,
      metalness: 0.8,
      roughness: 0.2
    });
    
    this.propeller = new THREE.Mesh(propGeometry, propMaterial);
    this.propeller.position.set(this.length / 2 + 0.2, 0, 0);
    group.add(this.propeller);
    
    // Cockpit
    const cockpitGeometry = new THREE.BoxGeometry(this.length / 4, this.height / 2, this.wingSpan / 4 - 0.2);
    const cockpitMaterial = new THREE.MeshStandardMaterial({
      color: 0x88ccff,
      transparent: true,
      opacity: 0.6,
      metalness: 0.9,
      roughness: 0.1
    });
    
    const cockpit = new THREE.Mesh(cockpitGeometry, cockpitMaterial);
    cockpit.position.set(this.length / 4, this.height / 2, 0);
    group.add(cockpit);
    
    this.mesh = group;
    this.scene.scene.add(this.mesh);
    
    // Store reference for interaction
    this.mesh.userData.planeController = this;
    this.mesh.userData.interactable = true;
    this.mesh.userData.interactionType = 'vehicle';
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
    
    // Calculate safe exit position
    const planePos = this.getPosition();
    const exitPosition = new THREE.Vector3(
      planePos.x + 3,
      planePos.y,
      planePos.z
    );
    
    // Remove camera from plane
    if (this.mesh.children.includes(this.scene.camera)) {
      this.mesh.remove(this.scene.camera);
    }
    
    // Store reference to player before clearing
    const player = this.currentPlayer;
    
    // Clear vehicle state first
    this.isOccupied = false;
    this.currentPlayer = null;
    
    // Reset controls
    this.enginePower = 0;
    this.pitchRate = 0;
    this.rollRate = 0;
    this.yawRate = 0;
    Object.keys(this.controls).forEach(key => {
      this.controls[key] = false;
    });
    
    console.log('Player exited plane');
    
    return {
      exitPosition: exitPosition,
      player: player  // Return player reference for camera restoration
    };
  }
  
  update(deltaTime) {
    if (!this.body) return;
    
    // Update visual position from physics
    const pos = this.body.translation();
    const rot = this.body.rotation();
    
    this.mesh.position.set(pos.x, pos.y, pos.z);
    this.mesh.quaternion.set(rot.x, rot.y, rot.z, rot.w);
    
    // Spin propeller when engine is on
    if (this.engineOn && this.propeller) {
      this.propeller.rotation.x += this.throttle * 50 * deltaTime;
    }
    
    if (!this.isOccupied) return;
    
    // Check for exit key first
    if (this.keys.interact && !this.wasInteracting) {
      this.wasInteracting = true;
      
      // Trigger exit through the player
      if (this.currentPlayer && this.currentPlayer.exitVehicle) {
        console.log('Plane controller triggering exit');
        this.currentPlayer.exitVehicle();
        return; // Don't process other controls after exit
      }
    } else if (!this.keys.interact) {
      this.wasInteracting = false;
    }
    
    // Update throttle
    if (this.keys.throttleUp) {
      this.throttle = Math.min(this.throttle + 0.5 * deltaTime, 1.0);
    }
    if (this.keys.throttleDown) {
      this.throttle = Math.max(this.throttle - 0.5 * deltaTime, 0);
    }
    
    // Update control surfaces
    let targetElevator = 0;
    let targetRudder = 0;
    let targetAileron = 0;
    
    if (this.keys.pitchUp) targetElevator = this.maxControlAngle;
    if (this.keys.pitchDown) targetElevator = -this.maxControlAngle;
    if (this.keys.yawLeft) targetRudder = this.maxControlAngle;
    if (this.keys.yawRight) targetRudder = -this.maxControlAngle;
    if (this.keys.rollLeft) targetAileron = -this.maxControlAngle;
    if (this.keys.rollRight) targetAileron = this.maxControlAngle;
    
    this.elevatorAngle += (targetElevator - this.elevatorAngle) * this.controlSpeed * deltaTime;
    this.rudderAngle += (targetRudder - this.rudderAngle) * this.controlSpeed * deltaTime;
    this.aileronAngle += (targetAileron - this.aileronAngle) * this.controlSpeed * deltaTime;
    
    // Get velocity
    const velocity = this.body.linvel();
    const speed = Math.sqrt(velocity.x * velocity.x + velocity.y * velocity.y + velocity.z * velocity.z);
    
    // Get plane orientation
    const planeQuat = new THREE.Quaternion(rot.x, rot.y, rot.z, rot.w);
    const forward = new THREE.Vector3(1, 0, 0).applyQuaternion(planeQuat);
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(planeQuat);
    const right = new THREE.Vector3(0, 0, 1).applyQuaternion(planeQuat);
    
    // Apply thrust
    if (this.engineOn) {
      const thrust = forward.multiplyScalar(this.throttle * this.maxThrust);
      this.body.applyImpulse({
        x: thrust.x * deltaTime,
        y: thrust.y * deltaTime,
        z: thrust.z * deltaTime
      });
    }
    
    // Apply lift (only if moving fast enough)
    if (speed > this.minSpeed) {
      const liftMagnitude = this.liftCoefficient * speed * speed * 0.01;
      const lift = up.multiplyScalar(liftMagnitude);
      this.body.applyImpulse({
        x: lift.x * deltaTime,
        y: lift.y * deltaTime,
        z: lift.z * deltaTime
      });
    }
    
    // Apply drag
    const dragMagnitude = this.dragCoefficient * speed * speed;
    const drag = new THREE.Vector3(velocity.x, velocity.y, velocity.z).normalize().multiplyScalar(-dragMagnitude);
    this.body.applyImpulse({
      x: drag.x * deltaTime,
      y: drag.y * deltaTime,
      z: drag.z * deltaTime
    });
    
    // Apply control surface torques
    const speedFactor = Math.min(speed / this.minSpeed, 1.0);
    
    // Elevator (pitch)
    if (Math.abs(this.elevatorAngle) > 0.01) {
      const pitchTorque = right.multiplyScalar(this.elevatorAngle * 30 * speedFactor);
      this.body.applyTorqueImpulse({
        x: pitchTorque.x,
        y: pitchTorque.y,
        z: pitchTorque.z
      });
    }
    
    // Rudder (yaw)
    if (Math.abs(this.rudderAngle) > 0.01) {
      const yawTorque = up.multiplyScalar(this.rudderAngle * 20 * speedFactor);
      this.body.applyTorqueImpulse({
        x: yawTorque.x,
        y: yawTorque.y,
        z: yawTorque.z
      });
    }
    
    // Ailerons (roll)
    if (Math.abs(this.aileronAngle) > 0.01) {
      const rollTorque = forward.multiplyScalar(this.aileronAngle * 40 * speedFactor);
      this.body.applyTorqueImpulse({
        x: rollTorque.x,
        y: rollTorque.y,
        z: rollTorque.z
      });
    }
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
  
  destroy() {
    // Remove visual mesh
    if (this.mesh) {
      this.scene.scene.remove(this.mesh);
      // Dispose of geometries and materials in the group
      this.mesh.traverse((child) => {
        if (child.geometry) child.geometry.dispose();
        if (child.material) child.material.dispose();
      });
    }
    
    // Remove physics body
    if (this.physics.world && this.body) {
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
