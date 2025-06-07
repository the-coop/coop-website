import * as THREE from 'three';
import { CarController } from '../control/carController.js';
import { PlaneController } from '../control/planeController.js';
import { HelicopterController } from '../control/helicopterController.js';
import { SpaceshipController } from '../control/spaceshipController.js';
import { WeaponSystem } from './weapons.js';
import { createRockModel } from '../models/rock.js';
import { createPlatformModel, createMovingPlatformModel, createDynamicPlatformModel } from '../models/platform.js';
import { createWallModel } from '../models/wall.js';
import { createRampModel } from '../models/ramp.js';
import { createWaterVolumeModel, createSphericalWaterVolumeModel } from '../models/water.js';
import { PlanetModel } from '../models/planet.js';

export class SceneManager {
  constructor(physicsManager) {
    this.physics = physicsManager;
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.lights = {
      ambient: null,
      directional: null
    };
    this.objects = {
      planet: null,
      platform: null,
      movingPlatform: null,
      movingPlatformBody: null
    };
    this.gameMode = null;
    this.dynamicObjects = new Map(); // Track dynamic objects
    this.multiplayerSpawnPosition = null; // Store spawn position for multiplayer
    this.vehicles = new Map(); // Add vehicles tracking
    this.waterVolumes = new Map(); // Track water volumes
  }

  init(canvas) {
    // Create scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x111122);
    this.scene.fog = new THREE.Fog(0x111122, 100, 300);
    
    // Create camera
    this.camera = new THREE.PerspectiveCamera(
      75, 
      window.innerWidth / window.innerHeight, 
      0.1, 
      1000
    );
    
    // Create renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    
    // Don't set size here to avoid inline styles
    canvas.appendChild(this.renderer.domElement);
    
    // Set size after appending to use container dimensions
    this.onResize();
    
    // Add lights
    this.lights.ambient = new THREE.AmbientLight(0x444444, 0.4);
    this.scene.add(this.lights.ambient);
    
    this.lights.directional = new THREE.DirectionalLight(0xffffff, 0.8);
    this.lights.directional.position.set(50, 200, 100);
    this.lights.directional.castShadow = true;
    this.lights.directional.shadow.mapSize.width = 2048;
    this.lights.directional.shadow.mapSize.height = 2048;
    this.lights.directional.shadow.camera.near = 0.5;
    this.lights.directional.shadow.camera.far = 500;
    this.lights.directional.shadow.camera.left = -100;
    this.lights.directional.shadow.camera.right = 100;
    this.lights.directional.shadow.camera.top = 100;
    this.lights.directional.shadow.camera.bottom = -100;
    this.scene.add(this.lights.directional);
    
    // Set scene reference in physics manager for water checks
    this.physics.scene = this;
    
    return true;
  }

  setGameMode(mode) {
    this.gameMode = mode;
  }

  createPlanet() {
    const planetRadius = 200;
    const planetY = -250;
    
    // Create planet physics body
    const planetBody = this.physics.createFixedBody(new THREE.Vector3(0, planetY, 0));
    this.objects.planetBody = planetBody;
    
    // Create planet using the new model
    const planetModel = new PlanetModel(planetRadius, 30);
    const mesh = planetModel.createMesh(new THREE.Vector3(0, planetY, 0));
    this.objects.planet = mesh;
    this.scene.add(mesh);
    
    // Create collision mesh
    const collisionData = planetModel.getCollisionData(mesh.geometry);
    const trimeshDesc = this.physics.createTrimeshCollider(
      collisionData.vertices,
      collisionData.indices,
      { friction: 0.8, restitution: 0.1 }
    );
    
    this.physics.world.createCollider(trimeshDesc, planetBody);
    
    // Update gravity center
    this.physics.gravity.center.set(0, planetY, 0);
    
    // Create spherical water volume at planet center for sandbox mode
    if (this.gameMode === 'sandbox') {
      this.createPlanetWaterSphere(planetRadius, planetY);
    }
    
    // Add planet features for all modes
    if (this.gameMode === 'multiplayer' || this.gameMode === 'sandbox') {
      this.addPlanetFeatures();
    }
    
    return this.objects.planet;
  }

  createPlanetWaterSphere(planetRadius, planetY) {
    // Create a spherical water volume at 102% of planet radius
    const waterRadius = planetRadius * 1.02; // Reduced from 1.05 to 1.02
    const waterPosition = new THREE.Vector3(0, planetY, 0);
    
    console.log('Creating spherical water volume at planet center with radius:', waterRadius, 'at position:', waterPosition);
    
    const water = createSphericalWaterVolumeModel(waterRadius, {
      color: '#2266ff',
      opacity: 0.6
    });
    water.position.copy(waterPosition);
    this.scene.add(water);
    
    // Create physics sensor for water detection
    const waterBody = this.physics.createFixedBody(waterPosition);
    const colliderDesc = this.physics.createBallCollider(waterRadius, {
      friction: 0.0,
      restitution: 0.0,
      isSensor: true
    });
    
    colliderDesc.setSensor(true);
    colliderDesc.setCollisionGroups(0x00020000);
    
    const collider = this.physics.world.createCollider(colliderDesc, waterBody);
    
    // Store spherical water volume info
    const volumeId = 'planet_water_sphere';
    this.waterVolumes.set(volumeId, {
      mesh: water,
      body: waterBody,
      collider: collider,
      isSpherical: true,
      center: waterPosition.clone(),
      radius: waterRadius,
      bounds: {
        min: new THREE.Vector3(
          waterPosition.x - waterRadius,
          waterPosition.y - waterRadius,
          waterPosition.z - waterRadius
        ),
        max: new THREE.Vector3(
          waterPosition.x + waterRadius,
          waterPosition.y + waterRadius,
          waterPosition.z + waterRadius
        )
      }
    });
    
    water.userData.waterVolume = true;
    water.userData.volumeId = volumeId;
    water.userData.isSpherical = true;
    
    console.log('Spherical water volume created and added to scene');
  }

  addPlanetFeatures() {
    for (let i = 0; i < 20; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      
      const x = Math.sin(phi) * Math.cos(theta);
      const y = Math.cos(phi);
      const z = Math.sin(phi) * Math.sin(theta);
      
      const radius = 205;
      const rockPos = new THREE.Vector3(x * radius, y * radius, z * radius);
      rockPos.add(new THREE.Vector3(0, -250, 0));
      
      const scale = 0.5 + Math.random() * 1.5;
      this.createPushableRock(rockPos, scale);
    }
    
    // Add a test car in multiplayer
    if (this.gameMode === 'multiplayer') {
      // Don't spawn local car anymore - server will handle it
      console.log('Multiplayer mode - vehicles will be spawned by server');
    }
  }

