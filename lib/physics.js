import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';

export class PhysicsManager {
  constructor() {
    this.world = null;
    this.eventQueue = null;
    this.debugInfo = {
      planetHandle: null,
      platformHandle: null,
      wallHandle: null,
      rampHandle: null,
      playerColliderHandle: null,
      lastQueryResult: null,
      colliderCount: 0
    };
    this.gravity = {
      center: new THREE.Vector3(0, -230, 0),
      strength: 25
    };
  }

  async initialize() {
    console.log("Starting to initialize Rapier physics engine...");
    
    await RAPIER.init({
      locateFile: (path) => {
        console.log("Locating Rapier file:", path);
        return `https://cdn.jsdelivr.net/npm/@dimforge/rapier3d-compat@0.11.2/${path}`;
      }
    });
    
    console.log("Rapier physics engine initialized successfully");
    
    const gravityVec = { x: 0, y: 0, z: 0 };
    this.world = new RAPIER.World(gravityVec);
    this.eventQueue = new RAPIER.EventQueue(true);
    this.world.eventQueue = this.eventQueue;
    
    console.log("Physics world created with disabled gravity:", gravityVec);
  }

  createPlanet(scene) {
    if (!scene || !this.world) {
      console.error("Scene or physics world not initialized");
      return null;
    }
    
    try {
      console.log("Creating planet-like terrain...");
      
      const planetRadius = 200;
      const terrainHeight = 30;
      const planetY = -250;
      
      const planetBodyDesc = RAPIER.RigidBodyDesc.fixed()
        .setTranslation(0, planetY, 0);
      
      const planetBody = this.world.createRigidBody(planetBodyDesc);
      
      const subdivisions = 5;
      const icosahedronGeometry = new THREE.IcosahedronGeometry(planetRadius, subdivisions);
      
      const positions = icosahedronGeometry.attributes.position.array;
      const vertex = new THREE.Vector3();
      
      for (let i = 0; i < positions.length; i += 3) {
        vertex.set(positions[i], positions[i + 1], positions[i + 2]);
        
        const dir = vertex.clone().normalize();
        const theta = Math.atan2(vertex.x, vertex.z);
        const phi = Math.acos(vertex.y / vertex.length());
        
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
      
      icosahedronGeometry.attributes.position.needsUpdate = true;
      icosahedronGeometry.computeVertexNormals();
      
      const planetMaterial = new THREE.MeshStandardMaterial({
        color: 0x3a7c4a,
        roughness: 0.9,
        metalness: 0.0,
        flatShading: true,
        wireframe: false
      });
      
      const planet = new THREE.Mesh(icosahedronGeometry, planetMaterial);
      planet.position.set(0, planetY, 0);
      planet.receiveShadow = true;
      planet.castShadow = true;
      scene.add(planet);
      
      let indices;
      if (icosahedronGeometry.index) {
        indices = icosahedronGeometry.index.array;
      } else {
        const vertexCount = positions.length / 3;
        indices = new Uint32Array(vertexCount);
        for (let i = 0; i < vertexCount; i++) {
          indices[i] = i;
        }
      }
      
      console.log("Creating planet collider with", positions.length / 3, "vertices and", indices.length / 3, "triangles");
      
      const colliderVertices = new Float32Array(positions.length);
      for (let i = 0; i < positions.length; i++) {
        colliderVertices[i] = positions[i];
      }
      
      const trimeshDesc = RAPIER.ColliderDesc.trimesh(
        colliderVertices,
        indices
      )
      .setFriction(0.8)
      .setRestitution(0.1);
      
      const planetCollider = this.world.createCollider(trimeshDesc, planetBody);
      
      this.debugInfo.planetHandle = planetCollider.handle;
      this.gravity.center.set(0, planetY, 0);
      
      console.log("Planet terrain created with trimesh collider, handle:", planetCollider.handle);
      
      // Add planet features
      this.addPlanetFeatures(scene, planet);
      
      return planet;
    } catch (e) {
      console.error("Error creating planet terrain:", e);
      return null;
    }
  }

  addPlanetFeatures(scene, planet) {
    if (!scene || !planet || !this.world) return;
    
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
      this.createPushableRock(scene, rockPos, scale);
    }
  }

