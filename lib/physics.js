import RAPIER from '@dimforge/rapier3d-compat';
import * as THREE from 'three';

export class PhysicsManager {
  constructor() {
    this.world = null;
    this.gravity = {
      center: new THREE.Vector3(0, -230, 0),
      strength: 25
    };
  }

  async init() {
    await RAPIER.init({
      locateFile: (path) => {
        return `https://cdn.jsdelivr.net/npm/@dimforge/rapier3d-compat@0.11.2/${path}`;
      }
    });
    
    // Create physics world with no global gravity (we'll use planet-centered gravity)
    const gravityVec = { x: 0, y: 0, z: 0 };
    this.world = new RAPIER.World(gravityVec);
    
    // Set up collision event handling
    this.world.eventQueue = new RAPIER.EventQueue(true);
    this.world.contactForceEventQueue = new RAPIER.EventQueue(true);
    
    return this.world;
  }

  applyPlanetGravity(body, deltaTime) {
    const translation = body.translation();
    const position = new THREE.Vector3(translation.x, translation.y, translation.z);
    
    // Calculate gravity direction from planet center
    const gravityDir = new THREE.Vector3()
      .subVectors(this.gravity.center, position)
      .normalize();
    
    // Apply gravity force
    const gravityForce = gravityDir.multiplyScalar(this.gravity.strength * deltaTime);
    const velocity = body.linvel();
    
    body.setLinvel({
      x: velocity.x + gravityForce.x,
      y: velocity.y + gravityForce.y,
      z: velocity.z + gravityForce.z
    });
  }

  step() {
    if (this.world) {
      this.world.step();
    }
  }

  createStaticBody(position) {
    return RAPIER.RigidBodyDesc.fixed()
      .setTranslation(position.x, position.y, position.z);
  }

  createDynamicBody(position, options = {}) {
    const desc = RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(position.x, position.y, position.z);
    
    if (options.linearDamping) desc.setLinearDamping(options.linearDamping);
    if (options.angularDamping) desc.setAngularDamping(options.angularDamping);
    if (options.canSleep !== undefined) desc.setCanSleep(options.canSleep);
    if (options.lockRotations) desc.lockRotations();
    
    return desc;
  }

  createKinematicBody(position) {
    return RAPIER.RigidBodyDesc.kinematicPositionBased()
      .setTranslation(position.x, position.y, position.z);
  }
}

export { RAPIER };
