import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';

export class PhysicsManager {
  constructor() {
    this.world = null;
    this.gravity = {
      center: new THREE.Vector3(0, -230, 0),
      strength: 25
    };
    this.groundCollisions = new Set();
    this.lastGroundContact = 0;
  }

  async init() {
    try {
      await RAPIER.init({
        locateFile: (path) => {
          return `https://cdn.jsdelivr.net/npm/@dimforge/rapier3d-compat@0.11.2/${path}`;
        }
      });
      
      // Create physics world with no global gravity
      const gravityVec = { x: 0, y: 0, z: 0 };
      this.world = new RAPIER.World(gravityVec);
      
      // Set up collision event handling
      this.world.eventQueue = new RAPIER.EventQueue(true);
      this.world.contactForceEventQueue = new RAPIER.EventQueue(true);
      
      console.log("Physics world initialized");
      return true;
    } catch (error) {
      console.error("Failed to initialize physics:", error);
      throw error;
    }
  }

  step() {
    if (this.world) {
      this.world.step();
    }
  }

  processCollisionEvents(playerColliderHandle, callback) {
    if (!this.world?.eventQueue) return;
    
    this.world.eventQueue.drainCollisionEvents((handle1, handle2, started) => {
      let otherColliderHandle = null;
      
      if (handle1 === playerColliderHandle) {
        otherColliderHandle = handle2;
      } else if (handle2 === playerColliderHandle) {
        otherColliderHandle = handle1;
      }
      
      if (otherColliderHandle !== null) {
        const currentTime = performance.now();
        
        if (started) {
          this.groundCollisions.add(otherColliderHandle);
          this.lastGroundContact = currentTime;
        } else {
          this.groundCollisions.delete(otherColliderHandle);
        }
        
        if (callback) callback(otherColliderHandle, started);
      }
    });
  }

  applyGravityToBody(body, deltaTime) {
    const translation = body.translation();
    const pos = new THREE.Vector3(translation.x, translation.y, translation.z);
    
    const gravityDir = new THREE.Vector3()
      .subVectors(this.gravity.center, pos)
      .normalize();
    
    const gravityForce = gravityDir.multiplyScalar(this.gravity.strength * deltaTime);
    const velocity = body.linvel();
    
    body.setLinvel({
      x: velocity.x + gravityForce.x,
      y: velocity.y + gravityForce.y,
      z: velocity.z + gravityForce.z
    });
  }

  // Apply movement forces to a body (works for any controller type)
  applyMovementForces(body, movement, isGrounded, deltaTime) {
    if (!body || movement.length() === 0) return;
    
    // Scale movement for impulse-based control
    const impulse = movement.multiplyScalar(deltaTime * 60); // Scale for framerate independence
    
    body.applyImpulse({
      x: impulse.x,
      y: impulse.y,
      z: impulse.z
    });
    
    // Apply a small upward impulse when moving to help push objects
    if (isGrounded) {
      const position = body.translation();
      const upDirection = new THREE.Vector3(position.x, position.y, position.z);
      upDirection.normalize();
      
      const upImpulse = upDirection.multiplyScalar(0.5 * deltaTime);
      body.applyImpulse({
        x: upImpulse.x,
        y: upImpulse.y,
        z: upImpulse.z
      });
    }
  }

  castRay(origin, direction, maxDistance, excludeColliderHandle) {
    if (!this.world) return null;
    
    const ray = new RAPIER.Ray(
      { x: origin.x, y: origin.y, z: origin.z },
      { x: direction.x, y: direction.y, z: direction.z }
    );
    
    return this.world.castRay(
      ray,
      maxDistance,
      true,
      RAPIER.QueryFilterFlags.EXCLUDE_SENSORS,
      undefined,
      undefined,
      (colliderHandle) => colliderHandle !== excludeColliderHandle
    );
  }

  createFixedBody(translation, rotation = null) {
    const desc = RAPIER.RigidBodyDesc.fixed()
      .setTranslation(translation.x, translation.y, translation.z);
    
    if (rotation) {
      desc.setRotation(rotation);
    }
    
    return this.world.createRigidBody(desc);
  }

  createDynamicBody(translation, options = {}) {
    const desc = RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(translation.x, translation.y, translation.z)
      .setLinearDamping(options.linearDamping || 0.1)
      .setAngularDamping(options.angularDamping || 1.0)
      .setCanSleep(options.canSleep !== false);
    
    if (options.lockRotations) {
      desc.lockRotations();
    }
    
    if (options.rotation) {
      desc.setRotation(options.rotation);
    }
    
    return this.world.createRigidBody(desc);
  }