  createPushableRock(scene, position, scale = 1.0) {
    if (!scene || !this.world) return;
    
    try {
      const rockGeometry = new THREE.DodecahedronGeometry(2 * scale, 0);
      const rockMaterial = new THREE.MeshStandardMaterial({
        color: 0x666666,
        roughness: 1,
        metalness: 0
      });
      
      const rock = new THREE.Mesh(rockGeometry, rockMaterial);
      rock.position.copy(position);
      
      rock.rotation.set(
        Math.random() * Math.PI,
        Math.random() * Math.PI,
        Math.random() * Math.PI
      );
      
      rock.castShadow = true;
      rock.receiveShadow = true;
      scene.add(rock);
      
      const rockBodyDesc = RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(position.x, position.y, position.z)
        .setRotation({
          x: rock.quaternion.x,
          y: rock.quaternion.y,
          z: rock.quaternion.z,
          w: rock.quaternion.w
        })
        .setLinearDamping(0.4)
        .setAngularDamping(0.4)
        .setCanSleep(true);
      
      const rockBody = this.world.createRigidBody(rockBodyDesc);
      
      const rockColliderDesc = RAPIER.ColliderDesc.ball(2 * scale)
        .setDensity(0.3)
        .setFriction(0.8)
        .setRestitution(0.4);
      
      this.world.createCollider(rockColliderDesc, rockBody);
      
      rock.userData.physicsBody = rockBody;
      
      console.log("Created pushable rock at", position.x.toFixed(1), position.y.toFixed(1), position.z.toFixed(1));
      
      return rock;
    } catch (e) {
      console.error("Error creating pushable rock:", e);
      return null;
    }
  }

  createPlatform(scene) {
    if (!scene || !this.world) {
      console.error("Scene or physics world not initialized");
      return null;
    }
    
    try {
      console.log("Creating platform with test geometry...");
      
      const platformWidth = 50;
      const platformHeight = 3;
      const platformDepth = 50;
      const platformGeometry = new THREE.BoxGeometry(
        platformWidth, platformHeight, platformDepth
      );
      
      const platformMaterial = new THREE.MeshStandardMaterial({
        color: 0x888888,
        roughness: 0.7,
        metalness: 0.2
      });
      
      const platform = new THREE.Mesh(platformGeometry, platformMaterial);
      platform.position.set(0, 30, 0);
      platform.receiveShadow = true;
      platform.castShadow = true;
      scene.add(platform);
      
      const platformBodyDesc = RAPIER.RigidBodyDesc.fixed()
        .setTranslation(
          platform.position.x,
          platform.position.y,
          platform.position.z
        );
      
      const platformBody = this.world.createRigidBody(platformBodyDesc);
      const platformColliderDesc = RAPIER.ColliderDesc.cuboid(
        platformWidth / 2,
        platformHeight / 2,
        platformDepth / 2
      )
      .setFriction(0.8)
      .setRestitution(0.2);
      
      const platformCollider = this.world.createCollider(platformColliderDesc, platformBody);
      this.debugInfo.platformHandle = platformCollider.handle;
      
      // Add wall
      const wallWidth = 20;
      const wallHeight = 8;
      const wallDepth = 1;
      const wallGeometry = new THREE.BoxGeometry(wallWidth, wallHeight, wallDepth);
      const wallMaterial = new THREE.MeshStandardMaterial({
        color: 0x4444aa,
        roughness: 0.5,
        metalness: 0.3
      });
      
      const wall = new THREE.Mesh(wallGeometry, wallMaterial);
      wall.position.set(10, 30 + platformHeight/2 + wallHeight/2, -15);
      wall.receiveShadow = true;
      wall.castShadow = true;
      scene.add(wall);
      
      const wallBodyDesc = RAPIER.RigidBodyDesc.fixed()
        .setTranslation(wall.position.x, wall.position.y, wall.position.z);
      
      const wallBody = this.world.createRigidBody(wallBodyDesc);
      const wallColliderDesc = RAPIER.ColliderDesc.cuboid(
        wallWidth / 2,
        wallHeight / 2,
        wallDepth / 2
      )
      .setFriction(0.5)
      .setRestitution(0.1);
      
      const wallCollider = this.world.createCollider(wallColliderDesc, wallBody);
      this.debugInfo.wallHandle = wallCollider.handle;
      
      // Add ramp
      const rampWidth = 10;
      const rampHeight = 5;
      const rampDepth = 15;
      const rampAngle = Math.PI / 6;
      
      const rampGeometry = new THREE.BoxGeometry(rampWidth, 1, rampDepth);
      const rampMaterial = new THREE.MeshStandardMaterial({
        color: 0xaa4444,
        roughness: 0.6,
        metalness: 0.2
      });
      
      const ramp = new THREE.Mesh(rampGeometry, rampMaterial);
      ramp.position.set(-15, 30 + platformHeight/2 + rampHeight/2, 10);
      ramp.rotation.x = -rampAngle;
      ramp.receiveShadow = true;
      ramp.castShadow = true;
      scene.add(ramp);
      
      const rampBodyDesc = RAPIER.RigidBodyDesc.fixed()
        .setTranslation(ramp.position.x, ramp.position.y, ramp.position.z)
        .setRotation({ w: Math.cos(-rampAngle/2), x: Math.sin(-rampAngle/2), y: 0, z: 0 });
      
      const rampBody = this.world.createRigidBody(rampBodyDesc);
      const rampColliderDesc = RAPIER.ColliderDesc.cuboid(
        rampWidth / 2,
        0.5,
        rampDepth / 2
      )
      .setFriction(0.7)
      .setRestitution(0.1);
      
      const rampCollider = this.world.createCollider(rampColliderDesc, rampBody);
      this.debugInfo.rampHandle = rampCollider.handle;
      
      // Create moving platform
      const rampTopOffset = Math.sin(rampAngle) * rampDepth / 2;
      const rampTopHeight = ramp.position.y + rampTopOffset;
      const rampTopZ = ramp.position.z + Math.cos(rampAngle) * rampDepth / 2;
      
      const movingPlatformWidth = 8;
      const movingPlatformHeight = 1;
      const movingPlatformDepth = 8;
      
      const movingPlatformGeometry = new THREE.BoxGeometry(
        movingPlatformWidth, movingPlatformHeight, movingPlatformDepth
      );
      const movingPlatformMaterial = new THREE.MeshStandardMaterial({
        color: 0x4488ff,
        roughness: 0.5,
        metalness: 0.3,
        emissive: 0x224488,
        emissiveIntensity: 0.2
      });
      
      const movingPlatform = new THREE.Mesh(movingPlatformGeometry, movingPlatformMaterial);
      movingPlatform.position.set(
        -15,
        rampTopHeight + movingPlatformHeight/2,
        rampTopZ + movingPlatformDepth/2 + 1
      );
      movingPlatform.receiveShadow = true;
      movingPlatform.castShadow = true;
      scene.add(movingPlatform);
      
      const movingPlatformBodyDesc = RAPIER.RigidBodyDesc.kinematicPositionBased()
        .setTranslation(
          movingPlatform.position.x,
          movingPlatform.position.y,
          movingPlatform.position.z
        );
      
      const movingPlatformBody = this.world.createRigidBody(movingPlatformBodyDesc);
      
      const movingPlatformColliderDesc = RAPIER.ColliderDesc.cuboid(
        movingPlatformWidth / 2,
        movingPlatformHeight / 2,
        movingPlatformDepth / 2
      )
      .setFriction(12.0)
      .setRestitution(0.01);
      
      this.world.createCollider(movingPlatformColliderDesc, movingPlatformBody);
      
      movingPlatform.userData = {
        initialX: movingPlatform.position.x,
        moveRange: 20,
        moveSpeed: 0.2
      };
      
      // Add a pushable rock
      const rockOnPlatform = new THREE.Vector3(20, 30 + platformHeight/2 + 3, 20);
      this.createPushableRock(scene, rockOnPlatform, 1.5);
      
      console.log("Platform with test geometry created successfully");
      
      return { platform, movingPlatform, movingPlatformBody };
    } catch (e) {
      console.error("Error creating platform:", e);
      return null;
    }
  }

