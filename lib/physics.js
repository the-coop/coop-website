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

  createTrimeshCollider(vertices, indices, options = {}) {
    const desc = RAPIER.ColliderDesc.trimesh(vertices, indices);
    
    if (options.friction !== undefined) desc.setFriction(options.friction);
    if (options.restitution !== undefined) desc.setRestitution(options.restitution);
    
    return desc;
  }

  createBallCollider(radius, options = {}) {
    const desc = RAPIER.ColliderDesc.ball(radius);
    
    if (options.friction !== undefined) desc.setFriction(options.friction);
    if (options.restitution !== undefined) desc.setRestitution(options.restitution);
    if (options.density !== undefined) desc.setDensity(options.density);
    
    return desc;
  }
}