  createKinematicBody(translation) {
    const desc = RAPIER.RigidBodyDesc.kinematicPositionBased()
      .setTranslation(translation.x, translation.y, translation.z);
    
    return this.world.createRigidBody(desc);
  }

  createBoxCollider(halfExtents, options = {}) {
    const desc = RAPIER.ColliderDesc.cuboid(
      halfExtents.x,
      halfExtents.y,
      halfExtents.z
    );
    
    if (options.friction !== undefined) desc.setFriction(options.friction);
    if (options.restitution !== undefined) desc.setRestitution(options.restitution);
    if (options.density !== undefined) desc.setDensity(options.density);
    
    return desc;
  }

  createCapsuleCollider(halfHeight, radius, options = {}) {
    const desc = RAPIER.ColliderDesc.capsule(halfHeight, radius);
    
    if (options.friction !== undefined) desc.setFriction(options.friction);
    if (options.restitution !== undefined) desc.setRestitution(options.restitution);
    if (options.density !== undefined) desc.setDensity(options.density);
    
    if (options.activeCollisionTypes) {
      desc.setActiveCollisionTypes(options.activeCollisionTypes);
    }
    
    if (options.activeEvents) {
      desc.setActiveEvents(options.activeEvents);
    }
    
    return desc;
  }

  createBallCollider(radius, options = {}) {
    const desc = RAPIER.ColliderDesc.ball(radius);
    
    if (options.friction !== undefined) desc.setFriction(options.friction);
    if (options.restitution !== undefined) desc.setRestitution(options.restitution);
    if (options.density !== undefined) desc.setDensity(options.density);
    
    // Ensure proper collision detection with all geometry including trimeshes
    desc.setSolverGroups(0xFFFFFFFF); // Interact with all groups
    desc.setCollisionGroups(0xFFFFFFFF); // Collide with all groups
    
    return desc;
  }

  createTrimeshCollider(vertices, indices, options = {}) {
    const desc = RAPIER.ColliderDesc.trimesh(vertices, indices);
    
    if (options.friction !== undefined) desc.setFriction(options.friction);
    if (options.restitution !== undefined) desc.setRestitution(options.restitution);
    
    // Ensure trimesh collides with everything
    desc.setSolverGroups(0xFFFFFFFF);
    desc.setCollisionGroups(0xFFFFFFFF);
    
    return desc;
  }

  // Ground detection utilities
  checkGrounded(body, colliderHandle, height, radius) {
    if (!body || !colliderHandle) return null;
    
    const position = body.translation();
    const playerPos = new THREE.Vector3(position.x, position.y, position.z);
    const up = this.getUpDirection(playerPos);
    const rayDir = up.clone().multiplyScalar(-1);
    
    // Get body rotation
    const bodyQuat = new THREE.Quaternion(
      body.rotation().x,
      body.rotation().y,
      body.rotation().z,
      body.rotation().w
    );
    
    // Calculate foot positions
    const footOffset = radius * 0.8;
    const footHeight = -height * 0.5 + 0.1;
    
    const leftOffset = new THREE.Vector3(-footOffset, footHeight, 0).applyQuaternion(bodyQuat);
    const rightOffset = new THREE.Vector3(footOffset, footHeight, 0).applyQuaternion(bodyQuat);
    const centerOffset = new THREE.Vector3(0, footHeight, 0).applyQuaternion(bodyQuat);
    
    const leftFootPos = playerPos.clone().add(leftOffset);
    const rightFootPos = playerPos.clone().add(rightOffset);
    const centerFootPos = playerPos.clone().add(centerOffset);
    
    // Cast rays
    const maxDistance = 0.3;
    
    const leftFootHit = this.castRay(leftFootPos, rayDir, maxDistance, colliderHandle);
    const rightFootHit = this.castRay(rightFootPos, rayDir, maxDistance, colliderHandle);
    const centerFootHit = this.castRay(centerFootPos, rayDir, maxDistance, colliderHandle);
    
    // Check if any ray hit
    const isGrounded = leftFootHit !== null || rightFootHit !== null || centerFootHit !== null;
    
    // Also check recent collision events as fallback
    const currentTime = performance.now();
    const recentContact = (currentTime - this.lastGroundContact) < 100;
    const hasGroundContact = recentContact && this.groundCollisions.size > 0;
    
    // Calculate surface normal
    let surfaceNormal = null;
    
    if (centerFootHit?.normal) {
      surfaceNormal = new THREE.Vector3(
        centerFootHit.normal.x,
        centerFootHit.normal.y,
        centerFootHit.normal.z
      );
    } else if (leftFootHit?.normal || rightFootHit?.normal) {
      surfaceNormal = new THREE.Vector3(0, 0, 0);
      let normalCount = 0;
      
      if (leftFootHit?.normal) {
        surfaceNormal.add(new THREE.Vector3(
          leftFootHit.normal.x,
          leftFootHit.normal.y,
          leftFootHit.normal.z
        ));
        normalCount++;
      }
      
      if (rightFootHit?.normal) {
        surfaceNormal.add(new THREE.Vector3(
          rightFootHit.normal.x,
          rightFootHit.normal.y,
          rightFootHit.normal.z
        ));
        normalCount++;
      }
      
      if (normalCount > 0) {
        surfaceNormal.divideScalar(normalCount).normalize();
      }
    }
    
    if (!surfaceNormal) {
      surfaceNormal = up.clone();
    }
    
    return {
      isGrounded: isGrounded || hasGroundContact,
      surfaceNormal: surfaceNormal,
      hits: {
        left: leftFootHit,
        right: rightFootHit,
        center: centerFootHit
      },
      positions: {
        left: leftFootPos,
        right: rightFootPos,
        center: centerFootPos
      },
      rayDir: rayDir,
      closestHit: centerFootHit || leftFootHit || rightFootHit
    };
  }

