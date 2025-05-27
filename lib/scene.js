import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';

// Scene creation and environment objects
export function createScene() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x111122);
  scene.fog = new THREE.Fog(0x111122, 100, 300);
  
  // Add lights
  const ambientLight = new THREE.AmbientLight(0x444444, 0.4);
  scene.add(ambientLight);
  
  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
  directionalLight.position.set(50, 200, 100);
  directionalLight.castShadow = true;
  directionalLight.shadow.mapSize.width = 2048;
  directionalLight.shadow.mapSize.height = 2048;
  directionalLight.shadow.camera.near = 0.5;
  directionalLight.shadow.camera.far = 500;
  directionalLight.shadow.camera.left = -100;
  directionalLight.shadow.camera.right = 100;
  directionalLight.shadow.camera.top = 100;
  directionalLight.shadow.camera.bottom = -100;
  scene.add(directionalLight);
  
  return scene;
}

// Planet creation
export function createPlanet(scene, physicsWorld, debugInfo) {
  if (!scene || !physicsWorld) {
    console.error("Scene or physics world not initialized");
    return null;
  }
  
  try {
    console.log("Creating planet-like terrain...");
    
    const planetRadius = 200;
    const terrainHeight = 30; // Maximum height variation
    const planetY = -250; // Planet center position
    
    // Create planet physics body first
    const planetBodyDesc = RAPIER.RigidBodyDesc.fixed()
      .setTranslation(0, planetY, 0);
    
    const planetBody = physicsWorld.createRigidBody(planetBodyDesc);
    
    // Create visual geometry - we'll use an icosahedron as base for more natural terrain
    const subdivisions = 5; // Higher = smoother sphere
    const icosahedronGeometry = new THREE.IcosahedronGeometry(planetRadius, subdivisions);
    
    // Get vertex positions and create height map
    const positions = icosahedronGeometry.attributes.position.array;
    const vertex = new THREE.Vector3();
    
    // Apply terrain displacement to each vertex
    for (let i = 0; i < positions.length; i += 3) {
      vertex.set(positions[i], positions[i + 1], positions[i + 2]);
      
      // Get the normalized direction from center
      const dir = vertex.clone().normalize();
      
      // Calculate spherical coordinates for noise
      const theta = Math.atan2(vertex.x, vertex.z);
      const phi = Math.acos(vertex.y / vertex.length());
      
      // Generate height using multiple octaves of noise for realistic terrain
      let height = 0;
      
      // Continental shelf - large scale features
      height += Math.sin(theta * 1.5) * Math.cos(phi * 2) * 0.3;
      height += Math.cos(theta * 1.2) * Math.sin(phi * 1.8) * 0.25;
      
      // Mountain ranges
      const mountainNoise = Math.sin(theta * 4) * Math.cos(phi * 3);
      if (mountainNoise > 0.3) {
        height += mountainNoise * 0.5;
      }
      
      // Hills and valleys
      height += Math.sin(theta * 8) * Math.cos(phi * 6) * 0.15;
      height += Math.cos(theta * 10) * Math.sin(phi * 8) * 0.1;
      
      // Small details
      height += Math.sin(theta * 20) * Math.cos(phi * 15) * 0.05;
      
      // Create some flat areas (plains)
      if (Math.abs(height) < 0.1) {
        height *= 0.3; // Flatten areas that are already relatively flat
      }
      
      // Normalize and apply height
      height = (height + 1) * 0.5;
      const finalRadius = planetRadius + (height * terrainHeight) - terrainHeight * 0.3; // Offset to have both valleys and peaks
      
      // Update vertex position
      const newPos = dir.multiplyScalar(finalRadius);
      positions[i] = newPos.x;
      positions[i + 1] = newPos.y;
      positions[i + 2] = newPos.z;
    }
    
    // Update geometry
    icosahedronGeometry.attributes.position.needsUpdate = true;
    icosahedronGeometry.computeVertexNormals();
    
    // Create the visual mesh
    const planetMaterial = new THREE.MeshStandardMaterial({
      color: 0x3a7c4a,
      roughness: 0.9,
      metalness: 0.0,
      flatShading: true, // Gives a more terrain-like appearance
      wireframe: false
    });
    
    const planet = new THREE.Mesh(icosahedronGeometry, planetMaterial);
    planet.position.set(0, planetY, 0);
    planet.receiveShadow = true;
    planet.castShadow = true;
    scene.add(planet);
    
    // Create collision mesh - handle both indexed and non-indexed geometries
    let indices;
    
    // Check if geometry has an index
    if (icosahedronGeometry.index) {
      indices = icosahedronGeometry.index.array;
    } else {
      // Create indices for non-indexed geometry
      // For non-indexed geometry, every 3 vertices form a triangle
      const vertexCount = positions.length / 3;
      indices = new Uint32Array(vertexCount);
      for (let i = 0; i < vertexCount; i++) {
        indices[i] = i;
      }
    }
    
    console.log("Creating planet collider with", positions.length / 3, "vertices and", indices.length / 3, "triangles");
    
    // Create a trimesh collider for the entire planet surface
    const colliderVertices = new Float32Array(positions.length);
    for (let i = 0; i < positions.length; i++) {
      colliderVertices[i] = positions[i];
    }
    
    // Create trimesh collider
    const trimeshDesc = RAPIER.ColliderDesc.trimesh(
      colliderVertices,
      indices
    )
    .setFriction(0.8)
    .setRestitution(0.1);
    
    const planetCollider = physicsWorld.createCollider(trimeshDesc, planetBody);
    
    if (debugInfo) {
      debugInfo.planetHandle = planetCollider.handle;
    }
    
    console.log("Planet terrain created with trimesh collider, handle:", planetCollider.handle);
    
    // Return the planet center and mesh
    return {
      planet,
      center: new THREE.Vector3(0, planetY, 0)
    };
  } catch (e) {
    console.error("Error creating planet terrain:", e);
    return null;
  }
}

