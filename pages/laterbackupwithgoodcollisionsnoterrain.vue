<template>
    <canvas ref="canvas"></canvas>
  </template>

  <script setup>
    import { ref, onMounted, onBeforeUnmount } from 'vue';
    import * as THREE from 'three';
    import * as RAPIER from '@dimforge/rapier3d-compat';
    import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

    // Constants
    const GRAVITY_STRENGTH = 10;
    const POINT_GRAVITY_STRENGTH = 50; // Strength of point-to-point gravity
    const PLAYER_RADIUS = 0.2;
    const PLAYER_HEIGHT = 0.8;
    const NUM_RANDOM_OBJECTS = 6;
    const NUM_DYNAMIC_OBJECTS = 10; // Number of dynamic objects to create
    const OBJECT_FRICTION = 0.7;
    const NORMAL_ARROW_LENGTH = 1;
    const NORMAL_ARROW_COLOR = 0xff0000; // Red for surface normals
    const COLLISION_ARROW_COLOR = 0x00ff00; // Green for collision normals
    const JUMP_FORCE = 0.2; // Force applied when jumping
    const MOVE_SPEED = 0.1; // Speed for horizontal movement
    const PLANET_RADIUS = 8; // Radius of the planetary sphere
    const PLANET_MASS = 5000; // Mass of the planet for gravity calculations
    const MAX_WALKABLE_SLOPE = 0.7; // Maximum slope angle that player can walk on (in radians, approx 40 degrees)
    const CORNER_THRESHOLD = 0.08; // Distance threshold for detecting if player is on a corner
    const SLIDE_SPEED_MULTIPLIER = 1.5; // How fast the player slides down steep slopes
    const EDGE_VELOCITY_THRESHOLD = 0.12; // Minimum velocity to fly off an edge
    const EDGE_DETECTION_TIME = 5; // Frames to wait before re-grounding after going off an edge
    
    const canvas = ref(null);
    let renderer, scene, camera, physicsWorld, animationFrameId;
    let controls;

    let player = null;
    let objects = [];
    let normalArrows = [];
    let collisionNormalArrow = null;
    let eventQueue;

    const keys = { w: false, a: false, s: false, d: false, space: false };
    
    const handleKeyDown = ({key}) => {
      const k = key.toLowerCase();
      if (k in keys) keys[k] = true;
      if (k === ' ') keys.space = true;
    };

    const handleKeyUp = ({key}) => {
      const k = key.toLowerCase();
      if (k in keys) keys[k] = false;
      if (k === ' ') keys.space = false;
    };

    onMounted(async () => {
      await RAPIER.init();
      
      // Setup scene
      scene = new THREE.Scene();
      scene.background = new THREE.Color(0x050510);
      
      camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
      camera.position.set(0, 5, 10);
      
      renderer = new THREE.WebGLRenderer({ 
        canvas: canvas.value,
        antialias: true 
      });
      renderer.setSize(window.innerWidth, window.innerHeight);
      renderer.setPixelRatio(window.devicePixelRatio);
      
      controls = new OrbitControls(camera, canvas.value);
      controls.enableDamping = true;
      controls.dampingFactor = 0.05;
      
      // Lighting
      scene.add(new THREE.AmbientLight(0x404040));
      const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
      directionalLight.position.set(10, 20, 10);
      scene.add(directionalLight);
      
      // Physics setup - no global gravity
      physicsWorld = new RAPIER.World({ x: 0.0, y: 0.0, z: 0.0 });
      eventQueue = new RAPIER.EventQueue(true);
      
      // Create planet first
      createPlanet();
      createRandomObjects(NUM_RANDOM_OBJECTS);
      createAlignedPlatforms();
      createSurfaceCubes();
      createDynamicObjects(NUM_DYNAMIC_OBJECTS); // Add dynamic objects
      
      // Create player after objects so we can position it above them
      createPlayer();
      
      window.addEventListener('keydown', handleKeyDown);
      window.addEventListener('keyup', handleKeyUp);
      window.addEventListener('resize', onWindowResize);
      
      scene.add(new THREE.AxesHelper(3));
      
      animate();
    });

    onBeforeUnmount(() => {
      cancelAnimationFrame(animationFrameId);
      if (renderer) renderer.dispose();
      if (controls) controls.dispose();
      
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('resize', onWindowResize);
    });

    function updateObjectTransform(obj) {
      if (!obj.body || !obj.mesh) return;
      const pos = obj.body.translation();
      const rot = obj.body.rotation();
      obj.mesh.position.set(pos.x, pos.y, pos.z);
      obj.mesh.quaternion.set(rot.x, rot.y, rot.z, rot.w);
    }

    function createPlayer() {
      // Find the highest object to spawn above
      let highestPoint = PLANET_RADIUS + 5; // Default height above planet
      let spawnX = 0;
      let spawnZ = 0;
      
      // Find a random object to spawn above
      if (objects.length > 1) { // Check for objects other than the planet
        // Pick a random object (excluding the planet)
        const planetObjIndex = objects.findIndex(obj => obj.type === 'planet');
        const validObjects = objects.filter((obj, index) => index !== planetObjIndex);
        
        if (validObjects.length > 0) {
          const randomObj = validObjects[Math.floor(Math.random() * validObjects.length)];
          const objPos = randomObj.body.translation();
          const objSize = randomObj.size;
          
          spawnX = objPos.x;
          spawnZ = objPos.z;
          
          // Calculate height based on object type and position
          if (randomObj.type === 'sphere') {
            highestPoint = objPos.y + objSize/2 + 5; // Spawn 5 units above the top of the sphere
          } else if (randomObj.type === 'box') {
            highestPoint = objPos.y + objSize/2 + 5; // Spawn 5 units above the top of the box
          }
        }
      }
      
      // Use kinematic body instead of dynamic for stability
      const playerRigidBodyDesc = RAPIER.RigidBodyDesc.kinematicPositionBased();
      playerRigidBodyDesc.setTranslation(spawnX, highestPoint, spawnZ);
      
      const playerBody = physicsWorld.createRigidBody(playerRigidBodyDesc);
      
      const playerColliderDesc = RAPIER.ColliderDesc.capsule(PLAYER_HEIGHT / 2, PLAYER_RADIUS);
      playerColliderDesc.setFriction(0.7);
      // Remove the sensor flag to enable physical interactions
      // playerColliderDesc.setSensor(true); // This line prevents physical interactions
      const collider = physicsWorld.createCollider(playerColliderDesc, playerBody);
      
      const playerMesh = new THREE.Mesh(
        new THREE.CapsuleGeometry(PLAYER_RADIUS, PLAYER_HEIGHT, 20, 20),
        new THREE.MeshStandardMaterial({ color: 0xe53935 })
      );
      scene.add(playerMesh);
      
      player = {
        body: playerBody,
        mesh: playerMesh,
        collider: collider,
        velocity: new THREE.Vector3(0, 0, 0),
        grounded: false,
        falling: true,
        lastContactNormal: null,
        jumpCooldown: 0,
        fallSpeed: 0.1, // Initial fall speed
        maxFallSpeed: 0.3, // Max fall speed
        manualControl: true,
        mass: 1, // Mass for gravity calculations
        nextPosition: null, // For storing the next position to move to
        jumpDirection: null, // To store jump direction vector
        isJumping: false,     // Flag to track active jump state
        onSteepSlope: false, // Flag to track if player is on a steep slope
        slideDirection: null,
        edgeDetectionCounter: 0, // Counter to track time after losing ground contact
        momentum: new THREE.Vector3(0, 0, 0), // Store momentum for edge fly-off
        wasGrounded: false // Track previous grounded state to detect transitions
      };
    }

    // Replace createGround with createPlanet
    function createPlanet() {
      const planetBodyDesc = RAPIER.RigidBodyDesc.fixed();
      planetBodyDesc.setTranslation(0, 0, 0);
      
      const planetBody = physicsWorld.createRigidBody(planetBodyDesc);
      
      const planetColliderDesc = RAPIER.ColliderDesc.ball(PLANET_RADIUS);
      planetColliderDesc.setFriction(0.7);
      physicsWorld.createCollider(planetColliderDesc, planetBody);
      
      // Create planet mesh with detailed geometry
      const planetMesh = new THREE.Mesh(
        new THREE.SphereGeometry(PLANET_RADIUS, 64, 48),
        new THREE.MeshStandardMaterial({ 
          color: 0x1565c0,
          roughness: 0.8,
          metalness: 0.2
        })
      );
      planetMesh.position.set(0, 0, 0);
      scene.add(planetMesh);
      
      const planet = {
        body: planetBody,
        mesh: planetMesh,
        isFixed: true,
        type: 'planet',
        size: PLANET_RADIUS * 2,
        mass: PLANET_MASS
      };
      
      objects.push(planet);
      
      // Add surface normal arrows for the planet
      addPlanetSurfaceNormals(planet);
    }

    // Add a new function to create normals for the planet
    function addPlanetSurfaceNormals(planet) {
      if (!planet || !planet.mesh) return;
      
      // Create normal arrows at evenly distributed points on the sphere
      const points = 12;
      
      for (let i = 0; i < points; i++) {
        // Use fibonacci sphere algorithm for even distribution
        const y = 1 - (i / (points - 1)) * 2;
        const radius = Math.sqrt(1 - y * y);
        const theta = ((Math.sqrt(5) + 1) / 2 - 1) * 2 * Math.PI * i;
        
        const x = Math.cos(theta) * radius;
        const z = Math.sin(theta) * radius;
        
        const normal = new THREE.Vector3(x, y, z).normalize();
        const position = normal.clone().multiplyScalar(PLANET_RADIUS);
        
        const arrow = new THREE.ArrowHelper(
          normal,
          position,
          NORMAL_ARROW_LENGTH,
          NORMAL_ARROW_COLOR,
          0.2,
          0.1
        );
        scene.add(arrow);
        normalArrows.push(arrow);
      }
    }

    function createRandomObjects(count) {
      const shapes = ['box', 'sphere'];
      const colors = [0x7C4DFF, 0x00BFA5, 0xFFD600, 0x64DD17];
      
      for (let i = 0; i < count; i++) {
        const randomX = (Math.random() - 0.5) * 10;
        const randomY = 1 + Math.random() * 8;
        const randomZ = (Math.random() - 0.5) * 10;
        
        const size = 0.8 + Math.random() * 1.5;
        
        const shapeType = shapes[Math.floor(Math.random() * shapes.length)];
        const color = colors[Math.floor(Math.random() * colors.length)];
        
        const randomRotation = new THREE.Quaternion().setFromEuler(
          new THREE.Euler(
            Math.random() * Math.PI,
            Math.random() * Math.PI,
            Math.random() * Math.PI
          )
        );
        
        const bodyDesc = RAPIER.RigidBodyDesc.fixed();
        bodyDesc.setTranslation(randomX, randomY, randomZ);
        bodyDesc.setRotation({
          x: randomRotation.x,
          y: randomRotation.y,
          z: randomRotation.z,
          w: randomRotation.w
        });
        
        const body = physicsWorld.createRigidBody(bodyDesc);
        
        let collider, geometry;
        
        if (shapeType === 'box') {
          collider = RAPIER.ColliderDesc.cuboid(size/2, size/2, size/2);
          geometry = new THREE.BoxGeometry(size, size, size);
        } else {
          collider = RAPIER.ColliderDesc.ball(size/2);
          geometry = new THREE.SphereGeometry(size/2, 16, 16);
        }
        
        collider.setFriction(OBJECT_FRICTION);
        physicsWorld.createCollider(collider, body);
        
        const mesh = new THREE.Mesh(
          geometry, 
          new THREE.MeshStandardMaterial({ color })
        );
        scene.add(mesh);
        
        const obj = {
          body,
          mesh,
          isFixed: true,
          type: shapeType,
          size: size,
          mass: size * 2 // Mass proportional to size
        };
        
        objects.push(obj);
        
        // Add surface normal arrows
        addSurfaceNormals(obj);
      }
    }

    function addSurfaceNormals(obj) {
      if (!obj || !obj.mesh) return;
      
      const pos = obj.body.translation();
      const rot = obj.body.rotation();
      const position = new THREE.Vector3(pos.x, pos.y, pos.z);
      const quaternion = new THREE.Quaternion(rot.x, rot.y, rot.z, rot.w);
      
      if (obj.type === 'sphere') {
        // For spheres add normals in different directions
        const directions = [
          new THREE.Vector3(1, 0, 0),
          new THREE.Vector3(0, 1, 0),
          new THREE.Vector3(0, 0, 1),
          new THREE.Vector3(-1, 0, 0),
          new THREE.Vector3(0, -1, 0),
          new THREE.Vector3(0, 0, -1)
        ];
        
        for (const dir of directions) {
          const normalizedDir = dir.clone().normalize();
          const origin = position.clone().add(normalizedDir.clone().multiplyScalar(obj.size / 2));
          
          const arrow = new THREE.ArrowHelper(
            normalizedDir,
            origin,
            NORMAL_ARROW_LENGTH,
            NORMAL_ARROW_COLOR,
            0.2,
            0.1
          );
          scene.add(arrow);
          normalArrows.push(arrow);
        }
      } else if (obj.type === 'box') {
        // For boxes add normals on each face
        const faceNormals = [
          new THREE.Vector3(1, 0, 0),
          new THREE.Vector3(-1, 0, 0),
          new THREE.Vector3(0, 1, 0),
          new THREE.Vector3(0, -1, 0),
          new THREE.Vector3(0, 0, 1),
          new THREE.Vector3(0, 0, -1)
        ];
        
        for (const normal of faceNormals) {
          const worldNormal = normal.clone().applyQuaternion(quaternion);
          const halfSize = obj.size / 2;
          
          // Calculate position on the face
          const localPos = new THREE.Vector3(
            normal.x * halfSize,
            normal.y * halfSize,
            normal.z * halfSize
          );
          const worldPos = position.clone().add(localPos.applyQuaternion(quaternion));
          
          const arrow = new THREE.ArrowHelper(
            worldNormal,
            worldPos,
            NORMAL_ARROW_LENGTH,
            NORMAL_ARROW_COLOR,
            0.2,
            0.1
          );
          scene.add(arrow);
          normalArrows.push(arrow);
        }
      }
    }

    function checkCollisions() {
      if (!player || !player.body || !player.mesh) return;
      
      // Decrement jump cooldown if active
      if (player.jumpCooldown > 0) {
        player.jumpCooldown--;
      }
      
      // Only reset grounded state if we're not in a jump
      if (player.jumpCooldown <= 0) {
        player.grounded = false;
        player.lastContactNormal = null;
      }
      
      // Remove previous collision arrow if exists
      if (collisionNormalArrow) {
        scene.remove(collisionNormalArrow);
        collisionNormalArrow = null;
      }
      
      // Check for collisions with all objects
      const playerPos = player.body.translation();
      const playerPosition = new THREE.Vector3(playerPos.x, playerPos.y, playerPos.z);
      
      for (const obj of objects) {
        const objPos = obj.body.translation();
        const objPosition = new THREE.Vector3(objPos.x, objPos.y, objPos.z);
        
        let collisionNormal = null;
        let distance = 0;
        
        if (obj.type === 'planet') {
          // For planet, calculate spherical collision
          const direction = new THREE.Vector3().subVectors(playerPosition, objPosition);
          distance = direction.length() - (PLANET_RADIUS + PLAYER_RADIUS);
          
          if (distance <= 0.05) {
            collisionNormal = direction.normalize();
          }
        } else if (obj.type === 'sphere') {
          // For spheres, check distance from player center to sphere center
          const direction = new THREE.Vector3().subVectors(playerPosition, objPosition);
          distance = direction.length() - (obj.size/2 + PLAYER_RADIUS);
          
          if (distance <= 0.05) {
            collisionNormal = direction.normalize();
          }
        } else if (obj.type === 'box') {
          // For boxes, find closest point on box to player
          const objRot = obj.body.rotation();
          const objQuat = new THREE.Quaternion(objRot.x, objRot.y, objRot.z, objRot.w);
          const invQuat = objQuat.clone().invert();
          
          // Get player position in box local space
          const localPlayerPos = playerPosition.clone().sub(objPosition).applyQuaternion(invQuat);
          
          // Get closest point on box in local space
          const halfSize = obj.size / 2;
          const closestPoint = new THREE.Vector3(
            Math.max(-halfSize, Math.min(halfSize, localPlayerPos.x)),
            Math.max(-halfSize, Math.min(halfSize, localPlayerPos.y)),
            Math.max(-halfSize, Math.min(halfSize, localPlayerPos.z))
          );
          
          // Convert back to world space
          const worldClosestPoint = closestPoint.clone().applyQuaternion(objQuat).add(objPosition);
          
          // Calculate distance and direction
          const direction = new THREE.Vector3().subVectors(playerPosition, worldClosestPoint);
          distance = direction.length() - PLAYER_RADIUS;
          
          if (distance <= 0.05) {
            // Determine which face of the box we hit
            const relPos = closestPoint.clone();
            const absX = Math.abs(relPos.x);
            const absY = Math.abs(relPos.y);
            const absZ = Math.abs(relPos.z);
            
            let localNormal = new THREE.Vector3();
            
            if (absX >= halfSize - 0.01 && absX > absY && absX > absZ) {
              localNormal.x = Math.sign(relPos.x);
            } else if (absY >= halfSize - 0.01 && absY > absX && absY > absZ) {
              localNormal.y = Math.sign(relPos.y);
            } else if (absZ >= halfSize - 0.01) {
              localNormal.z = Math.sign(relPos.z);
            }
            
            // Transform normal to world space
            collisionNormal = localNormal.applyQuaternion(objQuat).normalize();
          }
        }
        
        // If collision found, update player state and visualize the normal
        if (collisionNormal && distance <= 0.05) {
          player.grounded = true;
          player.falling = false;
          player.lastContactNormal = collisionNormal;
          
          // Create collision normal arrow
          collisionNormalArrow = new THREE.ArrowHelper(
            collisionNormal,
            playerPosition,
            NORMAL_ARROW_LENGTH * 1.5,
            COLLISION_ARROW_COLOR,
            0.3,
            0.15
          );
          scene.add(collisionNormalArrow);
          
          // Don't align player here anymore, since we're doing it in handlePlayerMovement
          // This prevents overriding the planetary orientation
          // Instead, just store the normal for use in slope detection
          
          break;
        }
      }
      
      // If not grounded and not actively jumping, player is falling
      if (!player.grounded && player.jumpCooldown <= 0) {
        player.falling = true;
      }
    }

    // Update the point gravity function to use GRAVITY_STRENGTH and apply to grounded state
    function applyPointGravity() {
      if (!player || !player.body) return;
      
      const playerPos = player.body.translation();
      const playerPosition = new THREE.Vector3(playerPos.x, playerPos.y, playerPos.z);
      let netGravityForce = new THREE.Vector3(0, 0, 0);
      
      // Find the planet
      const planet = objects.find(obj => obj.type === 'planet');
      
      if (planet && planet.body) {
        // Calculate gravity from the planet (with higher priority)
        const planetPos = planet.body.translation();
        const planetPosition = new THREE.Vector3(planetPos.x, planetPos.y, planetPos.z);
        
        // Direction from player to planet
        const direction = new THREE.Vector3().subVectors(planetPosition, playerPosition);
        const distance = direction.length();
        
        // Skip if too close to prevent extreme forces
        if (distance >= 0.1) {
          // Calculate gravity force (F = G * m1 * m2 / r^2)
          const forceMagnitude = GRAVITY_STRENGTH * player.mass * planet.mass / (distance * distance);
          
          // Add to net force (normalized direction * force magnitude)
          netGravityForce.add(direction.normalize().multiplyScalar(forceMagnitude));
        }
      }
      
      // Calculate gravity from other objects (with lower influence)
      for (const obj of objects) {
        if (!obj.body || obj.type === 'planet') continue; // Skip the planet as we handled it separately
        
        const objPos = obj.body.translation();
        const objPosition = new THREE.Vector3(objPos.x, objPos.y, objPos.z);
        
        // Direction from player to object
        const direction = new THREE.Vector3().subVectors(objPosition, playerPosition);
        const distance = direction.length();
        
        // Skip if too close (prevent extreme forces)
        if (distance < 0.1) continue;
        
        // Calculate gravity force (F = G * m1 * m2 / r^2)
        const forceMagnitude = POINT_GRAVITY_STRENGTH * 0.1 * player.mass * obj.mass / (distance * distance);
        
        // Add to net force (normalized direction * force magnitude)
        netGravityForce.add(direction.normalize().multiplyScalar(forceMagnitude));
      }
      
      // Always apply the gravity force, but handle differently based on player state
      const gravityStrength = 0.001; // Base gravity scaling factor
      
      if (player.grounded) {
        // When grounded, we need to counteract the tangential component of gravity
        if (player.lastContactNormal) {
          
          // Project gravity onto the normal to get normal component
          const gravityDir = netGravityForce.clone().normalize();
          const normalComponent = player.lastContactNormal.clone().multiplyScalar(gravityDir.dot(player.lastContactNormal));
          
          // Calculate tangential component of gravity (parallel to surface)
          const tangentialComponent = new THREE.Vector3().subVectors(gravityDir, normalComponent);
          
          // Only apply normal component if player is not actively moving
          if (player.momentum.length() < 0.01) {
            // Cancel out tangential component by applying equal and opposite force
            // This prevents sliding on slopes when player isn't actively moving
            const counterForce = tangentialComponent.clone().negate().multiplyScalar(
              gravityStrength * GRAVITY_STRENGTH * 2.0 // Stronger to overcome gravity
            );
            
            player.body.applyImpulse(
              {
                x: counterForce.x,
                y: counterForce.y,
                z: counterForce.z
              },
              true
            );
          }
          
          // Apply normal force to keep player on the surface (similar to the existing code)
          const stickDirection = player.lastContactNormal.clone().negate();
          const stickForce = gravityStrength * GRAVITY_STRENGTH * 1.5; // Increased to prevent slipping
          
          player.body.applyImpulse(
            { 
              x: stickDirection.x * stickForce,
              y: stickDirection.y * stickForce, 
              z: stickDirection.z * stickForce 
            }, 
            true
          );
        }
      } else {
        // When in air (falling or jumping), apply full gravity
        // Use a stronger force while falling
        const fallMultiplier = player.isJumping ? 0.5 : 1.0; // Less gravity during jump apex
        const currentVel = player.body.linvel();
        let newVelocity = new THREE.Vector3(currentVel.x, currentVel.y, currentVel.z);
        
        // Apply gravity with appropriate scaling
        newVelocity.add(netGravityForce.multiplyScalar(gravityStrength * fallMultiplier));
        
        player.body.setLinvel({
          x: newVelocity.x,
          y: newVelocity.y,
          z: newVelocity.z
        }, true);
      }
    }
    
    // Also update handlePlayerMovement to add more friction when standing still
    function handlePlayerMovement() {
      if (!player || !player.body) return;
      
      const playerPos = player.body.translation();
      const playerRot = player.body.rotation();
      const playerQuat = new THREE.Quaternion(playerRot.x, playerRot.y, playerRot.z, playerRot.w);
      
      // Track if the player was grounded in the previous frame
      player.wasGrounded = player.grounded;
      
      // Create a directional vector based on keys pressed
      const moveDirection = new THREE.Vector3(0, 0, 0);
      if (keys.w) moveDirection.z -= 1;
      if (keys.s) moveDirection.z += 1;
      if (keys.a) moveDirection.x -= 1;
      if (keys.d) moveDirection.x += 1;
      
      // Normalize movement vector if it has length
      if (moveDirection.length() > 0) {
        moveDirection.normalize();
      }
      
      // Apply movement in world space based on player's orientation
      const worldMoveDir = moveDirection.clone().applyQuaternion(playerQuat);
      
      // Calculate new position
      let newPosition = new THREE.Vector3(
        playerPos.x,
        playerPos.y,
        playerPos.z
      );
      
      // Save previous position to calculate velocity
      const prevPos = new THREE.Vector3(playerPos.x, playerPos.y, playerPos.z);
      
      // If grounded, move along the surface using the contact normal
      if (player.grounded && player.lastContactNormal) {
        const normal = player.lastContactNormal;
        
        // Add a small gravity component to press the player against the surface
        const planet = objects.find(obj => obj.type === 'planet');
        if (planet && planet.body) {
          const planetPos = planet.body.translation();
          const planetPosition = new THREE.Vector3(planetPos.x, planetPos.y, planetPos.z);
          
          // Direction from player to planet center
          const gravityDir = new THREE.Vector3().subVectors(planetPosition, prevPos).normalize();
          
          // Only add gravity if not moving (to prevent sliding)
          if (moveDirection.length() === 0) {
            // Apply stronger surface adhesion to prevent sliding
            newPosition.add(gravityDir.multiplyScalar(0.002 * GRAVITY_STRENGTH));
            
            // Reset momentum when standing still to prevent sliding
            player.momentum.multiplyScalar(0.5); // More aggressive friction when still
          } else {
            // Regular adhesion when moving
            newPosition.add(gravityDir.multiplyScalar(0.001 * GRAVITY_STRENGTH));
          }
        }
        
        // If on a steep slope, slide down
        if (player.onSteepSlope && player.slideDirection) {
          // Calculate the slide speed based on the slope angle
          const slideSpeed = player.fallSpeed + 0.05 * SLIDE_SPEED_MULTIPLIER;
          
          // Apply slide movement along the slide direction
          newPosition.add(player.slideDirection.clone().multiplyScalar(slideSpeed));
          
          // Check if player is trying to move uphill
          if (moveDirection.length() > 0) {
            // Project movement onto the surface plane defined by the normal
            const proj = worldMoveDir.dot(normal);
            const tangent = new THREE.Vector3().copy(worldMoveDir).sub(
              normal.clone().multiplyScalar(proj)
            ).normalize();
            
            // Determine if movement is going uphill by checking the dot product with slide direction
            const dotWithSlide = tangent.dot(player.slideDirection);
            
            // Only allow movement if NOT going uphill against the slide direction
            if (dotWithSlide >= -0.3) { // Allow slight uphill movement (30 degrees)
              // Apply reduced movement control while sliding
              newPosition.add(tangent.multiplyScalar(MOVE_SPEED * 0.5));
            }
          }
          
          // Store the movement for momentum
          player.momentum.copy(player.slideDirection).multiplyScalar(slideSpeed);
        } else if (moveDirection.length() > 0) {
          // Normal movement on walkable surface
          // Project movement onto the surface plane defined by the normal
          const proj = worldMoveDir.dot(normal);
          const tangent = new THREE.Vector3().copy(worldMoveDir).sub(
            normal.clone().multiplyScalar(proj)
          ).normalize();
          
          // Apply movement along the surface
          newPosition.add(tangent.multiplyScalar(MOVE_SPEED));
          
          // Store the movement as momentum for potential edge fly-off
          player.momentum.copy(tangent).multiplyScalar(MOVE_SPEED);
        } else {
          // If not actively moving, gradually reduce momentum
          player.momentum.multiplyScalar(0.9);
        }
      } 
      // If falling or jumping, handle air control
      else if (player.falling) {
        // Explicitly reset sliding state when in the air
        player.onSteepSlope = false;
        player.slideDirection = null;
        
        // If we just lost ground contact (went off an edge) and have sufficient speed
        if (player.wasGrounded && player.momentum.length() > EDGE_VELOCITY_THRESHOLD) {
          // Start edge detection counter
          player.edgeDetectionCounter = EDGE_DETECTION_TIME;
          
          // Apply momentum to continue movement
          newPosition.add(player.momentum);
          
          // Apply slight downward force to simulate gravity
          const planet = objects.find(obj => obj.type === 'planet');
          if (planet && planet.body) {
            const planetPos = planet.body.translation();
            const planetPosition = new THREE.Vector3(planetPos.x, planetPos.y, planetPos.z);
            
            // Direction from player to planet center
            const gravityDir = new THREE.Vector3().subVectors(planetPosition, newPosition).normalize();
            
            // Apply mild gravity influence
            newPosition.add(gravityDir.multiplyScalar(0.03));
          }
        }
        // Handle active jump
        else if (player.isJumping && player.jumpDirection) {
          // Use stored jump direction for the entire jump arc
          newPosition.add(player.jumpDirection.clone().multiplyScalar(-player.fallSpeed));
          
          // Gradually decrease upward movement and transition to falling
          player.fallSpeed = Math.min(player.fallSpeed + 0.01, player.maxFallSpeed);
          
          // When fallSpeed becomes positive, we're now falling down
          if (player.fallSpeed > 0) {
            player.isJumping = false; // End the jumping phase
          }
        } else {
          // Standard gravity toward the planet
          const planet = objects.find(obj => obj.type === 'planet');
          if (planet && planet.body) {
            const planetPos = planet.body.translation();
            const planetPosition = new THREE.Vector3(planetPos.x, planetPos.y, planetPos.z);
            
            // Direction from player to planet center
            const gravityDir = new THREE.Vector3().subVectors(planetPosition, newPosition).normalize();
            
            // Increase fall speed gradually
            player.fallSpeed = Math.min(player.fallSpeed + 0.005, player.maxFallSpeed);
            
            // Apply gravity movement
            newPosition.add(gravityDir.multiplyScalar(player.fallSpeed));
          }
        }
        
        // Apply air control (reduced movement in air)
        if (moveDirection.length() > 0) {
          // Apply reduced air control
          newPosition.add(worldMoveDir.multiplyScalar(MOVE_SPEED * 0.3));
        }
      }
      
      // Always update player orientation relative to the planet
      const planet = objects.find(obj => obj.type === 'planet');
      if (planet && player) {
        const planetPos = planet.body.translation();
        const playerPos = player.body.translation();
        
        // Direction from planet to player (this is the "up" direction for the player)
        const upDirection = new THREE.Vector3(
          playerPos.x - planetPos.x,
          playerPos.y - planetPos.y, 
          playerPos.z - planetPos.z
        ).normalize();
        
        // Only use contact normal when on steep slopes or special surfaces
        // Otherwise, always orient based on direction to planet center
        if ((!player.onSteepSlope && player.grounded) || !player.lastContactNormal) {
          // Align player with planet gravity
          const worldUp = new THREE.Vector3(0, 1, 0);
          const alignmentQuat = new THREE.Quaternion().setFromUnitVectors(worldUp, upDirection);
          
          player.body.setRotation({
            x: alignmentQuat.x,
            y: alignmentQuat.y,
            z: alignmentQuat.z,
            w: alignmentQuat.w
          });
        }
      }
      
      // Check for potential collisions before applying movement
      player.nextPosition = newPosition;
      checkCollisionsAndResolve();
    }
    
    // Update checkCollisionsAndResolve to not overwrite planetary orientation
    function checkCollisionsAndResolve() {
      if (!player || !player.body || !player.mesh || !player.nextPosition) return;
      
      // Decrement jump cooldown if active
      if (player.jumpCooldown > 0) {
        player.jumpCooldown--;
      }
      
      // Only reset grounded state if we're not in a jump
      if (player.jumpCooldown <= 0) {
        player.grounded = false;
        player.lastContactNormal = null;
      }
      
      // Remove previous collision arrow if exists
      if (collisionNormalArrow) {
        scene.remove(collisionNormalArrow);
        collisionNormalArrow = null;
      }
      
      // Convert nextPosition to THREE.Vector3 if it's not already
      const nextPosition = new THREE.Vector3(
        player.nextPosition.x,
        player.nextPosition.y,
        player.nextPosition.z
      );
      
      // Check for collisions with all objects
      let closestHit = null;
      let closestDistance = Infinity;
      let closestNormal = null;
      let isGrounded = false;
      
      for (const obj of objects) {
        const objPos = obj.body.translation();
        const objPosition = new THREE.Vector3(objPos.x, objPos.y, objPos.z);
        
        let collisionNormal = null;
        let distance = 0;
        
        if (obj.type === 'planet') {
          // For planet, calculate spherical collision
          const direction = new THREE.Vector3().subVectors(nextPosition, objPosition);
          distance = direction.length() - (PLANET_RADIUS + PLAYER_RADIUS);
          
          if (distance <= 0.05) {
            collisionNormal = direction.normalize();
          }
        } else if (obj.type === 'sphere') {
          // For spheres, check distance from player center to sphere center
          const direction = new THREE.Vector3().subVectors(nextPosition, objPosition);
          distance = direction.length() - (obj.size/2 + PLAYER_RADIUS);
          
          if (distance <= 0.05) {
            collisionNormal = direction.normalize();
          }
        } else if (obj.type === 'box') {
          // For boxes, find closest point on box to player
          const objRot = obj.body.rotation();
          const objQuat = new THREE.Quaternion(objRot.x, objRot.y, objRot.z, objRot.w);
          const invQuat = objQuat.clone().invert();
          
          // Get player position in box local space
          const localPlayerPos = nextPosition.clone().sub(objPosition).applyQuaternion(invQuat);
          
          // Get closest point on box in local space
          const halfSize = obj.size / 2;
          const closestPoint = new THREE.Vector3(
            Math.max(-halfSize, Math.min(halfSize, localPlayerPos.x)),
            Math.max(-halfSize, Math.min(halfSize, localPlayerPos.y)),
            Math.max(-halfSize, Math.min(halfSize, localPlayerPos.z))
          );
          
          // Convert back to world space
          const worldClosestPoint = closestPoint.clone().applyQuaternion(objQuat).add(objPosition);
          
          // Calculate distance and direction
          const direction = new THREE.Vector3().subVectors(nextPosition, worldClosestPoint);
          distance = direction.length() - PLAYER_RADIUS;
          
          if (distance <= 0.05) {
            // Determine which face of the box we hit
            const relPos = closestPoint.clone();
            const absX = Math.abs(relPos.x);
            const absY = Math.abs(relPos.y);
            const absZ = Math.abs(relPos.z);
            
            let localNormal = new THREE.Vector3();
            
            if (absX >= halfSize - 0.01 && absX > absY && absX > absZ) {
              localNormal.x = Math.sign(relPos.x);
            } else if (absY >= halfSize - 0.01 && absY > absX && absY > absZ) {
              localNormal.y = Math.sign(relPos.y);
            } else if (absZ >= halfSize - 0.01) {
              localNormal.z = Math.sign(relPos.z);
            }
            
            // Transform normal to world space
            collisionNormal = localNormal.applyQuaternion(objQuat).normalize();
          }
        }
        
        // If collision found, store it if it's closer than previous collisions
        if (collisionNormal && distance < closestDistance) {
          closestDistance = distance;
          closestNormal = collisionNormal;
          closestHit = obj;
        }
      }
      
      // Handle the closest collision
      if (closestNormal) {
        // Store previous grounded state and normal for comparison FIRST
        // Move these declarations earlier to avoid reference errors
        const wasGrounded = player.grounded;
        const prevNormal = player.lastContactNormal ? player.lastContactNormal.clone() : null;
        
        // Calculate the slope angle differently based on the local gravity direction
        let isSteepSlope = false;
        
        // Find the planet for gravity reference
        const planet = objects.find(obj => obj.type === 'planet');
        
        // Determine the "up" vector based on context
        let upVector;
        let gravityBasedUp = null;
        
        // First, if we have a planet, always calculate a gravity-based "up" vector
        if (planet) {
          const planetPos = planet.body.translation();
          const playerPos = player.body.translation();
          gravityBasedUp = new THREE.Vector3(
            playerPos.x - planetPos.x,
            playerPos.y - planetPos.y,
            playerPos.z - planetPos.z
          ).normalize();
        }
        
        if (planet && closestHit && closestHit.type === 'planet') {
          // On planet: "up" is away from planet center (along the surface normal)
          upVector = closestNormal.clone(); // Surface normal is already pointing away from center
          isSteepSlope = false;    // Planet surface is always walkable
        } 
        else if (gravityBasedUp) {
          // For any other object under planet gravity
          upVector = gravityBasedUp;
          
          // Calculate angle between surface normal and gravity-based up vector
          const angle = Math.acos(closestNormal.dot(upVector));
          
          // More forgiving slope detection:
          // 1. Use a higher threshold for planet-aligned objects
          // 2. Consider the distance from planet center
          
          if (angle < 0.4) { // About 23 degrees - easily walkable
            isSteepSlope = false;
          }
          else if (planet) {
            // Check if object is on planet surface (more permissive for planet-aligned objects)
            const planetPos = planet.body.translation();
            const playerPos = nextPosition.clone();
            const distanceToCenter = playerPos.distanceTo(new THREE.Vector3(planetPos.x, planetPos.y, planetPos.z));
            
            // More forgiving for objects closer to planet surface
            const planetProximityFactor = Math.max(0, Math.min(1, 
              1.0 - (distanceToCenter - PLANET_RADIUS) / (PLANET_RADIUS * 0.5)
            ));
            
            // Scale walkable slope based on proximity to planet
            const adjustedSlope = MAX_WALKABLE_SLOPE * (1 + planetProximityFactor * 0.5);
            isSteepSlope = angle > adjustedSlope;
          }
          else {
            // Default case - use standard threshold
            isSteepSlope = angle > MAX_WALKABLE_SLOPE;
          }
        } 
        else {
          // No planet - fall back to world up
          upVector = new THREE.Vector3(0, 1, 0);
          const angle = Math.acos(closestNormal.dot(upVector));
          isSteepSlope = angle > MAX_WALKABLE_SLOPE;
        }
        
        // Store collision normal separately for slide calculations
        const slideNormal = closestNormal.clone();
        
        // Don't re-ground the player immediately if they just went off an edge
        if (player.edgeDetectionCounter > 0) {
          // Only ground the player on a new surface if it's relatively flat (not too steep)
          if (!isSteepSlope) {
            // This is a flat enough surface to land on
            player.edgeDetectionCounter = 0;
            player.grounded = true;
            player.falling = false;
          } else {
            // Surface is too steep, maintain momentum and just resolve collision
            // without grounding the player
            player.grounded = false;
            player.falling = true;
          }
        } else {
          // Normal collision handling for non-edge cases
          player.grounded = true;
          player.falling = false;
        }
        
        // Only update the contact normal for orientation if:
        // 1. It's not a steep slope, OR
        // 2. Player doesn't have a contact normal yet, OR
        // 3. Player was not previously grounded (meaning they just landed)
        if (!isSteepSlope || !prevNormal || !wasGrounded) {
          player.lastContactNormal = closestNormal.clone();
        }
        
        // Reset fall speed when any collision happens, even if not grounded
        player.fallSpeed = 0;
        
        // Create collision normal arrow
        collisionNormalArrow = new THREE.ArrowHelper(
          closestNormal,
          nextPosition,
          NORMAL_ARROW_LENGTH * 1.5,
          COLLISION_ARROW_COLOR,
          0.3,
          0.15
        );
        scene.add(collisionNormalArrow);
        
        // IMPORTANT: Reset slide state by default, only set it if needed
        const wasOnSteepSlope = player.onSteepSlope;
        player.onSteepSlope = false;
        player.slideDirection = null;
        
        // If the angle is too steep, check if we should slide
        if (isSteepSlope) {
          // Calculate the player's movement direction relative to the slope
          const moveVec = new THREE.Vector3().subVectors(
            nextPosition, 
            new THREE.Vector3(
              player.body.translation().x, 
              player.body.translation().y, 
              player.body.translation().z
            )
          );
          
          // Calculate the projection of movement direction onto the slope normal
          const moveTowardSlope = moveVec.dot(closestNormal);
          
          // Only slide if player is moving toward the slope or is already on it
          if (moveTowardSlope < 0 || (wasGrounded && prevNormal && prevNormal.dot(closestNormal) > 0.7)) {
            player.onSteepSlope = true;
            
            // Use gravity-based up vector for slide calculations if available
            const gravityDir = gravityBasedUp ? gravityBasedUp.clone().negate() : new THREE.Vector3(0, -1, 0);
            
            // Calculate slide direction (project gravity onto the surface plane using slide normal)
            const proj = gravityDir.dot(slideNormal);
            player.slideDirection = new THREE.Vector3()
              .copy(gravityDir)
              .sub(slideNormal.clone().multiplyScalar(proj))
              .normalize();
          }
        }
        
        // Resolve collision by moving the player along the normal
        // Push the player out along the collision normal to prevent sinking
        const pushDistance = Math.max(0, 0.05 - closestDistance);
        const resolvedPosition = nextPosition.clone().add(
          closestNormal.clone().multiplyScalar(pushDistance)
        );
        
        // Set the resolved position
        player.body.setTranslation({
          x: resolvedPosition.x,
          y: resolvedPosition.y,
          z: resolvedPosition.z
        });
      } 
      else {
        // No collision, explicitly reset sliding and grounded state
        player.body.setTranslation({
          x: nextPosition.x,
          y: nextPosition.y,
          z: nextPosition.z
        });
        
        // Ensure sliding and grounded states are reset when airborne
        player.onSteepSlope = false;
        player.slideDirection = null;
        player.grounded = false;
        
        // If not grounded and not actively jumping, player is falling
        if (player.jumpCooldown <= 0) {
          player.falling = true;
        }
      }
    }

    function handlePlayerJump() {
      if (!player || !player.grounded || player.jumpCooldown > 0) return;
      
      if (keys.space) {
        // Use the collision normal directly as jump direction
        // This is the same direction shown by the green arrow
        const jumpDirection = player.lastContactNormal.clone().normalize();
        
        // Store jump direction for use in movement
        player.jumpDirection = jumpDirection.clone();
        player.isJumping = true;
        
        // Set initial jump velocity (for animation purposes)
        player.velocity = jumpDirection.clone().multiplyScalar(JUMP_FORCE);
        
        // Update player state
        player.grounded = false;
        player.falling = true;
        player.jumpCooldown = 15; // Prevent immediate re-landing
        player.fallSpeed = -0.2; // Initial upward movement (negative because we're moving away from gravity)
        
        // Remove collision arrow when jumping
        if (collisionNormalArrow) {
          scene.remove(collisionNormalArrow);
          collisionNormalArrow = null;
        }
      }
    }

    // Add this function to apply gravity to dynamic objects
    function applyDynamicObjectsGravity() {
      // Find the planet
      const planet = objects.find(obj => obj.type === 'planet');
      if (!planet || !planet.body) return;
      
      const planetPos = planet.body.translation();
      const planetPosition = new THREE.Vector3(planetPos.x, planetPos.y, planetPos.z);
      
      // Apply gravity to all dynamic objects
      for (const obj of objects) {
        if (!obj.isDynamic || !obj.body) continue;
        
        const objPos = obj.body.translation();
        const objPosition = new THREE.Vector3(objPos.x, objPos.y, objPos.z);
        
        // Calculate direction and distance to planet center
        const direction = new THREE.Vector3().subVectors(planetPosition, objPosition);
        const distance = direction.length();
        
        // Skip if too close to prevent extreme forces
        if (distance < PLANET_RADIUS * 0.9) {
          // Object is inside or very close to the planet - move it out
          const normalized = direction.clone().normalize();
          const correctionDistance = PLANET_RADIUS * 1.05 - distance;
          
          if (correctionDistance > 0) {
            obj.body.setTranslation({
              x: objPos.x - normalized.x * correctionDistance,
              y: objPos.y - normalized.y * correctionDistance,
              z: objPos.z - normalized.z * correctionDistance
            }, true);
          }
          continue;
        }
        
        // Calculate gravity force with inverse square law (F = G * m1 * m2 / r^2)
        const forceMagnitude = GRAVITY_STRENGTH * obj.mass * planet.mass / (distance * distance);
        direction.normalize();
        
        // Scale force by delta time (0.016 is roughly 60fps)
        const timeScale = 0.016;
        const scaledForce = forceMagnitude * timeScale;
        
        // Get current velocity
        const vel = obj.body.linvel();
        
        // Calculate new velocity with gravity applied
        const newVel = {
          x: vel.x + direction.x * scaledForce,
          y: vel.y + direction.y * scaledForce,
          z: vel.z + direction.z * scaledForce
        };
        
        // Apply the new velocity
        obj.body.setLinvel(newVel, true);
        
        // Apply small damping to prevent perpetual orbits (if desired)
        // Comment this out if you want objects to orbit forever
        const dampingFactor = 0.9998;
        obj.body.setLinvel(
          { 
            x: newVel.x * dampingFactor,
            y: newVel.y * dampingFactor, 
            z: newVel.z * dampingFactor 
          }, 
          true
        );
      }
    }

    // Keep only this single animate function and remove any duplicates
    function animate() {
      animationFrameId = requestAnimationFrame(animate);
      
      // Handle jumping
      handlePlayerJump();
      
      // Apply gravity to player
      applyPointGravity();
      
      // Apply gravity to dynamic objects (new function call)
      applyDynamicObjectsGravity();
      
      // Handle player movement
      handlePlayerMovement();
      
      // Call the interaction handler
      handlePlayerPhysicsInteractions();
      
      // Process collision events (needed before physics step)
      eventQueue.drainCollisionEvents((handle1, handle2, started) => {
        // Optional: Handle collision events between physics objects
      });
      
      // Step the physics world
      physicsWorld.step();
      
      // Update collision arrow position if it exists
      if (collisionNormalArrow && player && player.body) {
        const playerPos = player.body.translation();
        collisionNormalArrow.position.set(playerPos.x, playerPos.y, playerPos.z);
      }
      
      controls.update();
      
      if (player) {
        updateObjectTransform(player);
      }
      
      for (const obj of objects) {
        updateObjectTransform(obj);
      }
      
      renderer.render(scene, camera);
    }

    function onWindowResize() {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    }
    
    // Add this function to create gravity-aligned platforms
    function createAlignedPlatforms() {
      // Create several platforms positioned around the planet
      const platformPositions = [
        { x: 5, y: 5, z: 0 },
        { x: -5, y: 5, z: 2 },
        { x: 0, y: 5, z: 5 },
        { x: 2, y: -5, z: 4 }
      ];
      
      const platformSizes = [1.5, 2, 1.8, 2.5];
      const platformColors = [0xFF5733, 0x33FF57, 0x3357FF, 0xFF33F5];
      
      for (let i = 0; i < platformPositions.length; i++) {
        const pos = platformPositions[i];
        const size = platformSizes[i % platformSizes.length];
        const color = platformColors[i % platformColors.length];
        
        // Create the body
        const bodyDesc = RAPIER.RigidBodyDesc.fixed();
        bodyDesc.setTranslation(pos.x, pos.y, pos.z);
        
        // Important: align the platform to face the planet center
        const planet = objects.find(obj => obj.type === 'planet');
        if (planet) {
          const planetPos = planet.body.translation();
          const platformPos = new THREE.Vector3(pos.x, pos.y, pos.z);
          
          // Direction from planet to platform (this is our "up" direction)
          const upDir = new THREE.Vector3().subVectors(platformPos, 
            new THREE.Vector3(planetPos.x, planetPos.y, planetPos.z)).normalize();
          
          // We need a rotation that aligns the platform's y-axis with this direction
          const worldUp = new THREE.Vector3(0, 1, 0);
          const rotationQuat = new THREE.Quaternion().setFromUnitVectors(worldUp, upDir);
          
          // Set the rotation to align with planet gravity
          bodyDesc.setRotation({
            x: rotationQuat.x,
            y: rotationQuat.y,
            z: rotationQuat.z,
            w: rotationQuat.w
          });
        }
        
        const body = physicsWorld.createRigidBody(bodyDesc);
        
        // Create a slightly thinner box for the platform
        const height = size / 4;  // Make it a flat platform
        const collider = RAPIER.ColliderDesc.cuboid(size/2, height/2, size/2);
        collider.setFriction(OBJECT_FRICTION * 1.5); // Higher friction for platforms
        physicsWorld.createCollider(collider, body);
        
        // Create the mesh
        const geometry = new THREE.BoxGeometry(size, height, size);
        const material = new THREE.MeshStandardMaterial({ 
          color: color,
          roughness: 0.7,
          metalness: 0.2
        });
        const mesh = new THREE.Mesh(geometry, material);
        scene.add(mesh);
        
        // Add to objects array
        const obj = {
          body,
          mesh,
          isFixed: true,
          type: 'box',
          size: size,
          mass: size * 2,
          isPlatform: true // Mark as platform for special handling
        };
        
        objects.push(obj);
        
        // Add normal arrow for top face only (cleaner look)
        const pos3 = body.translation();
        const rot = body.rotation();
        const position = new THREE.Vector3(pos3.x, pos3.y, pos3.z);
        const quaternion = new THREE.Quaternion(rot.x, rot.y, rot.z, rot.w);
        
        // Just add the up-facing normal
        const topNormal = new THREE.Vector3(0, 1, 0);
        const worldNormal = topNormal.clone().applyQuaternion(quaternion);
        const localPos = new THREE.Vector3(0, height/2, 0);
        const worldPos = position.clone().add(localPos.applyQuaternion(quaternion));
        
        const arrow = new THREE.ArrowHelper(
          worldNormal,
          worldPos,
          NORMAL_ARROW_LENGTH,
          0x00FFFF, // Cyan color to distinguish platform normals
          0.2,
          0.1
        );
        scene.add(arrow);
        normalArrows.push(arrow);
      }
    }
    
    // Add this function to create cubes that are perfectly aligned to the planet surface
    function createSurfaceCubes() {
      // Distribution pattern around the planet
      const radius = PLANET_RADIUS + 0.05; // Position slightly above the surface
      const cubeSize = 1.2; // Size of the cubes
      
      // Create cubes in a spiral pattern around the planet
      const numCubes = 8;
      const colors = [0x3498db, 0xe74c3c, 0x2ecc71, 0xf39c12, 0x9b59b6];
      
      for (let i = 0; i < numCubes; i++) {
        // Create spiral pattern positions
        const phi = Math.acos(-1 + (2 * i) / numCubes);
        const theta = Math.sqrt(numCubes * Math.PI) * phi;
        
        // Convert to Cartesian coordinates
        const x = radius * Math.sin(phi) * Math.cos(theta);
        const y = radius * Math.sin(phi) * Math.sin(theta);
        const z = radius * Math.cos(phi);
        
        // Get planet position
        const planet = objects.find(obj => obj.type === 'planet');
        if (!planet) continue;
        
        const planetPos = planet.body.translation();
        const cubePos = new THREE.Vector3(x, y, z);
        
        // Direction from planet center to cube position (this is our "up" vector)
        const upDir = new THREE.Vector3().subVectors(cubePos, 
          new THREE.Vector3(planetPos.x, planetPos.y, planetPos.z)).normalize();
        
        // Create a rotation that aligns the cube with the planet surface
        const worldUp = new THREE.Vector3(0, 1, 0);
        const rotationQuat = new THREE.Quaternion().setFromUnitVectors(worldUp, upDir);
        
        // Create rigid body
        const bodyDesc = RAPIER.RigidBodyDesc.fixed();
        bodyDesc.setTranslation(x, y, z);
        bodyDesc.setRotation({
          x: rotationQuat.x,
          y: rotationQuat.y,
          z: rotationQuat.z,
          w: rotationQuat.w
        });
        
        const body = physicsWorld.createRigidBody(bodyDesc);
        
        // Create collider (slightly smaller than visual cube for better alignment)
        const collider = RAPIER.ColliderDesc.cuboid(cubeSize/2 * 0.9, cubeSize/2 * 0.9, cubeSize/2 * 0.9);
        collider.setFriction(OBJECT_FRICTION * 2); // Extra friction for stability
        physicsWorld.createCollider(collider, body);
        
        // Create visual mesh
        const geometry = new THREE.BoxGeometry(cubeSize, cubeSize, cubeSize);
        const material = new THREE.MeshStandardMaterial({ 
          color: colors[i % colors.length],
          roughness: 0.5,
          metalness: 0.2
        });
        const mesh = new THREE.Mesh(geometry, material);
        scene.add(mesh);
        
        // Add to objects array
        objects.push({
          body,
          mesh,
          isFixed: true,
          type: 'box',
          size: cubeSize,
          mass: cubeSize * 3,
          isSurfaceCube: true // Special flag to identify surface cubes
        });
      }
    }
    
    // Add this function to create dynamic objects that will be affected by gravity
    function createDynamicObjects(count) {
      const colors = [0xff5733, 0x33ff57, 0x3357ff, 0x9c27b0, 0xffc107];
      const shapes = ['sphere', 'box'];
      
      // Create dynamic objects distributed around the planet
      for (let i = 0; i < count; i++) {
        // Use spherical distribution to position objects all around the planet
        const phi = Math.acos(2 * Math.random() - 1); 
        const theta = Math.random() * Math.PI * 2;
        
        // Calculate larger distance from planet center (higher height)
        const distance = PLANET_RADIUS + 15 + Math.random() * 10; 
        
        // Convert spherical to Cartesian coordinates
        const x = distance * Math.sin(phi) * Math.cos(theta);
        const y = distance * Math.sin(phi) * Math.sin(theta);
        const z = distance * Math.cos(phi);
        
        // Random size
        const size = 0.3 + Math.random() * 0.4;
        const mass = size * 3;
        
        // Choose shape type and color
        const shapeType = shapes[Math.floor(Math.random() * shapes.length)];
        const color = colors[Math.floor(Math.random() * colors.length)];
        
        // Create a dynamic rigid body
        const bodyDesc = RAPIER.RigidBodyDesc.dynamic();
        bodyDesc.setTranslation(x, y, z);
        
        // Add random initial rotation
        const randomRotation = new THREE.Quaternion().setFromEuler(
          new THREE.Euler(
            Math.random() * Math.PI,
            Math.random() * Math.PI,
            Math.random() * Math.PI
          )
        );
        
        bodyDesc.setRotation({
          x: randomRotation.x,
          y: randomRotation.y,
          z: randomRotation.z,
          w: randomRotation.w
        });
        
        // Create the rigid body
        const body = physicsWorld.createRigidBody(bodyDesc);
        
        // Add a collider based on the shape type
        let collider, geometry;
        if (shapeType === 'box') {
          collider = RAPIER.ColliderDesc.cuboid(size/2, size/2, size/2);
          geometry = new THREE.BoxGeometry(size, size, size);
        } else {
          collider = RAPIER.ColliderDesc.ball(size/2);
          geometry = new THREE.SphereGeometry(size/2, 20, 16);
        }
        
        // Set physical properties - enable CCD for more accurate collisions
        collider.setFriction(OBJECT_FRICTION);
        collider.setRestitution(0.3); // Add some bounciness
        collider.setDensity(1.0);     // Density affects mass
        // Enable continuous collision detection for accurate high-speed collisions
        collider.setCcdEnabled(true);
        
        physicsWorld.createCollider(collider, body);
        
        // Create the visual mesh
        const material = new THREE.MeshStandardMaterial({ 
          color: color,
          roughness: 0.7,
          metalness: 0.3
        });
        const mesh = new THREE.Mesh(geometry, material);
        scene.add(mesh);
        
        const obj = {
          body,
          mesh,
          isFixed: false,
          type: shapeType,
          size: size,
          mass: mass,
          isDynamic: true
        };
        
        objects.push(obj);
        
        // Apply initial force toward the planet
        const planet = objects.find(obj => obj.type === 'planet');
        if (planet) {
          const planetPos = planet.body.translation();
          const planetPosition = new THREE.Vector3(planetPos.x, planetPos.y, planetPos.z);
          const objPosition = new THREE.Vector3(x, y, z);
          
          // Direction from object to planet
          const direction = new THREE.Vector3().subVectors(planetPosition, objPosition).normalize();
          
          // Apply an initial impulse toward the planet
          const impulseStrength = 0.3 + Math.random() * 0.2;  // Increased strength
          body.applyImpulse(
            { 
              x: direction.x * impulseStrength,
              y: direction.y * impulseStrength,
              z: direction.z * impulseStrength
            }, 
            true
          );
          
          // Add a slight tangential velocity component for potential orbiting
          const tangent = new THREE.Vector3(
            Math.random() - 0.5,
            Math.random() - 0.5,
            Math.random() - 0.5
          ).normalize();
          tangent.cross(direction);
          
          const tangentialStrength = impulseStrength * 0.4 * Math.random();
          body.applyImpulse(
            {
              x: tangent.x * tangentialStrength,
              y: tangent.y * tangentialStrength,
              z: tangent.z * tangentialStrength
            },
            true
          );
        }
      }
    }

    // Add this function to handle interactions between kinematic player and dynamic objects
    function handlePlayerPhysicsInteractions() {
      if (!player || !player.body) return;
      
      // Get the player's current velocity as a Vector3
      const playerCurrentPos = player.body.translation();
      const playerPrevPos = player.mesh.position.clone();
      const playerVelocity = new THREE.Vector3(
        playerCurrentPos.x - playerPrevPos.x,
        playerCurrentPos.y - playerPrevPos.y,
        playerCurrentPos.z - playerPrevPos.z
      );
      
      // If the player is moving with sufficient speed
      if (playerVelocity.length() > 0.01) {
        // Find all dynamic objects near the player
        for (const obj of objects) {
          if (obj.isDynamic) {
            const objPos = obj.body.translation();
            const objPosition = new THREE.Vector3(objPos.x, objPos.y, objPos.z);
            const playerPosition = new THREE.Vector3(playerCurrentPos.x, playerCurrentPos.y, playerCurrentPos.z);
            
            // Check if the object is within pushing range (adjusted by object size)
            const pushRange = PLAYER_RADIUS + obj.size/2 + 0.1; // Small buffer
            const distance = playerPosition.distanceTo(objPosition);
            
            if (distance < pushRange) {
              // Calculate push direction (from player to object)
              const pushDirection = new THREE.Vector3().subVectors(objPosition, playerPosition).normalize();
              
              // Calculate push strength based on player velocity and angle of impact
              const velMagnitude = playerVelocity.length();
              const dot = playerVelocity.clone().normalize().dot(pushDirection);
              const pushStrength = Math.max(0, dot) * velMagnitude * 2.0; // Adjust multiplier as needed
              
              // Apply impulse to the dynamic object
              if (pushStrength > 0.001) {
                obj.body.applyImpulse(
                  {
                    x: pushDirection.x * pushStrength,
                    y: pushDirection.y * pushStrength,
                    z: pushDirection.z * pushStrength
                  },
                  true
                );
              }
            }
          }
        }
      }
    }
  </script>

  <style scoped>
    :global(html), :global(body) {
      margin: 0;
      padding: 0;
      width: 100%;
      height: 100vh;
      overflow: hidden;
    }
    
    canvas {
      display: block;
      width: 100%;
      height: 100vh;
    }
  </style>