  // Get up direction for a position
  getUpDirection(position) {
    const pos = position instanceof THREE.Vector3 ? position : 
      new THREE.Vector3(position.x, position.y, position.z);
    
    // Up is opposite to gravity direction
    const up = new THREE.Vector3()
      .subVectors(pos, this.gravity.center)
      .normalize();
    
    return up;
  }

  // Calculate alignment quaternion for surface
  calculateSurfaceAlignment(currentQuat, surfaceNormal, lerpFactor = 0.15) {
    const currentForward = new THREE.Vector3(0, 0, -1).applyQuaternion(currentQuat);
    
    const projectedForward = currentForward.clone()
      .sub(surfaceNormal.clone().multiplyScalar(currentForward.dot(surfaceNormal)))
      .normalize();
    
    if (projectedForward.lengthSq() < 0.1) {
      const worldForward = new THREE.Vector3(0, 0, -1);
      projectedForward.copy(worldForward)
        .sub(surfaceNormal.clone().multiplyScalar(worldForward.dot(surfaceNormal)))
        .normalize();
    }
    
    const right = new THREE.Vector3().crossVectors(projectedForward, surfaceNormal).normalize();
    const alignedForward = new THREE.Vector3().crossVectors(surfaceNormal, right).normalize();
    
    const rotationMatrix = new THREE.Matrix4();
    rotationMatrix.makeBasis(right, surfaceNormal, alignedForward.multiplyScalar(-1));
    
    const targetQuat = new THREE.Quaternion().setFromRotationMatrix(rotationMatrix);
    
    // Slerp to target
    const resultQuat = currentQuat.clone();
    resultQuat.slerp(targetQuat, lerpFactor);
    
    return resultQuat;
  }

  // Adjust position to ground
  adjustPositionToGround(body, closestHit, height, gravityDir, strength = 0.3) {
    if (!closestHit || closestHit.toi === undefined) return false;
    
    const playerTranslation = body.translation();
    const hitPoint = new THREE.Vector3(
      closestHit.point.x,
      closestHit.point.y,
      closestHit.point.z
    );
    
    const upDir = gravityDir.clone().multiplyScalar(-1);
    const targetPlayerCenter = hitPoint.clone().add(upDir.clone().multiplyScalar(height * 0.5));
    targetPlayerCenter.add(upDir.clone().multiplyScalar(0.05));
    
    const currentPos = new THREE.Vector3(playerTranslation.x, playerTranslation.y, playerTranslation.z);
    const correction = targetPlayerCenter.clone().sub(currentPos);
    
    if (correction.length() > 0.01 && correction.length() < 2.0) {
      correction.multiplyScalar(strength);
      body.setTranslation({
        x: currentPos.x + correction.x,
        y: currentPos.y + correction.y,
        z: currentPos.z + correction.z
      });
      return true;
    }
    
    return false;
  }
}
