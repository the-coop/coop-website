import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';

export class PhysicsSystem {
  constructor() {
    this.world = null;
    this.eventQueue = null;
    this.initialized = false;
  }

  async init() {
    try {
      await RAPIER.init({
        locateFile: (path) => {
          console.log("Locating Rapier file:", path);
          return `https://cdn.jsdelivr.net/npm/@dimforge/rapier3d-compat@0.11.2/${path}`;
        }
      });
      console.log("Rapier physics engine initialized successfully");
      
      // Create physics world with no gravity (we'll apply custom gravity)
      const gravityVec = { x: 0, y: 0, z: 0 };
      this.world = new RAPIER.World(gravityVec);
      this.eventQueue = new RAPIER.EventQueue(true);
      
      this.initialized = true;
      console.log("Physics world created with disabled gravity");
      
      return true;
    } catch (error) {
      console.error("Error initializing physics:", error);
      throw error;
    }
  }

  step() {
    if (!this.world) return;
    this.world.step(this.eventQueue);
  }

  createRigidBody(desc) {
    if (!this.world) throw new Error("Physics world not initialized");
    return this.world.createRigidBody(desc);
  }

  createCollider(desc, body) {
    if (!this.world) throw new Error("Physics world not initialized");
    return this.world.createCollider(desc, body);
  }

  drainCollisionEvents(callback) {
    if (!this.eventQueue) return;
    this.eventQueue.drainCollisionEvents(callback);
  }

  castRay(origin, direction, maxDistance, solid = true, filterFlags = RAPIER.QueryFilterFlags.EXCLUDE_SENSORS, groups, excludeCollider, excludeRigidBody) {
    if (!this.world) return null;
    
    const ray = new RAPIER.Ray(origin, direction);
    return this.world.castRay(ray, maxDistance, solid, filterFlags, groups, excludeCollider, excludeRigidBody);
  }

  dispose() {
    if (this.world) {
      this.world.free();
      this.world = null;
    }
    if (this.eventQueue) {
      this.eventQueue.free();
      this.eventQueue = null;
    }
    this.initialized = false;
  }
}

export class PlayerPhysics {
  constructor(physics, scene, config = {}) {
    this.physics = physics;
    this.scene = scene;
    
    // Configuration
    this.height = config.height || 1.8;
    this.radius = config.radius || 0.4;
    this.walkSpeed = config.walkSpeed || 8;
    this.runSpeed = config.runSpeed || 16;
    this.jumpForce = config.jumpForce || 8;
    this.airControl = config.airControl || 1.0;
    
    // Physics components
    this.body = null;
    this.collider = null;
    this.colliderHandle = null;
    
    // State
    this.isGrounded = false;
    this.wasGrounded = false;
    this.jumpInProgress = false;
    this.jumpTime = 0;
    this.lastGroundNormal = new THREE.Vector3(0, 1, 0);
    
    // Collision tracking
    this.groundCollisions = new Set();
    this.lastGroundContact = 0;
  }

  create(position = new THREE.Vector3(0, 35, 0)) {
    if (!this.physics.world) throw new Error("Physics not initialized");
    
    // Create physics body
    const bodyDesc = RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(position.x, position.y, position.z)
      .setLinearDamping(0.1)
      .setAngularDamping(1.0)
      .setCanSleep(false)
      .lockRotations();
    
    this.body = this.physics.createRigidBody(bodyDesc);
    
    // Create collider
    const colliderDesc = RAPIER.ColliderDesc.capsule(
      this.height / 2 - this.radius,
      this.radius
    )
    .setFriction(0.0)
    .setRestitution(0.0)
    .setDensity(1.0)
    .setActiveCollisionTypes(RAPIER.ActiveCollisionTypes.DEFAULT)
    .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS);
    
    this.collider = this.physics.createCollider(colliderDesc, this.body);
    this.colliderHandle = this.collider.handle;
    