  createPushableRock(position, scale = 1.0, objectId = null) {
    // Check if physics world is ready
    if (!this.physics.world) {
      console.error('Cannot create rock: physics world not initialized');
      return null;
    }
    
    const rock = createRockModel(scale);
    rock.position.copy(position);
    
    this.scene.add(rock);
    
    // Create physics body with lower mass
    const rockBody = this.physics.createDynamicBody(position, {
      linearDamping: 2.0,  // Match server settings
      angularDamping: 1.0,
      rotation: {
        x: rock.quaternion.x,
        y: rock.quaternion.y,
        z: rock.quaternion.z,
        w: rock.quaternion.w
      }
    });
    
    // Check if body was created successfully
    if (!rockBody) {
      console.error('Failed to create physics body for rock');
      this.scene.remove(rock);
      if (rock.geometry) rock.geometry.dispose();
      if (rock.material) rock.material.dispose();
      return null;
    }
    
    // Use actual scale for collider
    const colliderDesc = this.physics.createBallCollider(2 * scale, {
      density: 0.3 * 0.3,  // Match server's reduced density
      friction: 0.8,
      restitution: 0.3
    });
    
    const collider = this.physics.world.createCollider(colliderDesc, rockBody);
    
    // Check if collider was created successfully
    if (!collider) {
      console.error('Failed to create collider for rock');
      this.physics.world.removeRigidBody(rockBody);
      this.scene.remove(rock);
      if (rock.geometry) rock.geometry.dispose();
      if (rock.material) rock.material.dispose();
      return null;
    }
    
    rock.userData.physicsBody = rockBody;
    rock.userData.objectId = objectId;
    
    // Track dynamic object if it has an ID
    if (objectId) {
      this.dynamicObjects.set(objectId, {
        mesh: rock,
        body: rockBody,
        type: 'rock',
        scale: scale
      });
    }
    
    return rock;
  }

  // Spawn a rock for multiplayer
  spawnMultiplayerRock(objectId, position = null, scale = 1.0) {
    if (this.gameMode !== 'multiplayer') return null;
    
    console.log(`Spawning multiplayer rock ${objectId} at`, position, 'with scale', scale);
    
    const rock = createRockModel(scale);
    rock.position.copy(position);
    
    this.scene.add(rock);
    
    // Create dynamic physics body for proper collision detection
    const rockBody = this.physics.createDynamicBody(position, {
      linearDamping: 10.0,  // High damping to prevent drift
      angularDamping: 10.0, // High damping to prevent rotation
      rotation: {
        x: rock.quaternion.x,
        y: rock.quaternion.y,
        z: rock.quaternion.z,
        w: rock.quaternion.w
      }
    });
    
    // Check if body was created successfully
    if (!rockBody) {
      console.error('Failed to create physics body for multiplayer rock');
      this.scene.remove(rock);
      if (rock.geometry) rock.geometry.dispose();
      if (rock.material) rock.material.dispose();
      return null;
    }
    
    // Use the actual scale for the collider - match server exactly
    const colliderDesc = this.physics.createBallCollider(2 * scale, {
      density: 0.3 * 0.3,  // Match server's reduced density
      friction: 0.8,
      restitution: 0.3
    });
    
    const collider = this.physics.world.createCollider(colliderDesc, rockBody);
    
    // Check if collider was created successfully
    if (!collider) {
      console.error('Failed to create collider for multiplayer rock');
      this.physics.world.removeRigidBody(rockBody);
      this.scene.remove(rock);
      if (rock.geometry) rock.geometry.dispose();
      if (rock.material) rock.material.dispose();
      return null;
    }
    
    rock.userData.physicsBody = rockBody;
    rock.userData.objectId = objectId;
    
    // Track dynamic object with physics body
    this.dynamicObjects.set(objectId, {
      mesh: rock,
      body: rockBody, // Dynamic body for proper collision
      type: 'rock',
      scale: scale,
      collider: collider,
      isMultiplayer: true, // Flag to handle updates differently
      lastServerUpdate: {
        position: position.clone(),
        rotation: rock.quaternion.clone(),
        velocity: new THREE.Vector3(),
        timestamp: performance.now()
      }
    });
    
    return rock;
  }

  // Add method to spawn a test car
  spawnTestCar(position = null) {
    // Import dynamically to avoid circular dependencies
    import('../control/carController.js').then(({ CarController }) => {
      const carPos = position || new THREE.Vector3(10, 35, 10);
      const car = new CarController(this, this.physics, carPos);
      
      // Generate unique ID for the car
      const carId = 'car_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
      this.vehicles.set(carId, car);
      
      console.log(`Spawned test car ${carId} at`, carPos);
      return car;
    }).catch(err => {
      console.error('Failed to load CarController:', err);
    });
  }
  
  // Update vehicles
  updateVehicles(deltaTime) {
    this.vehicles.forEach((car, id) => {
      car.update(deltaTime);
    });
    
    // Also update vehicles stored in dynamicObjects
    this.dynamicObjects.forEach((obj, id) => {
      if ((obj.type === 'plane' || obj.type === 'helicopter') && obj.controller) {
        obj.controller.update(deltaTime);
      }
    });
  }
  