// Function to create additional planet features
export function addPlanetFeatures(scene, physicsWorld, planetCenter) {
  if (!scene || !physicsWorld) return;
  
  // Create pushable rocks with physics
  for (let i = 0; i < 20; i++) {
    // Random position on sphere surface
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    
    const x = Math.sin(phi) * Math.cos(theta);
    const y = Math.cos(phi);
    const z = Math.sin(phi) * Math.sin(theta);
    
    // Place at planet radius plus a bit
    const radius = 205; // Slightly above average terrain
    const rockPos = new THREE.Vector3(x * radius, y * radius, z * radius);
    
    // Add planet position offset since rocks are in world space
    rockPos.add(planetCenter);
    
    // Random scale
    const scale = 0.5 + Math.random() * 1.5;
    
    createPushableRock(scene, physicsWorld, rockPos, scale);
  }
}

// Function to create pushable rocks
export function createPushableRock(scene, physicsWorld, position, scale = 1.0) {
  if (!scene || !physicsWorld) return null;
  
  try {
    // Create rock geometry and material
    const rockGeometry = new THREE.DodecahedronGeometry(2 * scale, 0);
    const rockMaterial = new THREE.MeshStandardMaterial({
      color: 0x666666,
      roughness: 1,
      metalness: 0
    });
    
    const rock = new THREE.Mesh(rockGeometry, rockMaterial);
    rock.position.copy(position);
    
    // Random rotation
    rock.rotation.set(
      Math.random() * Math.PI,
      Math.random() * Math.PI,
      Math.random() * Math.PI
    );
    
    rock.castShadow = true;
    rock.receiveShadow = true;
    scene.add(rock);
    
    // Create physics body for the rock
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
    
    const rockBody = physicsWorld.createRigidBody(rockBodyDesc);
    
    // Create collider - using sphere for better rolling
    const rockColliderDesc = RAPIER.ColliderDesc.ball(2 * scale)
      .setDensity(0.3) // Reduced from 1.2 to 0.3 for much lighter rocks
      .setFriction(0.8)
      .setRestitution(0.4); // Increased from 0.2 to 0.4 for more bounce
    
    const rockCollider = physicsWorld.createCollider(rockColliderDesc, rockBody);
    
    // Store the body reference on the mesh for animation updates
    rock.userData.physicsBody = rockBody;
    
    console.log("Created pushable rock at", position.x.toFixed(1), position.y.toFixed(1), position.z.toFixed(1));
    
    return rock;
  } catch (e) {
    console.error("Error creating pushable rock:", e);
    return null;
  }
}

