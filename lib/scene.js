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
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    
    canvas.appendChild(this.renderer.domElement);
    
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

  createPlanet() {
    const planetRadius = 200;
    const terrainHeight = 30;
    const planetY = -250;
    
    // Create planet physics body
    const planetBody = this.physics.createFixedBody(new THREE.Vector3(0, planetY, 0));
    
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
    
    // Add planet features
    this.addPlanetFeatures();
    
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

  createPushableRock(position, scale = 1.0) {
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
    
    const colliderDesc = this.physics.createBallCollider(2 * scale, {
      density: 0.3,
      friction: 0.8,
      restitution: 0.4
    });
    
    this.physics.world.createCollider(colliderDesc, rockBody);
    
    rock.userData.physicsBody = rockBody;
    
    return rock;
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
    
    // Add test rock
    const rockPos = new THREE.Vector3(20, 30 + platformHeight/2 + 3, 20);
    this.createPushableRock(rockPos, 1.5);
    
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
    
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }
}