  // Add method to spawn multiplayer dynamic platform
  spawnMultiplayerDynamicPlatform(objectId, position = null, scale = 1.0) {
    if (this.gameMode !== 'multiplayer') return null;
    
    console.log(`Spawning multiplayer dynamic platform ${objectId} at`, position);
    
    // Check if this is a level dynamic platform that was already created
    if (objectId.startsWith('level_dynamic_platform_')) {
      console.log('Skipping level dynamic platform spawn - should be created from level data');
      return null;
    }
    
    // Also check if a platform already exists at this position
    for (const [id, obj] of this.dynamicObjects) {
      if (obj.type === 'dynamic_platform' && 
          Math.abs(obj.mesh.position.x - position.x) < 0.1 &&
          Math.abs(obj.mesh.position.y - position.y) < 0.1 &&
          Math.abs(obj.mesh.position.z - position.z) < 0.1) {
        console.log('Dynamic platform already exists at this position, skipping multiplayer spawn');
        return null;
      }
    }
    
    // Handle different platform sizes based on the object ID or scale
    let platform;
    if (objectId === 'pool_dynamic_platform' || (typeof scale === 'object' && scale.x === 4)) {
      // Pool platform has specific dimensions
      platform = createDynamicPlatformModel(4, 0.5, 4);
    } else {
      platform = createDynamicPlatformModel(4, 0.5, 4);
    }
    
    platform.position.copy(position);
    this.scene.add(platform);
    
    // Create dynamic physics body for proper collision detection
    const platformBody = this.physics.createDynamicBody(position, {
      linearDamping: 1.0,
      angularDamping: 2.0
    });
    
    if (!platformBody) {
      console.error('Failed to create physics body for multiplayer dynamic platform');
      this.scene.remove(platform);
      if (platform.geometry) platform.geometry.dispose();
      if (platform.material) platform.material.dispose();
      return null;
    }
    
    // Calculate density
    const volume = 4 * 0.5 * 4;
    const mass = 5.0;
    const density = mass / volume;
    
    const colliderDesc = this.physics.createBoxCollider(
      new THREE.Vector3(2, 0.25, 2),
      { 
        density: density,
        friction: 0.8, 
        restitution: 0.2 
      }
    );
    
    const collider = this.physics.world.createCollider(colliderDesc, platformBody);
    
    if (!collider) {
      console.error('Failed to create collider for multiplayer dynamic platform');
      this.physics.world.removeRigidBody(platformBody);
      this.scene.remove(platform);
      if (platform.geometry) platform.geometry.dispose();
      if (platform.material) platform.material.dispose();
      return null;
    }
    
    platform.userData.physicsBody = platformBody;
    platform.userData.objectId = objectId;
    
    // Track dynamic object with physics body
    this.dynamicObjects.set(objectId, {
      mesh: platform,
      body: platformBody,
      type: 'dynamic_platform',
      scale: { x: 4, y: 0.5, z: 4 },
      collider: collider,
      isMultiplayer: true,
      lastServerUpdate: {
        position: position.clone(),
        rotation: platform.quaternion.clone(),
        velocity: new THREE.Vector3(),
        timestamp: performance.now()
      }
    });
    
    return platform;
  }

  // Update dynamic object from server state
  updateDynamicObject(objectId, state) {
    const obj = this.dynamicObjects.get(objectId);
    if (!obj) return;
    
    if (obj.type === 'vehicle' && obj.controller) {
      // Update vehicle from server state
      obj.controller.updateFromServer(state);
    } else if (obj.mesh && obj.body) {
      // For multiplayer rocks and platforms, directly set position/rotation to match server
      if (this.gameMode === 'multiplayer' && obj.isMultiplayer && obj.body && (obj.type === 'rock' || obj.type === 'dynamic_platform')) {
        const now = performance.now();
        
        // Store server state
        if (state.position) {
          obj.lastServerUpdate.position.set(state.position.x, state.position.y, state.position.z);
          
          // Directly set body position to match server
          obj.body.setTranslation({
            x: state.position.x,
            y: state.position.y,
            z: state.position.z
          }, true); // Add 'true' to wake up the body
          
          // Update mesh to match exactly
          obj.mesh.position.set(state.position.x, state.position.y, state.position.z);
        }
        
        if (state.rotation) {
          obj.lastServerUpdate.rotation.set(state.rotation.x, state.rotation.y, state.rotation.z, state.rotation.w);
          
          // Set body rotation
          obj.body.setRotation({
            x: state.rotation.x,
            y: state.rotation.y,
            z: state.rotation.z,
            w: state.rotation.w
          }, true); // Add 'true' to wake up the body
          
          // Update mesh rotation exactly
          obj.mesh.quaternion.set(state.rotation.x, state.rotation.y, state.rotation.z, state.rotation.w);
        }
        
        if (state.velocity) {
          obj.lastServerUpdate.velocity.set(state.velocity.x, state.velocity.y, state.velocity.z);
          
          // Set velocity to match server
          obj.body.setLinvel({
            x: state.velocity.x,
            y: state.velocity.y,
            z: state.velocity.z
          }, true); // Add 'true' to wake up the body
        }
        
        obj.lastServerUpdate.timestamp = now;
        
      } else {
        // For non-rock objects or non-multiplayer, update directly
        if (state.position && obj.mesh) {
          obj.mesh.position.set(state.position.x, state.position.y, state.position.z);
          
          // Also update kinematic body position for collision detection
          if (obj.body) {
            obj.body.setNextKinematicTranslation({
              x: state.position.x,
              y: state.position.y,
              z: state.position.z
            });
          }
        }
        
        if (state.rotation && obj.mesh) {
          obj.mesh.quaternion.set(state.rotation.x, state.rotation.y, state.rotation.z, state.rotation.w);
          
          // Also update kinematic body rotation
          if (obj.body) {
            obj.body.setNextKinematicRotation({
              x: state.rotation.x,
              y: state.rotation.y,
              z: state.rotation.z,
              w: state.rotation.w
            });
          }
        }
      }
    }
  }

  removeDynamicObject(objectId) {
    const object = this.dynamicObjects.get(objectId);
    if (!object) return;
    
    // Remove visual mesh
    if (object.mesh) {
      this.scene.remove(object.mesh);
      if (object.mesh.geometry) object.mesh.geometry.dispose();
      if (object.mesh.material) object.mesh.material.dispose();
    }
    
    // Remove physics body and collider
    if (this.physics.world) {
      // Remove collider first if it exists
      if (object.collider) {
        this.physics.world.removeCollider(object.collider, true);
      }
      
      // Then remove the body
      if (object.body) {
        this.physics.world.removeRigidBody(object.body);
      }
    }
    
    // Remove from map
    this.dynamicObjects.delete(objectId);
    
    console.log(`Removed dynamic object: ${objectId}`);
  }

  // Get all dynamic objects that need network updates
  getDynamicObjectStates() {
    const states = new Map();
    
    this.dynamicObjects.forEach((obj, id) => {
      if (obj.body) {
        const pos = obj.body.translation();
        const rot = obj.body.rotation();
        const vel = obj.body.linvel();
        
        states.set(id, {
          position: { x: pos.x, y: pos.y, z: pos.z },
          rotation: { x: rot.x, y: rot.y, z: rot.z, w: rot.w },
          velocity: { x: vel.x, y: vel.y, z: vel.z },
          type: obj.type,
          scale: obj.scale
        });
      }
    });
    
    return states;
  }

