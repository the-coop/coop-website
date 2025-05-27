import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { PhysicsManager } from './physics.js';
import { SceneManager } from './scene.js';
import { FPSController } from './fpsController.js';

export class Game {
  constructor() {
    this.physics = new PhysicsManager();
    this.scene = new SceneManager(this.physics);
    this.player = null;
    
    this.clock = new THREE.Clock();
    this.started = false;
    this.loading = true;
    
    this.frameCount = 0;
    this.debugInfo = {
      isGrounded: false,
      position: new THREE.Vector3(),
      isMoving: false,
      currentSpeed: 0,
      facing: new THREE.Vector3(0, 0, -1)
    };
    
    // Bound methods
    this.animate = this.animate.bind(this);
    this.onKeyDown = this.onKeyDown.bind(this);
    this.onKeyUp = this.onKeyUp.bind(this);
    this.onMouseMove = this.onMouseMove.bind(this);
    this.onPointerLockChange = this.onPointerLockChange.bind(this);
    this.onResize = this.onResize.bind(this);
  }

  async init(canvas) {
    try {
      console.log("Initializing game...");
      
      // Initialize physics
      await this.physics.init();
      
      // Initialize scene
      this.scene.init(canvas);
      
      // Create world
      this.scene.createPlanet();
      this.scene.createPlatform();
      
      // Create player
      this.player = new FPSController(this.scene, this.physics);
      this.player.create();
      
      // Setup event listeners
      this.setupEventListeners();
      
      this.loading = false;
      console.log("Game initialized successfully");
      
      return true;
    } catch (error) {
      console.error("Failed to initialize game:", error);
      this.loading = false;
      throw error;
    }
  }

  setupEventListeners() {
    window.addEventListener('resize', this.onResize);
    document.addEventListener('keydown', this.onKeyDown);
    document.addEventListener('keyup', this.onKeyUp);
    document.addEventListener('mousemove', this.onMouseMove);
    document.addEventListener('pointerlockchange', this.onPointerLockChange);
  }

  start() {
    if (this.started) return;
    
    this.started = true;
    this.clock.start();
    this.animate();
    
    console.log("Game started");
  }

  animate() {
    if (!this.started) return;
    
    requestAnimationFrame(this.animate);
    
    const deltaTime = Math.min(this.clock.getDelta(), 0.1);
    
    // Step physics
    this.physics.step();
    
    // Process collision events
    if (this.player) {
      this.physics.processCollisionEvents(this.player.colliderHandle, (handle, started) => {
        // Collision callback if needed
      });
    }
    
    // Apply gravity to all dynamic bodies
    this.applyGlobalGravity(deltaTime);
    
    // Update player
    if (this.player) {
      this.player.update(deltaTime);
      
      // Update debug info
      this.debugInfo.isGrounded = this.player.isGrounded;
      this.debugInfo.position = this.player.getPosition();
      this.debugInfo.facing = this.player.getFacing();
      this.debugInfo.currentSpeed = this.player.getSpeed();
      this.debugInfo.isMoving = this.player.keys.forward || this.player.keys.backward || 
                               this.player.keys.left || this.player.keys.right;
    }
    
    // Update scene dynamic objects
    this.scene.updateDynamicObjects();
    
    // Render
    this.scene.render();
    
    this.frameCount++;
  }

  applyGlobalGravity(deltaTime) {
    if (!this.scene.scene) return;
    
    // Apply gravity to player
    if (this.player && this.player.body) {
      this.physics.applyGravityToBody(this.player.body, deltaTime);
    }
    
    // Apply gravity to all dynamic objects
    this.scene.scene.traverse((child) => {
      if (child.isMesh && child.userData.physicsBody) {
        this.physics.applyGravityToBody(child.userData.physicsBody, deltaTime);
      }
    });
  }

  onKeyDown(event) {
    if (!this.started || !this.player) return;
    
    switch (event.code) {
      case 'KeyW':
      case 'ArrowUp':
        this.player.keys.forward = true;
        break;
      case 'KeyS':
      case 'ArrowDown':
        this.player.keys.backward = true;
        break;
      case 'KeyA':
      case 'ArrowLeft':
        this.player.keys.left = true;
        break;
      case 'KeyD':
      case 'ArrowRight':
        this.player.keys.right = true;
        break;
      case 'KeyQ':
        this.player.keys.rollLeft = true;
        break;
      case 'KeyE':
        this.player.keys.rollRight = true;
        break;
      case 'Space':
        if (this.player.isGrounded) {
          this.player.keys.jump = true;
        }
        break;
      case 'ShiftLeft':
        this.player.keys.run = true;
        break;
      case 'KeyO':
        this.player.toggleCamera();
        break;
    }
  }

  onKeyUp(event) {
    if (!this.started || !this.player) return;
    
    switch (event.code) {
      case 'KeyW':
      case 'ArrowUp':
        this.player.keys.forward = false;
        break;
      case 'KeyS':
      case 'ArrowDown':
        this.player.keys.backward = false;
        break;
      case 'KeyA':
      case 'ArrowLeft':
        this.player.keys.left = false;
        break;
      case 'KeyD':
      case 'ArrowRight':
        this.player.keys.right = false;
        break;
      case 'KeyQ':
        this.player.keys.rollLeft = false;
        break;
      case 'KeyE':
        this.player.keys.rollRight = false;
        break;
      case 'Space':
        this.player.keys.jump = false;
        break;
      case 'ShiftLeft':
        this.player.keys.run = false;
        break;
    }
  }

  onMouseMove(event) {
    if (!this.started || !this.player) return;
    if (document.pointerLockElement !== this.scene.renderer.domElement) return;
    
    this.player.handleMouseMove(event);
  }

  onPointerLockChange() {
    if (document.pointerLockElement !== this.scene.renderer?.domElement) {
      // Reset all keys when pointer lock is lost
      if (this.player) {
        Object.keys(this.player.keys).forEach(key => {
          this.player.keys[key] = false;
        });
      }
    }
  }

  onResize() {
    this.scene.onResize();
  }

  requestPointerLock() {
    if (this.scene.renderer) {
      this.scene.renderer.domElement.requestPointerLock();
    }
  }

  destroy() {
    this.started = false;
    
    // Remove event listeners
    window.removeEventListener('resize', this.onResize);
    document.removeEventListener('keydown', this.onKeyDown);
    document.removeEventListener('keyup', this.onKeyUp);
    document.removeEventListener('mousemove', this.onMouseMove);
    document.removeEventListener('pointerlockchange', this.onPointerLockChange);
  }
}