  createPlayerBody(x, y, z, playerHeight, playerRadius) {
    const playerBodyDesc = RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(x, y, z)
      .setLinearDamping(0.1)
      .setAngularDamping(1.0)
      .setCanSleep(false)
      .lockRotations();
    
    const playerBody = this.world.createRigidBody(playerBodyDesc);
    
    const playerColliderDesc = RAPIER.ColliderDesc.capsule(
      playerHeight / 2 - playerRadius,
      playerRadius
    )
    .setFriction(0.0)
    .setRestitution(0.0)
    .setDensity(1.0)
    .setActiveCollisionTypes(RAPIER.ActiveCollisionTypes.DEFAULT)
    .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS);
    
    const playerCollider = this.world.createCollider(playerColliderDesc, playerBody);
    this.debugInfo.playerColliderHandle = playerCollider.handle;
    
    console.log("Player collider created with locked rotations:", playerCollider.handle);
    
    return playerBody;
  }

  castRay(origin, direction, maxDistance, excludeCollider) {
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
      (colliderHandle) => {
        if (excludeCollider && colliderHandle === excludeCollider) {
          return false;
        }
        return true;
      }
    );
  }

  step() {
    if (this.world) {
      this.world.step();
    }
  }

  drainCollisionEvents(callback) {
    if (this.eventQueue) {
      this.eventQueue.drainCollisionEvents(callback);
    }
  }

  applyGravityToScene(scene, deltaTime) {
    if (!scene) return;
    
    scene.traverse((child) => {
      if (child.isMesh && child.userData.physicsBody) {
        const body = child.userData.physicsBody;
        
        const objTranslation = body.translation();
        const objPos = new THREE.Vector3(objTranslation.x, objTranslation.y, objTranslation.z);
        
        const objGravityDir = new THREE.Vector3()
          .subVectors(this.gravity.center, objPos)
          .normalize();
        
        const objGravityForce = objGravityDir.clone().multiplyScalar(this.gravity.strength * deltaTime);
        const objVelocity = body.linvel();
        
        body.setLinvel({
          x: objVelocity.x + objGravityForce.x,
          y: objVelocity.y + objGravityForce.y,
          z: objVelocity.z + objGravityForce.z
        });
      }
    });
  }
}