  createPlatform() {
    // Main platform - make it much larger for sandbox mode
    const platformWidth = this.gameMode === 'sandbox' ? 200 : 50;  // 4x larger in sandbox
    const platformHeight = 3;
    const platformDepth = this.gameMode === 'sandbox' ? 200 : 50;   // 4x larger in sandbox
    
    this.objects.platform = createPlatformModel(platformWidth, platformHeight, platformDepth);
    this.objects.platform.position.set(0, 30, 0);
    this.scene.add(this.objects.platform);
    
    // Create physics body
    const platformBody = this.physics.createFixedBody(this.objects.platform.position);
    this.objects.platformBody = platformBody;    
    const colliderDesc = this.physics.createBoxCollider(
      new THREE.Vector3(platformWidth / 2, platformHeight / 2, platformDepth / 2),
      { friction: 0.8, restitution: 0.2 }
    );
    this.physics.world.createCollider(colliderDesc, platformBody);
    
    // Add wall
    this.createWall();
    
    // Add ramp
    this.createRamp();
    
    // Add moving platform
    this.createMovingPlatform();
    
    // Add test rock in sandbox and multiplayer modes
    if (this.gameMode === 'multiplayer' || this.gameMode === 'sandbox') {
      const rockPos = new THREE.Vector3(20, 30 + platformHeight/2 + 3, 20);
      this.createPushableRock(rockPos, 1.5);
    }
    
    // Add car in sandbox mode
    if (this.gameMode === 'sandbox') {
      // Simplified car spawn position calculation
      // Platform top = 30 + platformHeight/2 = 31.5
      // Add some clearance above platform
      const carSpawnHeight = 30 + platformHeight/2 + 2;
      const carPos = new THREE.Vector3(10, carSpawnHeight, 10);
      console.log('Spawning car at height:', carSpawnHeight, '(platform top at', 30 + platformHeight/2, ')');
      this.spawnTestCar(carPos);
      
      // Add plane and helicopter
      const planePos = new THREE.Vector3(20, carSpawnHeight + 5, -10);
      this.spawnPlane(planePos);
      
      const heliPos = new THREE.Vector3(-20, carSpawnHeight + 5, -10);
      this.spawnHelicopter(heliPos);
      
      // Add spaceship - ensure it's on the platform
      // Platform extends from -100 to +100 in X and Z
      const spaceshipPos = new THREE.Vector3(-80, carSpawnHeight + 2, -80);
      console.log('Spawning spaceship at:', spaceshipPos, 'on platform that extends from -100 to +100');
      this.spawnSpaceship(spaceshipPos);
    }
    
    return this.objects.platform;
  }

  // Add new method to spawn sandbox weapons
  spawnSandboxWeapons(weaponSystem) {
    if (!weaponSystem || this.gameMode !== 'sandbox') return;
    
    console.log('Spawning sandbox weapons...');
    
    // Spawn weapons on the platform
    const platformY = 32; // Platform top + small offset
    
    weaponSystem.spawnWeaponPickup('pistol', new THREE.Vector3(-10, platformY, 0));
    weaponSystem.spawnWeaponPickup('rifle', new THREE.Vector3(0, platformY, -10));
    weaponSystem.spawnWeaponPickup('shotgun', new THREE.Vector3(10, platformY, 10));
    
    console.log('Sandbox weapons spawned');
  }

  createWall() {
    const wallWidth = 20;
    const wallHeight = 8;
    const wallDepth = 1;
    
    const wall = createWallModel(wallWidth, wallHeight, wallDepth);
    wall.position.set(10, 30 + 3/2 + wallHeight/2, -15);
    this.scene.add(wall);
    
    const wallBody = this.physics.createFixedBody(wall.position);
    wall.userData.physicsBody = wallBody; // Store reference on mesh
    
    const colliderDesc = this.physics.createBoxCollider(
      new THREE.Vector3(wallWidth / 2, wallHeight / 2, wallDepth / 2),
      { friction: 0.5, restitution: 0.1 }
    );
    this.physics.world.createCollider(colliderDesc, wallBody);
  }

  createRamp() {
    const rampWidth = 10;
    const rampHeight = 5;
    const rampDepth = 15;
    const rampAngle = Math.PI / 6;
    
    const ramp = createRampModel(rampWidth, 1, rampDepth);
    ramp.position.set(-15, 30 + 3/2 + rampHeight/2, 10);
    ramp.rotation.x = -rampAngle;
    this.scene.add(ramp);
    
    const rotation = { 
      w: Math.cos(-rampAngle/2), 
      x: Math.sin(-rampAngle/2), 
      y: 0, 
      z: 0 
    };
    
    const rampBody = this.physics.createFixedBody(ramp.position, rotation);
    ramp.userData.physicsBody = rampBody; // Store reference on mesh
    
    const colliderDesc = this.physics.createBoxCollider(
      new THREE.Vector3(rampWidth / 2, 0.5, rampDepth / 2),
      { friction: 0.7, restitution: 0.1 }
    );
    this.physics.world.createCollider(colliderDesc, rampBody);
    
    return ramp;
  }

  createMovingPlatform() {
    const movingPlatformWidth = 8;
    const movingPlatformHeight = 1;
    const movingPlatformDepth = 8;
    
    this.objects.movingPlatform = createMovingPlatformModel(
      movingPlatformWidth, 
      movingPlatformHeight, 
      movingPlatformDepth
    );
    
    // Position at top of ramp
    const rampAngle = Math.PI / 6;
    const rampTopOffset = Math.sin(rampAngle) * 15 / 2;
    const rampTopHeight = 30 + 3/2 + 5/2 + rampTopOffset;
    const rampTopZ = 10 + Math.cos(rampAngle) * 15 / 2;
    
    this.objects.movingPlatform.position.set(
      -15,
      rampTopHeight + movingPlatformHeight/2,
      rampTopZ + movingPlatformDepth/2 + 1
    );
    
    this.objects.movingPlatform.receiveShadow = true;
    this.objects.movingPlatform.castShadow = true;
    this.scene.add(this.objects.movingPlatform);
    
    // Create kinematic physics body
    this.objects.movingPlatformBody = this.physics.createKinematicBody(
      this.objects.movingPlatform.position
    );
    
    const colliderDesc = this.physics.createBoxCollider(
      new THREE.Vector3(movingPlatformWidth / 2, movingPlatformHeight / 2, movingPlatformDepth / 2),
      { friction: 12.0, restitution: 0.01 }
    );
    
    this.physics.world.createCollider(colliderDesc, this.objects.movingPlatformBody);
    
    // Store animation data
    this.objects.movingPlatform.userData = {
      initialX: this.objects.movingPlatform.position.x,
      moveRange: 20,
      moveSpeed: 0.2
    };
  }

  updateMovingPlatform() {
    if (!this.objects.movingPlatform || !this.objects.movingPlatformBody) return;
    
    // In multiplayer mode, platform position is controlled by server
    if (this.gameMode === 'multiplayer') {
      // Don't calculate position locally, wait for server updates
      return;
    }
    
    // Single player modes: calculate position locally
    const time = performance.now() * 0.001;
    const userData = this.objects.movingPlatform.userData;
    
    const offset = Math.sin(time * userData.moveSpeed) * userData.moveRange;
    const newX = userData.initialX + offset;
    
    this.objects.movingPlatform.position.x = newX;
    
    // Always update kinematic body position to match visual
    this.objects.movingPlatformBody.setNextKinematicTranslation({
      x: newX,
      y: this.objects.movingPlatform.position.y,
      z: this.objects.movingPlatform.position.z
    });
  }