// Platform creation including wall, ramp, and moving platform
export function createPlatform(scene, physicsWorld, debugInfo) {
  if (!scene || !physicsWorld) {
    console.error("Scene or physics world not initialized");
    return null;
  }
  
  try {
    console.log("Creating platform with test geometry...");
    
    // Main platform
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
    
    // Create platform physics body
    const platformBodyDesc = RAPIER.RigidBodyDesc.fixed()
      .setTranslation(
        platform.position.x,
        platform.position.y,
        platform.position.z
      );
    
    const platformBody = physicsWorld.createRigidBody(platformBodyDesc);
    const platformColliderDesc = RAPIER.ColliderDesc.cuboid(
      platformWidth / 2,
      platformHeight / 2,
      platformDepth / 2
    )
    .setFriction(0.8)
    .setRestitution(0.2);
    
    const platformCollider = physicsWorld.createCollider(platformColliderDesc, platformBody);
    
    if (debugInfo) {
      debugInfo.platformHandle = platformCollider.handle;
    }
    
    // Add a wall on the platform
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
    
    // Create wall physics
    const wallBodyDesc = RAPIER.RigidBodyDesc.fixed()
      .setTranslation(wall.position.x, wall.position.y, wall.position.z);
    
    const wallBody = physicsWorld.createRigidBody(wallBodyDesc);
    const wallColliderDesc = RAPIER.ColliderDesc.cuboid(
      wallWidth / 2,
      wallHeight / 2,
      wallDepth / 2
    )
    .setFriction(0.5)
    .setRestitution(0.1);
    
    const wallCollider = physicsWorld.createCollider(wallColliderDesc, wallBody);
    
    if (debugInfo) {
      debugInfo.wallHandle = wallCollider.handle;
    }
    
    // Add a ramp on the platform
    const rampWidth = 10;
    const rampHeight = 5;
    const rampDepth = 15;
    const rampAngle = Math.PI / 6; // 30 degrees
    
    // Create ramp using a rotated box
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
    
    // Create ramp physics with proper rotation
    const rampBodyDesc = RAPIER.RigidBodyDesc.fixed()
      .setTranslation(ramp.position.x, ramp.position.y, ramp.position.z)
      .setRotation({ w: Math.cos(-rampAngle/2), x: Math.sin(-rampAngle/2), y: 0, z: 0 });
    
    const rampBody = physicsWorld.createRigidBody(rampBodyDesc);
    const rampColliderDesc = RAPIER.ColliderDesc.cuboid(
      rampWidth / 2,
      0.5, // Half thickness
      rampDepth / 2
    )
    .setFriction(0.7)
    .setRestitution(0.1);
    
    const rampCollider = physicsWorld.createCollider(rampColliderDesc, rampBody);
    
    if (debugInfo) {
      debugInfo.rampHandle = rampCollider.handle;
    }
    
    // Calculate where the ramp top ends
    const rampTopOffset = Math.sin(rampAngle) * rampDepth / 2;
    const rampTopHeight = ramp.position.y + rampTopOffset;
    const rampTopZ = ramp.position.z + Math.cos(rampAngle) * rampDepth / 2;
    
    // Create moving platform at the top of the ramp
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
      -15, // Start at ramp X position
      rampTopHeight + movingPlatformHeight/2, // Position at ramp top
      rampTopZ + movingPlatformDepth/2 + 1 // Past the high edge
    );
    movingPlatform.receiveShadow = true;
    movingPlatform.castShadow = true;
    scene.add(movingPlatform);
    
    // Create KINEMATIC physics body for moving platform
    const movingPlatformBodyDesc = RAPIER.RigidBodyDesc.kinematicPositionBased()
      .setTranslation(
        movingPlatform.position.x,
        movingPlatform.position.y,
        movingPlatform.position.z
      );
    
    const movingPlatformBody = physicsWorld.createRigidBody(movingPlatformBodyDesc);
    
    const movingPlatformColliderDesc = RAPIER.ColliderDesc.cuboid(
      movingPlatformWidth / 2,
      movingPlatformHeight / 2,
      movingPlatformDepth / 2
    )
    .setFriction(12.0)
    .setRestitution(0.01);
    
    physicsWorld.createCollider(movingPlatformColliderDesc, movingPlatformBody);
    
    // Store initial position for animation
    movingPlatform.userData = {
      initialX: movingPlatform.position.x,
      moveRange: 20, // Move 20 units side to side
      moveSpeed: 0.2 // Complete cycle every ~31 seconds
    };
    
    console.log("Moving platform created at ramp top:", 
      movingPlatform.position.x, 
      movingPlatform.position.y, 
      movingPlatform.position.z);
    
    // Add a pushable rock at the edge of the platform for testing
    const rockOnPlatform = new THREE.Vector3(
      20, // Near the edge of the platform
      30 + platformHeight/2 + 3, // Platform surface + rock radius + small offset
      20  // Also near the edge in Z direction
    );
    createPushableRock(scene, physicsWorld, rockOnPlatform, 1.5); // Slightly larger rock
    
    console.log("Platform with test geometry created successfully");
    
    // Return all created objects
    return {
      platform,
      wall,
      ramp,
      movingPlatform,
      movingPlatformBody
    };
  } catch (e) {
    console.error("Error creating platform:", e);
    return null;
  }
}

// Update dynamic objects (moving platforms, etc.)
export function updateDynamicObjects(scene, movingPlatform, movingPlatformBody) {
  if (!scene) return;
  
  // Update moving platform
  if (movingPlatform && movingPlatformBody) {
    const time = performance.now() * 0.001; // Convert to seconds
    const userData = movingPlatform.userData;
    
    // Calculate new position using sine wave
    const offset = Math.sin(time * userData.moveSpeed) * userData.moveRange;
    const newX = userData.initialX + offset;
    
    // Update visual position
    movingPlatform.position.x = newX;
    
    // Update physics body position (kinematic bodies need explicit position updates)
    movingPlatformBody.setNextKinematicTranslation({
      x: newX,
      y: movingPlatform.position.y,
      z: movingPlatform.position.z
    });
  }
  
  // Update all meshes that have physics bodies
  scene.traverse((child) => {
    if (child.isMesh && child.userData.physicsBody) {
      const body = child.userData.physicsBody;
      
      // Update mesh position from physics body
      const position = body.translation();
      child.position.set(position.x, position.y, position.z);
      
      // Update mesh rotation from physics body
      const rotation = body.rotation();
      child.quaternion.set(rotation.x, rotation.y, rotation.z, rotation.w);
    }
  });
}