    return this.body;
  }

  update(deltaTime, keys, gravityCenter, gravityStrength, cameraRotation) {
    if (!this.body) return;
    
    const velocity = this.body.linvel();
    const position = this.body.translation();
    const playerPos = new THREE.Vector3(position.x, position.y, position.z);
    
    // Calculate gravity
    const gravityDir = new THREE.Vector3()
      .subVectors(gravityCenter, playerPos)
      .normalize();
    
    const gravityForce = gravityDir.clone().multiplyScalar(gravityStrength * deltaTime);
    
    // Apply gravity
    let newVel = new THREE.Vector3(
      velocity.x + gravityForce.x,
      velocity.y + gravityForce.y,
      velocity.z + gravityForce.z
    );
    
    // Handle movement
    const movement = this.calculateMovement(keys, deltaTime, cameraRotation);
    
    if (this.isGrounded) {
      // Ground movement
      const groundAccel = 100.0;
      newVel.add(movement.multiplyScalar(groundAccel * deltaTime));
      
      // Apply friction when not moving
      if (movement.length() < 0.01) {
        newVel.x *= 0.8;
        newVel.y *= 0.95;
        newVel.z *= 0.8;
      }
      
      // Clamp to max speed
      const speed = keys.run ? this.runSpeed : this.walkSpeed;
      if (newVel.length() > speed * 1.5) {
        newVel.normalize().multiplyScalar(speed * 1.5);
      }
    } else {
      // Air movement
      newVel.add(movement.multiplyScalar(this.airControl * deltaTime));
      
      // Air resistance
      newVel.x *= 0.95;
      newVel.y *= 0.98;
      newVel.z *= 0.95;
    }
    
    // Handle jumping
    if (keys.jump && this.isGrounded && !this.jumpInProgress) {
      const jumpVector = gravityDir.clone().multiplyScalar(-this.jumpForce);
      newVel.add(jumpVector);
      this.jumpInProgress = true;
      this.jumpTime = 0;
    }
    
    // Update jump progress
    if (this.jumpInProgress) {
      this.jumpTime += deltaTime;
      if (this.jumpTime >= 0.5 || this.isGrounded) {
        this.jumpInProgress = false;
      }
    }
    
    // Apply new velocity
    this.body.setLinvel({
      x: newVel.x,
      y: newVel.y,
      z: newVel.z
    });
    
    return newVel;
  }

  calculateMovement(keys, deltaTime, cameraRotation) {
    let moveForward = 0;
    let moveRight = 0;
    
    if (keys.forward) moveForward += 1;
    if (keys.backward) moveForward -= 1;
    if (keys.left) moveRight -= 1;
    if (keys.right) moveRight += 1;
    
    const moveLength = Math.sqrt(moveForward * moveForward + moveRight * moveRight);
    if (moveLength > 0) {
      moveForward /= moveLength;
      moveRight /= moveLength;
    }
    
    const speed = keys.run ? this.runSpeed : this.walkSpeed;
    moveForward *= speed;
    moveRight *= speed;
    
    // Get movement direction from player rotation
    const playerQuat = new THREE.Quaternion(
      this.body.rotation().x,
      this.body.rotation().y,
      this.body.rotation().z,
      this.body.rotation().w
    );
    
    let forward = new THREE.Vector3(0, 0, -1).applyQuaternion(playerQuat);
    let right = new THREE.Vector3(1, 0, 0).applyQuaternion(playerQuat);
    
    // Project onto surface when grounded
    if (this.isGrounded && this.lastGroundNormal) {
      forward.projectOnPlane(this.lastGroundNormal).normalize();
      right.projectOnPlane(this.lastGroundNormal).normalize();
    }
    
    // Calculate final movement vector
    const moveDir = new THREE.Vector3();
    moveDir.addScaledVector(forward, moveForward);
    moveDir.addScaledVector(right, moveRight);
    
    return moveDir;
  }

  checkGrounded(physics, gravityCenter) {
    if (!this.body) return;
    
    this.wasGrounded = this.isGrounded;
    
    const position = this.body.translation();
    const playerPos = new THREE.Vector3(position.x, position.y, position.z);
    
    // Calculate gravity direction for rays
    const gravityDir = new THREE.Vector3()
      .subVectors(gravityCenter, playerPos)
      .normalize();
    
    // Cast ground detection rays
    const footLevel = -this.height * 0.5;
    const results = this.castGroundRays(playerPos, gravityDir, footLevel);
    
    // Check grounding conditions
    const hasGroundCollisions = this.groundCollisions.size > 0;
    const hasRayHits = results.some(r => r.hit !== null);
    const velocity = this.body.linvel();
    const vel = new THREE.Vector3(velocity.x, velocity.y, velocity.z);
    const lowDownwardVelocity = vel.dot(gravityDir) < 2.0;
    
    this.isGrounded = (hasGroundCollisions && lowDownwardVelocity) || 
                     (hasRayHits && lowDownwardVelocity);
    
    // Update ground normal
    if (this.isGrounded && results.some(r => r.hit?.normal)) {
      const centerHit = results[2].hit; // Center ray
      if (centerHit?.normal) {
        this.lastGroundNormal.set(
          centerHit.normal.x,
          centerHit.normal.y,
          centerHit.normal.z
        );
      }
    }
    
    return results;
  }

  castGroundRays(playerPos, gravityDir, footLevel) {
    const playerQuat = new THREE.Quaternion(
      this.body.rotation().x,
      this.body.rotation().y,
      this.body.rotation().z,
      this.body.rotation().w
    );
    
    const footOffset = this.radius * 0.8;
    
    // Calculate foot positions
    const leftOffset = new THREE.Vector3(-footOffset, footLevel, 0).applyQuaternion(playerQuat);
    const rightOffset = new THREE.Vector3(footOffset, footLevel, 0).applyQuaternion(playerQuat);
    const centerOffset = new THREE.Vector3(0, footLevel, 0).applyQuaternion(playerQuat);
    
    const leftFoot = playerPos.clone().add(leftOffset);
    const rightFoot = playerPos.clone().add(rightOffset);
    const centerFoot = playerPos.clone().add(centerOffset);
    
    // Cast rays
    const rayDistance = 0.5;
    
    const castRay = (origin) => {
      return this.physics.castRay(
        { x: origin.x, y: origin.y, z: origin.z },
        { x: gravityDir.x, y: gravityDir.y, z: gravityDir.z },
        rayDistance,
        true,
        RAPIER.QueryFilterFlags.EXCLUDE_SENSORS,
        undefined,
        undefined,
        (handle) => handle !== this.colliderHandle
      );
    };
    
    return [
      { position: leftFoot, hit: castRay(leftFoot) },
      { position: rightFoot, hit: castRay(rightFoot) },
      { position: centerFoot, hit: castRay(centerFoot) }
    ];
  }

  handleCollisionEvent(handle1, handle2, started) {
    let otherHandle = null;
    
    if (handle1 === this.colliderHandle) {
      otherHandle = handle2;
    } else if (handle2 === this.colliderHandle) {
      otherHandle = handle1;
    }
    
    if (otherHandle !== null) {
      if (started) {
        this.groundCollisions.add(otherHandle);
        this.lastGroundContact = performance.now();
      } else {
        this.groundCollisions.delete(otherHandle);
      }
    }
  }

  alignToSurface(gravityDirection) {
    if (!this.isGrounded || !this.body) return;
    
    const currentQuat = new THREE.Quaternion(
      this.body.rotation().x,
      this.body.rotation().y,
      this.body.rotation().z,
      this.body.rotation().w
    );
    
    const currentForward = new THREE.Vector3(0, 0, -1).applyQuaternion(currentQuat);
    
    const surfaceNormal = this.lastGroundNormal;
    const projectedForward = currentForward.clone()
      .sub(surfaceNormal.clone().multiplyScalar(currentForward.dot(surfaceNormal)))
      .normalize();
    
    if (projectedForward.lengthSq() < 0.1) {
      projectedForward.set(1, 0, 0).projectOnPlane(surfaceNormal).normalize();
    }
    
    const right = new THREE.Vector3().crossVectors(projectedForward, surfaceNormal).normalize();
    const alignedForward = new THREE.Vector3().crossVectors(surfaceNormal, right).normalize();
    
    const rotationMatrix = new THREE.Matrix4();
    rotationMatrix.makeBasis(right, surfaceNormal, alignedForward.multiplyScalar(-1));
    
    const targetQuat = new THREE.Quaternion().setFromRotationMatrix(rotationMatrix);
    currentQuat.slerp(targetQuat, 0.15);
    
    this.body.setRotation({
      x: currentQuat.x,
      y: currentQuat.y,
      z: currentQuat.z,
      w: currentQuat.w
    });
  }

  handleAirborneRotation(keys, deltaTime) {
    if (this.isGrounded || !this.body) return;
    
    const rollSensitivity = 2.0;
    let rollDelta = 0;
    
    if (keys.rollLeft) rollDelta -= rollSensitivity * deltaTime;
    if (keys.rollRight) rollDelta += rollSensitivity * deltaTime;
    
    if (Math.abs(rollDelta) > 0.001) {
      const currentQuat = new THREE.Quaternion(
        this.body.rotation().x,
        this.body.rotation().y,
        this.body.rotation().z,
        this.body.rotation().w
      );
      
      const localForward = new THREE.Vector3(0, 0, -1).applyQuaternion(currentQuat);
      const rollQuat = new THREE.Quaternion().setFromAxisAngle(localForward, rollDelta);
      
      currentQuat.premultiply(rollQuat);
      
      this.body.setRotation({
        x: currentQuat.x,
        y: currentQuat.y,
        z: currentQuat.z,
        w: currentQuat.w
      });
    }
  }

  dispose() {
    this.groundCollisions.clear();
    this.body = null;
    this.collider = null;
  }
}

// Export RAPIER for use in components
export { RAPIER };