  // Add method to update platform position from server
  updatePlatformPosition(platformId, position) {
    // Handle moving platforms by index
    if (platformId.startsWith('moving_platform_')) {
      // For the main moving platform (index 0)
      if (platformId === 'moving_platform_0' && this.objects.movingPlatform && this.objects.movingPlatformBody) {
        // Update visual position
        this.objects.movingPlatform.position.set(position.x, position.y, position.z);
        
        // Update physics body to match
        this.objects.movingPlatformBody.setNextKinematicTranslation({
          x: position.x,
          y: position.y,
          z: position.z
        });
      }
    } else if (platformId.startsWith('dynamic_platform_')) {
      // Handle dynamic platforms - these are tracked in dynamicObjects
      const obj = this.dynamicObjects.get(platformId);
      if (obj && obj.type === 'dynamic_platform') {
        this.updateDynamicObject(platformId, { position });
      }
    }
  }

  updateDynamicObjects() {
    this.updateMovingPlatform();
    
    // Update all tracked dynamic objects
    this.dynamicObjects.forEach((obj, id) => {
      if (this.gameMode === 'multiplayer' && obj.isMultiplayer && obj.type === 'rock') {
        // For multiplayer rocks, don't update from local physics
        // Position is authoritative from server
        // Just ensure visual matches last server update
        if (obj.mesh && obj.lastServerUpdate) {
          obj.mesh.position.copy(obj.lastServerUpdate.position);
          obj.mesh.quaternion.copy(obj.lastServerUpdate.rotation);
        }
      } else if (this.gameMode !== 'multiplayer' && obj.body && obj.mesh) {
        // Single player: update from physics
        const position = obj.body.translation();
        obj.mesh.position.set(position.x, position.y, position.z);
        
        const rotation = obj.body.rotation();
        obj.mesh.quaternion.set(rotation.x, rotation.y, rotation.z, rotation.w);
      }
    });
    
    // Update all other meshes with physics bodies
    this.scene.traverse((child) => {
      if (child.isMesh && child.userData.physicsBody && !this.dynamicObjects.has(child.userData.objectId)) {
        const body = child.userData.physicsBody;
        
        const position = body.translation();
        child.position.set(position.x, position.y, position.z);
        
        const rotation = body.rotation();
        child.quaternion.set(rotation.x, rotation.y, rotation.z, rotation.w);
      }
    });
  }

  render() {
    if (this.renderer && this.scene && this.camera) {
      this.renderer.render(this.scene, this.camera);
    }
  }

  onResize() {
    if (!this.camera || !this.renderer) return;
    
    // Use visualViewport if available (better for mobile/Safari)
    const width = window.visualViewport?.width || window.innerWidth;
    const height = window.visualViewport?.height || window.innerHeight;
    
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    
    this.renderer.setSize(width, height, false);
    this.renderer.setPixelRatio(window.devicePixelRatio);
  }

  buildLevelFromData(levelObjects) {
    console.log("Building level from server data, objects:", levelObjects?.length || 0);
    
    if (!levelObjects || levelObjects.length === 0) {
      console.warn("No level objects received from server");
      return;
    }
    
    levelObjects.forEach(obj => {
      console.log("Processing level object:", obj);
      
      switch(obj.object_type || obj.type) {
        case 'planet':
          this.createPlanetFromData(obj);
          break;

        case 'platform':
          this.createPlatformFromData(obj);
          break;

        case 'wall':
          this.createWallFromData(obj);
          break;

        case 'ramp':
          this.createRampFromData(obj);
          break;

        case 'moving_platform':
          this.createMovingPlatformFromData(obj);
          break;

        case 'static_rock':
          this.createStaticRockFromData(obj);
          break;

        case 'water_volume':
          this.createWaterVolumeFromData(obj);
          break;

        case 'dynamic_platform':
          this.createDynamicPlatformFromData(obj);
          break;

        case 'vehicle':
          this.spawnMultiplayerVehicle(obj.id, obj.position, obj.scale || 1.0);
          break;
          
        default:
          console.warn('Unknown object type in level data:', obj.object_type);
      }
    });
    
    // Set gravity center based on planet position (important for multiplayer)
    const planetObj = levelObjects.find(obj => obj.object_type === 'planet');
    if (planetObj) {
      this.physics.gravity.center.set(planetObj.position.x, planetObj.position.y, planetObj.position.z);
      console.log('Set gravity center from level data to:', planetObj.position);
    }
    
    console.log('Level built from server data');
  }

  clearLevel() {
    // Remove existing level objects and their physics bodies
    if (this.objects.planet) {
      this.scene.remove(this.objects.planet);
      if (this.objects.planet.geometry) this.objects.planet.geometry.dispose();
      if (this.objects.planet.material) this.objects.planet.material.dispose();
      this.objects.planet = null;
    }
    
    if (this.objects.platform) {
      this.scene.remove(this.objects.platform);
      if (this.objects.platform.geometry) this.objects.platform.geometry.dispose();
      if (this.objects.platform.material) this.objects.platform.material.dispose();
      this.objects.platform = null;
    }
    
    // Clear moving platform
    if (this.objects.movingPlatform) {
      this.scene.remove(this.objects.movingPlatform);
      if (this.objects.movingPlatform.geometry) this.objects.movingPlatform.geometry.dispose();
      if (this.objects.movingPlatform.material) this.objects.movingPlatform.material.dispose();
      this.objects.movingPlatform = null;
      this.objects.movingPlatformBody = null;
    }
    
    // Clear all other meshes with physics bodies (walls, ramps, etc.)
    const objectsToRemove = [];
    this.scene.traverse((child) => {
      if (child.isMesh && child.userData.physicsBody && 
          child !== this.objects.planet && 
          child !== this.objects.platform &&
          child !== this.objects.movingPlatform) {
        objectsToRemove.push(child);
      }
    });
    
    objectsToRemove.forEach(obj => {
      this.scene.remove(obj);
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) obj.material.dispose();
    });
    
    // Clear dynamic objects
    this.dynamicObjects.forEach((obj, id) => {
      this.removeDynamicObject(id);
    });
    this.dynamicObjects.clear();
    
