import * as THREE from 'three';

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
    
    return true;
  }

  setGameMode(mode) {
    this.gameMode = mode;
  }

  createPlanet() {
    const planetRadius = 200;
    const terrainHeight = 30;
    const planetY = -250;
    
    // Create planet physics body
    const planetBody = this.physics.createFixedBody(new THREE.Vector3(0, planetY, 0));
    this.objects.planetBody = planetBody; // Store reference
    
    // Create visual geometry
    const subdivisions = 5;
    const geometry = new THREE.IcosahedronGeometry(planetRadius, subdivisions);
    
    // Apply terrain displacement
    const positions = geometry.attributes.position.array;
    const vertex = new THREE.Vector3();
    
    for (let i = 0; i < positions.length; i += 3) {
      vertex.set(positions[i], positions[i + 1], positions[i + 2]);
      
      const dir = vertex.clone().normalize();
      const theta = Math.atan2(vertex.x, vertex.z);
      const phi = Math.acos(vertex.y / vertex.length());
      
      // Generate terrain height
      let height = 0;
      height += Math.sin(theta * 1.5) * Math.cos(phi * 2) * 0.3;
      height += Math.cos(theta * 1.2) * Math.sin(phi * 1.8) * 0.25;
      
      const mountainNoise = Math.sin(theta * 4) * Math.cos(phi * 3);
      if (mountainNoise > 0.3) {
        height += mountainNoise * 0.5;
      }
      
      height += Math.sin(theta * 8) * Math.cos(phi * 6) * 0.15;
      height += Math.cos(theta * 10) * Math.sin(phi * 8) * 0.1;
      height += Math.sin(theta * 20) * Math.cos(phi * 15) * 0.05;
      
      if (Math.abs(height) < 0.1) {
        height *= 0.3;
      }
      
      height = (height + 1) * 0.5;
      const finalRadius = planetRadius + (height * terrainHeight) - terrainHeight * 0.3;
      
      const newPos = dir.multiplyScalar(finalRadius);
      positions[i] = newPos.x;
      positions[i + 1] = newPos.y;
      positions[i + 2] = newPos.z;
    }
    
    geometry.attributes.position.needsUpdate = true;
    geometry.computeVertexNormals();
    
    // Create mesh
    const material = new THREE.MeshStandardMaterial({
      color: 0x3a7c4a,
      roughness: 0.9,
      metalness: 0.0,
      flatShading: true
    });
    
    this.objects.planet = new THREE.Mesh(geometry, material);
    this.objects.planet.position.set(0, planetY, 0);
    this.objects.planet.receiveShadow = true;
    this.objects.planet.castShadow = true;
    this.scene.add(this.objects.planet);
    
    // Create collision mesh
    let indices;
    if (geometry.index) {
      indices = geometry.index.array;
    } else {
      const vertexCount = positions.length / 3;
      indices = new Uint32Array(vertexCount);
      for (let i = 0; i < vertexCount; i++) {
        indices[i] = i;
      }
    }
    
    const colliderVertices = new Float32Array(positions.length);
    for (let i = 0; i < positions.length; i++) {
      colliderVertices[i] = positions[i];
    }
    
    const trimeshDesc = this.physics.createTrimeshCollider(
      colliderVertices,
      indices,
      { friction: 0.8, restitution: 0.1 }
    );
    
    this.physics.world.createCollider(trimeshDesc, planetBody);
    
    // Update gravity center
    this.physics.gravity.center.set(0, planetY, 0);
    
    // Add planet features for all modes (not just multiplayer)
    // This gives single player modes some interactive rocks too
    if (this.gameMode === 'multiplayer' || this.gameMode === 'sandbox') {
      this.addPlanetFeatures();
    }
    
    return this.objects.planet;
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
  }

  createPushableRock(position, scale = 1.0, objectId = null) {
    // Check if physics world is ready
    if (!this.physics.world) {
      console.error('Cannot create rock: physics world not initialized');
      return null;
    }
    
    const geometry = new THREE.DodecahedronGeometry(2 * scale, 0);
    const material = new THREE.MeshStandardMaterial({
      color: 0x666666,
      roughness: 1,
      metalness: 0
    });
    
    const rock = new THREE.Mesh(geometry, material);
    rock.position.copy(position);
    rock.rotation.set(
      Math.random() * Math.PI,
      Math.random() * Math.PI,
      Math.random() * Math.PI
    );
    
    rock.castShadow = true;
    rock.receiveShadow = true;
    this.scene.add(rock);
    
    // Create physics body
    const rockBody = this.physics.createDynamicBody(position, {
      linearDamping: 0.4,
      angularDamping: 0.4,
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
    
    const colliderDesc = this.physics.createBallCollider(2 * scale, {
      density: 0.3,
      friction: 0.8,
      restitution: 0.4
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
  spawnMultiplayerRock(objectId, position = null) {
    if (this.gameMode !== 'multiplayer') return null;
    
    // Default position: high above platform
    const spawnPos = position || new THREE.Vector3(
      -10 + Math.random() * 20,  // Random X between -10 and 10
      50,                         // High above platform
      -10 + Math.random() * 20   // Random Z between -10 and 10
    );
    
    const scale = 0.8 + Math.random() * 0.4; // Random scale 0.8-1.2
    
    console.log(`Spawning multiplayer rock ${objectId} at`, spawnPos);
    return this.createPushableRock(spawnPos, scale, objectId);
  }

  // Update dynamic object from server state
  updateDynamicObject(objectId, state) {
    const obj = this.dynamicObjects.get(objectId);
    if (!obj) return;
    
    if (state.position && obj.body) {
      // Server sends positions relative to player origin
      // But our physics world has been offset, so we need to add the offset back
      obj.body.setTranslation({
        x: state.position.x,
        y: state.position.y,
        z: state.position.z
      });
    }
    
    if (state.rotation && obj.body) {
      obj.body.setRotation({
        x: state.rotation.x,
        y: state.rotation.y,
        z: state.rotation.z,
        w: state.rotation.w
      });
    }
    
    if (state.velocity && obj.body) {
      obj.body.setLinvel({
        x: state.velocity.x,
        y: state.velocity.y,
        z: state.velocity.z
      });
    }
  }

  // Remove dynamic object
  removeDynamicObject(objectId) {
    const obj = this.dynamicObjects.get(objectId);
    if (!obj) return;
    
    // Remove from scene
    if (obj.mesh) {
      this.scene.remove(obj.mesh);
      if (obj.mesh.geometry) obj.mesh.geometry.dispose();
      if (obj.mesh.material) obj.mesh.material.dispose();
    }
    
    // Remove physics body
    if (obj.body && this.physics.world) {
      // Find and remove collider
      const numColliders = obj.body.numColliders();
      for (let i = 0; i < numColliders; i++) {
        const collider = obj.body.collider(i);
        if (collider) {
          this.physics.world.removeCollider(collider, true);
        }
      }
      this.physics.world.removeRigidBody(obj.body);
    }
    
    this.dynamicObjects.delete(objectId);
    console.log(`Removed dynamic object ${objectId}`);
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
    // Main platform
    const platformWidth = 50;
    const platformHeight = 3;
    const platformDepth = 50;
    const geometry = new THREE.BoxGeometry(platformWidth, platformHeight, platformDepth);
    
    const material = new THREE.MeshStandardMaterial({
      color: 0x888888,
      roughness: 0.7,
      metalness: 0.2
    });
    
    this.objects.platform = new THREE.Mesh(geometry, material);
    this.objects.platform.position.set(0, 30, 0);
    this.objects.platform.receiveShadow = true;
    this.objects.platform.castShadow = true;
    this.scene.add(this.objects.platform);
    
    // Physics
    const platformBody = this.physics.createFixedBody(this.objects.platform.position);
    this.objects.platformBody = platformBody; // Store reference
    
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
    
    return this.objects.platform;
  }

  createWall() {
    const wallWidth = 20;
    const wallHeight = 8;
    const wallDepth = 1;
    const geometry = new THREE.BoxGeometry(wallWidth, wallHeight, wallDepth);
    const material = new THREE.MeshStandardMaterial({
      color: 0x4444aa,
      roughness: 0.5,
      metalness: 0.3
    });
    
    const wall = new THREE.Mesh(geometry, material);
    wall.position.set(10, 30 + 3/2 + wallHeight/2, -15);
    wall.receiveShadow = true;
    wall.castShadow = true;
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
    
    const geometry = new THREE.BoxGeometry(rampWidth, 1, rampDepth);
    const material = new THREE.MeshStandardMaterial({
      color: 0xaa4444,
      roughness: 0.6,
      metalness: 0.2
    });
    
    const ramp = new THREE.Mesh(geometry, material);
    ramp.position.set(-15, 30 + 3/2 + rampHeight/2, 10);
    ramp.rotation.x = -rampAngle;
    ramp.receiveShadow = true;
    ramp.castShadow = true;
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
    
    const geometry = new THREE.BoxGeometry(
      movingPlatformWidth, 
      movingPlatformHeight, 
      movingPlatformDepth
    );
    const material = new THREE.MeshStandardMaterial({
      color: 0x4488ff,
      roughness: 0.5,
      metalness: 0.3,
      emissive: 0x224488,
      emissiveIntensity: 0.2
    });
    
    this.objects.movingPlatform = new THREE.Mesh(geometry, material);
    
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
    
    const time = performance.now() * 0.001;
    const userData = this.objects.movingPlatform.userData;
    
    const offset = Math.sin(time * userData.moveSpeed) * userData.moveRange;
    const newX = userData.initialX + offset;
    
    this.objects.movingPlatform.position.x = newX;
    
    this.objects.movingPlatformBody.setNextKinematicTranslation({
      x: newX,
      y: this.objects.movingPlatform.position.y,
      z: this.objects.movingPlatform.position.z
    });
  }

  updateDynamicObjects() {
    this.updateMovingPlatform();
    
    // Update all meshes with physics bodies
    this.scene.traverse((child) => {
      if (child.isMesh && child.userData.physicsBody) {
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
    console.log('Building level from server data:', levelObjects);
    
    for (const obj of levelObjects) {
      switch (obj.object_type) {
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
      }
    }
  }

  createPlanetFromData(data) {
    const planetRadius = data.scale ? data.scale.x : 200;
    const terrainHeight = 30;
    const planetY = data.position.y;
    
    // Use existing planet creation logic
    this.createPlanet();
    
    // Update position if different
    if (this.objects.planet) {
      this.objects.planet.position.set(data.position.x, data.position.y, data.position.z);
      if (this.objects.planetBody) {
        this.objects.planetBody.setTranslation({
          x: data.position.x,
          y: data.position.y,
          z: data.position.z
        });
      }
    }
  }

  createPlatformFromData(data) {
    const geometry = new THREE.BoxGeometry(data.scale.x, data.scale.y, data.scale.z);
    const material = new THREE.MeshStandardMaterial({
      color: 0x888888,
      roughness: 0.7,
      metalness: 0.2
    });
    
    const platform = new THREE.Mesh(geometry, material);
    platform.position.set(data.position.x, data.position.y, data.position.z);
    platform.receiveShadow = true;
    platform.castShadow = true;
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
    
    platform.userData.physicsBody = platformBody;
  }

  createWallFromData(data) {
    const geometry = new THREE.BoxGeometry(data.scale.x, data.scale.y, data.scale.z);
    const material = new THREE.MeshStandardMaterial({
      color: 0x4444aa,
      roughness: 0.5,
      metalness: 0.3
    });
    
    const wall = new THREE.Mesh(geometry, material);
    wall.position.set(data.position.x, data.position.y, data.position.z);
    wall.receiveShadow = true;
    wall.castShadow = true;
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
    const geometry = new THREE.BoxGeometry(data.scale.x, data.scale.y, data.scale.z);
    const material = new THREE.MeshStandardMaterial({
      color: 0xaa4444,
      roughness: 0.6,
      metalness: 0.2
    });
    
    const ramp = new THREE.Mesh(geometry, material);
    ramp.position.set(data.position.x, data.position.y, data.position.z);
    
    if (data.rotation) {
      ramp.quaternion.set(data.rotation.x, data.rotation.y, data.rotation.z, data.rotation.w);
    }
    
    ramp.receiveShadow = true;
    ramp.castShadow = true;
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
    this.physics.world.createCollider(colliderDesc, rampBody);
    ramp.userData.physicsBody = rampBody;
  }

  createMovingPlatformFromData(data) {
    const geometry = new THREE.BoxGeometry(data.scale.x, data.scale.y, data.scale.z);
    const material = new THREE.MeshStandardMaterial({
      color: 0x4488ff,
      roughness: 0.5,
      metalness: 0.3,
      emissive: 0x224488,
      emissiveIntensity: 0.2
    });
    
    const platform = new THREE.Mesh(geometry, material);
    platform.position.set(data.position.x, data.position.y, data.position.z);
    platform.receiveShadow = true;
    platform.castShadow = true;
    this.scene.add(platform);
    
    const platformBody = this.physics.createKinematicBody(platform.position);
    const colliderDesc = this.physics.createBoxCollider(
      new THREE.Vector3(data.scale.x / 2, data.scale.y / 2, data.scale.z / 2),
      { friction: 12.0, restitution: 0.01 }
    );
    this.physics.world.createCollider(colliderDesc, platformBody);
    
    // Store animation data
    platform.userData = {
      initialX: platform.position.x,
      moveRange: data.properties?.move_range || 20,
      moveSpeed: data.properties?.move_speed || 0.2,
      physicsBody: platformBody
    };
    
    this.objects.movingPlatform = platform;
    this.objects.movingPlatformBody = platformBody;
  }

  createStaticRockFromData(data) {
    const scale = (data.scale.x + data.scale.y + data.scale.z) / 3;
    const geometry = new THREE.DodecahedronGeometry(2 * scale, 0);
    const material = new THREE.MeshStandardMaterial({
      color: 0x666666,
      roughness: 1,
      metalness: 0
    });
    
    const rock = new THREE.Mesh(geometry, material);
    rock.position.set(data.position.x, data.position.y, data.position.z);
    rock.rotation.set(
      Math.random() * Math.PI,
      Math.random() * Math.PI,
      Math.random() * Math.PI
    );
    
    rock.castShadow = true;
    rock.receiveShadow = true;
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
    const geometry = new THREE.BoxGeometry(data.scale.x, data.scale.y, data.scale.z);
    
    const material = new THREE.MeshStandardMaterial({
      color: data.material?.color || 0x888888,
      roughness: data.material?.roughness || 0.7,
      metalness: data.material?.metalness || 0.2
    });
    
    const platform = new THREE.Mesh(geometry, material);
    platform.position.set(data.position.x, data.position.y, data.position.z);
    platform.receiveShadow = true;
    platform.castShadow = true;
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
    const geometry = new THREE.BoxGeometry(data.scale.x, data.scale.y, data.scale.z);
    
    const material = new THREE.MeshStandardMaterial({
      color: data.material?.color || 0xaa4444,
      roughness: data.material?.roughness || 0.6,
      metalness: data.material?.metalness || 0.2
    });
    
    const ramp = new THREE.Mesh(geometry, material);
    ramp.position.set(data.position.x, data.position.y, data.position.z);
    
    if (data.rotation) {
      ramp.rotation.set(
        data.rotation.x || 0,
        data.rotation.y || 0,
        data.rotation.z || 0
      );
    }
    
    ramp.receiveShadow = true;
    ramp.castShadow = true;
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
}