    // Clear water volumes
    this.waterVolumes.forEach((volume, id) => {
      this.scene.remove(volume.mesh);
      this.physics.world.removeRigidBody(volume.body);
      volume.mesh.geometry.dispose();
      volume.mesh.material.dispose();
    });
    this.waterVolumes.clear();
    
    console.log('Level cleared');
  }

  createPlanetFromData(data) {
    const planetRadius = data.scale ? data.scale.x : 200;
    
    // Create planet physics body at server position
    const planetBody = this.physics.createFixedBody(new THREE.Vector3(data.position.x, data.position.y, data.position.z));
    this.objects.planetBody = planetBody;
    
    // Create planet using the new model
    const planetModel = new PlanetModel(planetRadius, 30);
    const mesh = planetModel.createFromServerData(data);
    this.objects.planet = mesh;
    this.scene.add(mesh);
    
    // Create collision mesh
    let collisionData;
    if (data.terrain_data && data.terrain_data.vertices && data.terrain_data.indices) {
      collisionData = {
        vertices: data.terrain_data.vertices,
        indices: data.terrain_data.indices
      };
    } else {
      collisionData = planetModel.getCollisionData(mesh.geometry);
    }
    
    const trimeshDesc = this.physics.createTrimeshCollider(
      collisionData.vertices,
      collisionData.indices,
      { friction: 0.8, restitution: 0.1 }
    );
    
    this.physics.world.createCollider(trimeshDesc, planetBody);
    
    // Update gravity center to planet position
    this.physics.gravity.center.set(data.position.x, data.position.y, data.position.z);
  }

  createPlatformFromData(data) {
    const platform = createPlatformModel(
      data.scale.x, 
      data.scale.y, 
      data.scale.z,
      data.material
    );
    platform.position.set(data.position.x, data.position.y, data.position.z);
    this.scene.add(platform);
    
    // Store as main platform if it's the first one
    if (!this.objects.platform) {
      this.objects.platform = platform;
    }
    
    // Physics (client-side for collision detection)
    const platformBody = this.physics.createFixedBody(platform.position);
    const colliderDesc = this.physics.createBoxCollider(
      new THREE.Vector3(data.scale.x / 2, data.scale.y / 2, data.scale.z / 2),
      { friction: 0.8, restitution: 0.2 }
    );
    this.physics.world.createCollider(colliderDesc, platformBody);
    
    // Store reference to physics body
    if (!this.objects.platformBody) {
      this.objects.platformBody = platformBody;
    }
    
    platform.userData.physicsBody = platformBody;
  }

  createWallFromData(data) {
    const wall = createWallModel(
      data.scale.x, 
      data.scale.y, 
      data.scale.z,
      data.material
    );
    wall.position.set(data.position.x, data.position.y, data.position.z);
    this.scene.add(wall);
    
    const wallBody = this.physics.createFixedBody(wall.position);
    const colliderDesc = this.physics.createBoxCollider(
      new THREE.Vector3(data.scale.x / 2, data.scale.y / 2, data.scale.z / 2),
      { friction: 0.5, restitution: 0.1 }
    );
    this.physics.world.createCollider(colliderDesc, wallBody);
    wall.userData.physicsBody = wallBody;
  }

  createRampFromData(data) {
    const ramp = createRampModel(
      data.scale.x, 
      data.scale.y, 
      data.scale.z,
      data.material
    );
    ramp.position.set(data.position.x, data.position.y, data.position.z);
    
    if (data.rotation) {
      ramp.quaternion.set(data.rotation.x, data.rotation.y, data.rotation.z, data.rotation.w);
    }
    
    this.scene.add(ramp);
    
    const rotation = data.rotation ? {
      w: data.rotation.w,
      x: data.rotation.x,
      y: data.rotation.y,
      z: data.rotation.z
    } : null;
    
    const rampBody = this.physics.createFixedBody(ramp.position, rotation);
    const colliderDesc = this.physics.createBoxCollider(
      new THREE.Vector3(data.scale.x / 2, data.scale.y / 2, data.scale.z / 2),
      { friction: 0.7, restitution: 0.1 }
    );
    const collider = this.physics.world.createCollider(colliderDesc, rampBody);
    
    if (!collider) {
      console.error('Failed to create collider for ramp');
    } else {
      console.log('Created ramp collider at', data.position, 'with rotation', rotation);
    }
    
    ramp.userData.physicsBody = rampBody;
  }

  createMovingPlatformFromData(data) {
    const platform = createMovingPlatformModel(
      data.scale.x, 
      data.scale.y, 
      data.scale.z,
      data.properties
    );
    platform.position.set(data.position.x, data.position.y, data.position.z);
    this.scene.add(platform);
    
    const platformBody = this.physics.createKinematicBody(platform.position);
    const colliderDesc = this.physics.createBoxCollider(
      new THREE.Vector3(data.scale.x / 2, data.scale.y / 2, data.scale.z / 2),
      { friction: 12.0, restitution: 0.01 }
    );
    this.physics.world.createCollider(colliderDesc, platformBody);
    
    // Store animation data (but only use it in single-player modes)
    platform.userData = {
      initialX: platform.position.x,
      moveRange: data.properties?.move_range || 20,
      moveSpeed: data.properties?.move_speed || 0.2,
      physicsBody: platformBody
    };
    
    this.objects.movingPlatform = platform;
    this.objects.movingPlatformBody = platformBody;
    
    // In multiplayer, the server controls movement
    if (this.gameMode === 'multiplayer') {
      console.log('Moving platform created in multiplayer mode - position controlled by server');
    }
  }

  createStaticRockFromData(data) {
    const scale = (data.scale.x + data.scale.y + data.scale.z) / 3;
    const rock = createRockModel(scale);
    rock.position.set(data.position.x, data.position.y, data.position.z);
    
    this.scene.add(rock);
    
    // Create physics body
    const rockBody = this.physics.createFixedBody(rock.position);
    const colliderDesc = this.physics.createBallCollider(2 * scale, {
      friction: 0.8,
      restitution: 0.4
    });
    this.physics.world.createCollider(colliderDesc, rockBody);
    rock.userData.physicsBody = rockBody;
  }

  createCampaignPlatform(data) {
    const platform = createPlatformModel(
      data.scale.x, 
      data.scale.y, 
      data.scale.z,
      data.material
    );
    platform.position.set(data.position.x, data.position.y, data.position.z);
    this.scene.add(platform);
    
    // Physics
    const platformBody = this.physics.createFixedBody(platform.position);
    const colliderDesc = this.physics.createBoxCollider(
      new THREE.Vector3(data.scale.x / 2, data.scale.y / 2, data.scale.z / 2),
      { friction: 0.8, restitution: 0.2 }
    );
    this.physics.world.createCollider(colliderDesc, platformBody);
    platform.userData.physicsBody = platformBody;
    
    return platform;
  }

  createCampaignBox(data) {
    const geometry = new THREE.BoxGeometry(data.scale.x, data.scale.y, data.scale.z);
    
    const material = new THREE.MeshStandardMaterial({
      color: data.material?.color || 0x666666,
      roughness: data.material?.roughness || 0.8,
      metalness: data.material?.metalness || 0.1
    });
    
    const box = new THREE.Mesh(geometry, material);
    box.position.set(data.position.x, data.position.y, data.position.z);
    box.receiveShadow = true;
    box.castShadow = true;
    this.scene.add(box);
    
    // Make it dynamic if specified
    if (data.dynamic) {
      const boxBody = this.physics.createDynamicBody(box.position, {
        linearDamping: 0.4,
        angularDamping: 0.4
      });
      
      const colliderDesc = this.physics.createBoxCollider(
        new THREE.Vector3(data.scale.x / 2, data.scale.y / 2, data.scale.z / 2),
        { 
          density: data.density || 1.0,
          friction: 0.8, 
          restitution: 0.3 
        }
      );
      this.physics.world.createCollider(colliderDesc, boxBody);
      box.userData.physicsBody = boxBody;
    } else {
      const boxBody = this.physics.createFixedBody(box.position);
      const colliderDesc = this.physics.createBoxCollider(
        new THREE.Vector3(data.scale.x / 2, data.scale.y / 2, data.scale.z / 2),
        { friction: 0.8, restitution: 0.2 }
      );
      this.physics.world.createCollider(colliderDesc, boxBody);
      box.userData.physicsBody = boxBody;
    }
    
    return box;
  }

  createCampaignRamp(data) {
    const ramp = createRampModel(
      data.scale.x, 
      data.scale.y, 
      data.scale.z,
      data.material
    );
    ramp.position.set(data.position.x, data.position.y, data.position.z);
    
    if (data.rotation) {
      ramp.rotation.set(
        data.rotation.x || 0,
        data.rotation.y || 0,
        data.rotation.z || 0
      );
    }
    
    this.scene.add(ramp);
    
    const rotation = data.rotation ? {
      w: Math.cos(data.rotation.x/2) * Math.cos(data.rotation.y/2) * Math.cos(data.rotation.z/2),
      x: Math.sin(data.rotation.x/2) * Math.cos(data.rotation.y/2) * Math.cos(data.rotation.z/2),
      y: Math.cos(data.rotation.x/2) * Math.sin(data.rotation.y/2) * Math.cos(data.rotation.z/2),
      z: Math.cos(data.rotation.x/2) * Math.cos(data.rotation.y/2) * Math.sin(data.rotation.z/2)
    } : null;
    
    const rampBody = this.physics.createFixedBody(ramp.position, rotation);
    const colliderDesc = this.physics.createBoxCollider(
      new THREE.Vector3(data.scale.x / 2, data.scale.y / 2, data.scale.z / 2),
      { friction: 0.7, restitution: 0.1 }
    );
    this.physics.world.createCollider(colliderDesc, rampBody);
    ramp.userData.physicsBody = rampBody;
    
    return ramp;
  }

  createWaterVolumeFromData(data) {
    console.log('Creating water volume at position:', data.position, 'with scale:', data.scale);
    
    const water = createWaterVolumeModel(
      data.scale.x, 
      data.scale.y, 
      data.scale.z,
      data.properties
    );
    water.position.set(data.position.x, data.position.y, data.position.z);
    this.scene.add(water);
    
    // Create physics sensor for water detection (client-side)
    const waterBody = this.physics.createFixedBody(water.position);
    const colliderDesc = this.physics.createBoxCollider(
      new THREE.Vector3(data.scale.x / 2, data.scale.y / 2, data.scale.z / 2),
      { 
        friction: 0.0, 
        restitution: 0.0,
        isSensor: true // Make it a sensor
      }
    );
    
    // Mark as sensor in Rapier
    colliderDesc.setSensor(true);
    colliderDesc.setCollisionGroups(0x00020000); // Water layer
    
    const collider = this.physics.world.createCollider(colliderDesc, waterBody);
    
    // Store water volume info
    const volumeId = 'water_' + Date.now();
    this.waterVolumes.set(volumeId, {
      mesh: water,
      body: waterBody,
      collider: collider,
      bounds: {
        min: new THREE.Vector3(
          data.position.x - data.scale.x / 2,
          data.position.y - data.scale.y / 2,
          data.position.z - data.scale.z / 2
        ),
        max: new THREE.Vector3(
          data.position.x + data.scale.x / 2,
          data.position.y + data.scale.y / 2,
          data.position.z + data.scale.z / 2
        )
      }
    });
    
    water.userData.waterVolume = true;
    water.userData.volumeId = volumeId;
    
    console.log('Water volume created with ID:', volumeId);
  }

  isPositionInWater(position) {
    for (const [id, volume] of this.waterVolumes) {
      if (volume.isSpherical) {
        // Check spherical water volume
        const distance = position.distanceTo(volume.center);
        if (distance <= volume.radius) {
          return true;
        }
      } else {
        // Check box water volume (existing logic)
        if (position.x >= volume.bounds.min.x && position.x <= volume.bounds.max.x &&
            position.y >= volume.bounds.min.y && position.y <= volume.bounds.max.y &&
            position.z >= volume.bounds.min.z && position.z <= volume.bounds.max.z) {
          return true;
        }
      }
    }
    return false;
  }

  createDynamicPlatformFromData(data) {
    // This method is no longer needed for multiplayer since dynamic platforms
    // will come through as dynamic object spawns
    if (this.gameMode === 'multiplayer') {
      console.log('Skipping dynamic platform from level data in multiplayer - will be spawned as dynamic object');
      return null;
    }
    
    console.log('Creating dynamic platform at position:', data.position, 'with scale:', data.scale);
    
    // Always check for duplicates, not just in multiplayer
    // Check if a dynamic platform already exists at this position
    for (const [id, obj] of this.dynamicObjects) {
      if (obj.type === 'dynamic_platform' && 
          Math.abs(obj.mesh.position.x - data.position.x) < 0.1 &&
          Math.abs(obj.mesh.position.y - data.position.y) < 0.1 &&
          Math.abs(obj.mesh.position.z - data.position.z) < 0.1) {
        console.log('Dynamic platform already exists at this position, skipping');
        return obj.mesh;
      }
    }
    
    const platform = createDynamicPlatformModel(
      data.scale.x, 
      data.scale.y, 
      data.scale.z,
      data.properties
    );
    platform.position.set(data.position.x, data.position.y, data.position.z);
    this.scene.add(platform);
    
    // Create dynamic physics body
    const platformBody = this.physics.createDynamicBody(platform.position, {
      linearDamping: 1.0,
      angularDamping: 2.0
    });
    
    if (!platformBody) {
      console.error('Failed to create physics body for dynamic platform');
      this.scene.remove(platform);
      if (platform.geometry) platform.geometry.dispose();
      if (platform.material) platform.material.dispose();
      return null;
    }
    
    // Calculate density from mass and volume
    const volume = data.scale.x * data.scale.y * data.scale.z;
    const mass = data.properties?.mass || 5.0;
    const density = mass / volume;
    
    const colliderDesc = this.physics.createBoxCollider(
      new THREE.Vector3(data.scale.x / 2, data.scale.y / 2, data.scale.z / 2),
      { 
        density: density,
        friction: 0.8, 
        restitution: 0.2 
      }
    );
    
    const collider = this.physics.world.createCollider(colliderDesc, platformBody);
    
    if (!collider) {
      console.error('Failed to create collider for dynamic platform');
      this.physics.world.removeRigidBody(platformBody);
      this.scene.remove(platform);
      if (platform.geometry) platform.geometry.dispose();
      if (platform.material) platform.material.dispose();
      return null;
    }
    
    platform.userData.physicsBody = platformBody;
    
    // Generate unique ID for tracking
    const platformId = 'dynamic_platform_' + Date.now();
    platform.userData.objectId = platformId;
    
    // Track as dynamic object
    this.dynamicObjects.set(platformId, {
      mesh: platform,
      body: platformBody,
      type: 'dynamic_platform',
      scale: data.scale,
      collider: collider,
      isMultiplayer: this.gameMode === 'multiplayer'
    });
    
    console.log('Dynamic platform created with ID:', platformId);
    
    return platform;
  }

  // Add method to spawn multiplayer vehicle
  spawnMultiplayerVehicle(objectId, position, scale = 1.0) {
    console.log(`Spawning multiplayer vehicle ${objectId} at`, position);
    
    // Create car controller
    const carPos = new THREE.Vector3(position.x, position.y, position.z);
    const car = new CarController(this, this.physics, carPos);
    
    // Mark as multiplayer vehicle
    car.isMultiplayer = true;
    car.objectId = objectId;
    car.id = objectId; // Add id for player interaction
    
    // Store in dynamic objects
    this.dynamicObjects.set(objectId, {
      type: 'vehicle',
      controller: car,
      mesh: car.chassisMesh,
      body: car.chassisBody,
      scale: scale
    });
    
    console.log(`Vehicle ${objectId} spawned and ready`);
  }

  // Add method to spawn a plane
  spawnPlane(position = null) {
    const planePos = position || new THREE.Vector3(20, 40, 20);
    const plane = new PlaneController(this, this.physics, planePos);
    
    // Generate unique ID for the plane
    const planeId = 'plane_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    
    // Store in vehicles map
    this.vehicles.set(planeId, plane);
    
    // Also track as dynamic object
    this.dynamicObjects.set(planeId, {
      type: 'plane',
      controller: plane,
      mesh: plane.mesh,
      body: plane.body,
      scale: 1.0
    });
    
    console.log(`Spawned plane ${planeId} at`, planePos);
    return plane;
  }
  
  // Add method to spawn a helicopter
  spawnHelicopter(position = null) {
    if (!position) {
      // Default position on platform
      position = new THREE.Vector3(15, 35, 0);
    }
    
    const helicopter = new HelicopterController(this, this.physics, position);
    
    // Add to vehicles map so it can be found
    const helicopterId = 'helicopter_' + Date.now();
    this.vehicles.set(helicopterId, helicopter);
    
    console.log('Spawned helicopter at', position);
    
    return helicopter;
  }

  // Add method to spawn a spaceship
  spawnSpaceship(position = null) {
    // Ensure position is a valid THREE.Vector3 with numeric values
    let spaceshipPos;
    if (position && position instanceof THREE.Vector3) {
      spaceshipPos = new THREE.Vector3(
        Number(position.x) || 0,
        Number(position.y) || 50,
        Number(position.z) || 0
      );
    } else if (position && typeof position === 'object') {
      spaceshipPos = new THREE.Vector3(
        Number(position.x) || 0,
        Number(position.y) || 50,
        Number(position.z) || 0
      );
    } else {
      // Default position if none provided
      spaceshipPos = new THREE.Vector3(0, 50, 0);
    }
    
    console.log('spawnSpaceship called with position:', position);
    console.log('Using spaceship position:', spaceshipPos);
    console.log('Platform bounds: X[-100,100], Z[-100,100], Y=', this.objects.platform?.position.y);
    
    // Import SpaceshipController dynamically
    import('../control/spaceshipController.js').then(({ SpaceshipController }) => {
      const spaceship = new SpaceshipController(this, this.physics, spaceshipPos);
      
      // Generate unique ID for the spaceship
      const spaceshipId = 'spaceship_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
      
      // Store in vehicles map
      this.vehicles.set(spaceshipId, spaceship);
      
      // Also track as dynamic object
      this.dynamicObjects.set(spaceshipId, {
        type: 'spaceship',
        controller: spaceship,
        mesh: spaceship.mesh,
        body: spaceship.body,
        scale: 1.0
      });
      
      console.log(`Spawned spaceship ${spaceshipId} at`, spaceshipPos);
      return spaceship;
    }).catch(err => {
      console.error('Failed to load SpaceshipController:', err);
    });
  }

  // Override dynamic object spawn to handle vehicles
  spawnMultiplayerDynamicObject(objectId, objectType, position, scale) {
    switch(objectType) {
      case 'vehicle':
        this.spawnMultiplayerVehicle(objectId, position, scale);
        break;
      case 'plane':
        this.spawnMultiplayerPlane(objectId, position, scale);
        break;
      case 'helicopter':
        this.spawnMultiplayerHelicopter(objectId, position, scale);
        break;
      case 'spaceship':
        this.spawnMultiplayerSpaceship(objectId, position, scale);
        break;
      default:
        // Call existing method for other types
        super.spawnMultiplayerDynamicObject(objectId, objectType, position, scale);
    }
  }
  
  // Add method to register vehicles
  registerVehicle(id, controller) {
    this.vehicles.set(id, controller);
    console.log(`Registered vehicle: ${id}`);
  }
  
  unregisterVehicle(id) {
    this.vehicles.delete(id);
    console.log(`Unregistered vehicle: ${id}`);
  }
  
  getAllVehicles() {
    return Array.from(this.vehicles.values());
  }
}
