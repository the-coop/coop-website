import * as THREE from 'three';
import { PLAYER_CONFIG, parsePlayerState } from './players';

export class SceneManager {
  constructor() {
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.planet = null;
    this.platform = null;
    this.movingPlatform = null;
    this.player = null;
    this.otherPlayerMeshes = {};
    this.dynamicObjects = {}; // Add this
    this.physicsManager = null;
    
    // Debug visualization objects
    this.leftRayLine = null;
    this.rightRayLine = null;
    this.centerRayLine = null;
    this.facingLine = null;
    
    this.clock = new THREE.Clock();
    this.animationFrameId = null;
  }

  setupScene(gameCanvas) {
    try {
      console.log("Setting up scene...");
      
      // Create Three.js scene
      this.scene = new THREE.Scene();
      this.scene.background = new THREE.Color(0x111122);
      this.scene.fog = new THREE.Fog(0x111122, 100, 300);
      
      // Create camera
      this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
      this.camera.position.set(0, 1.8, 0);
      
      // Create renderer
      this.renderer = new THREE.WebGLRenderer({ antialias: true });
      this.renderer.setSize(window.innerWidth, window.innerHeight);
      this.renderer.setPixelRatio(window.devicePixelRatio);
      this.renderer.shadowMap.enabled = true;
      this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      
      // Add to DOM
      if (gameCanvas) {
        gameCanvas.appendChild(this.renderer.domElement);
      } else {
        throw new Error("Game canvas element not found");
      }
      
      // Add lights
      const ambientLight = new THREE.AmbientLight(0x444444, 0.4);
      this.scene.add(ambientLight);
      
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
      this.scene.add(directionalLight);
      
      console.log("Scene setup complete!");
      return true;
    } catch (e) {
      console.error("Error in setupScene:", e);
      throw e;
    }
  }

  createRayVisualizations() {
    if (!this.scene || !this.player) {
      console.error("Scene or player not initialized");
      return;
    }
    
    try {
      const rayMaterial = new THREE.LineBasicMaterial({ 
        color: 0x00ff00,
        opacity: 0.5,
        transparent: true
      });
      
      const facingMaterial = new THREE.LineBasicMaterial({ 
        color: 0xff0000,
        opacity: 0.8,
        transparent: true,
        linewidth: 3
      });
      
      const createRayLine = (material = rayMaterial) => {
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(6);
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setDrawRange(0, 2);
        return new THREE.Line(geometry, material.clone());
      };
      
      this.leftRayLine = createRayLine();
      this.rightRayLine = createRayLine();
      this.centerRayLine = createRayLine();
      this.facingLine = createRayLine(facingMaterial);
      
      this.player.add(this.leftRayLine);
      this.player.add(this.rightRayLine);
      this.player.add(this.centerRayLine);
      this.player.add(this.facingLine);
      
      console.log("Ray visualizations created and attached to player");
    } catch (e) {
      console.error("Error creating ray visualizations:", e);
    }
  }

  updateRayVisualizations(leftFoot, rightFoot, centerFoot, rayDirection, rayLength, leftFootHit, rightFootHit, centerFootHit) {
    if (!this.leftRayLine || !this.rightRayLine || !this.centerRayLine || !this.facingLine || !this.player) return;
    
    try {
      const worldToLocal = this.player.worldToLocal.bind(this.player);
      
      const leftFootLocal = worldToLocal(leftFoot.clone());
      const rightFootLocal = worldToLocal(rightFoot.clone());
      const centerFootLocal = worldToLocal(centerFoot.clone());
      
      const leftEndWorld = leftFoot.clone().add(rayDirection.clone().multiplyScalar(rayLength));
      const rightEndWorld = rightFoot.clone().add(rayDirection.clone().multiplyScalar(rayLength));
      const centerEndWorld = centerFoot.clone().add(rayDirection.clone().multiplyScalar(rayLength));
      
      const leftEndLocal = worldToLocal(leftEndWorld);
      const rightEndLocal = worldToLocal(rightEndWorld);
      const centerEndLocal = worldToLocal(centerEndWorld);
      
      const updateRayGeometry = (rayLine, startLocal, endLocal) => {
        const positions = rayLine.geometry.attributes.position.array;
        positions[0] = startLocal.x;
        positions[1] = startLocal.y;
        positions[2] = startLocal.z;
        positions[3] = endLocal.x;
        positions[4] = endLocal.y;
        positions[5] = endLocal.z;
        rayLine.geometry.attributes.position.needsUpdate = true;
      };
      
      updateRayGeometry(this.leftRayLine, leftFootLocal, leftEndLocal);
      updateRayGeometry(this.rightRayLine, rightFootLocal, rightEndLocal);
      updateRayGeometry(this.centerRayLine, centerFootLocal, centerEndLocal);
      
      const playerCenter = new THREE.Vector3(0, 0, 0);
      const facingEndLocal = new THREE.Vector3(0, 0, -3);
      updateRayGeometry(this.facingLine, playerCenter, facingEndLocal);
      
      this.leftRayLine.material.color.setHex(leftFootHit ? 0xff0000 : 0x00ff00);
      this.rightRayLine.material.color.setHex(rightFootHit ? 0xff0000 : 0x00ff00);
      this.centerRayLine.material.color.setHex(centerFootHit ? 0xff0000 : 0x00ff00);
    } catch (e) {
      console.error("Error updating ray visualizations:", e);
    }
  }

  onResize() {
    if (!this.camera || !this.renderer) return;
    
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  render() {
    if (this.renderer && this.scene && this.camera) {
      this.renderer.render(this.scene, this.camera);
    }
  }

  async initializeGame(physicsManager, gameCanvas) {
    try {
      // Store physics manager reference
      this.physicsManager = physicsManager;
      
      // Initialize physics
      await physicsManager.initialize();
      
      // Initialize scene
      this.setupScene(gameCanvas);
      
      // Create game world (static geometry only)
      const planet = physicsManager.createPlanet(this.scene);
      this.planet = planet;
      
      const platformData = physicsManager.createPlatform(this.scene);
      if (platformData) {
        this.platform = platformData.platform;
        this.movingPlatform = platformData.movingPlatform;
        platformData.movingPlatform.userData.physicsBody = platformData.movingPlatformBody;
      }
      
      // Don't create rocks here - they'll come from server
      
      return true;
    } catch (e) {
      console.error("Error initializing game:", e);
      throw e;
    }
  }

  startAnimationLoop(physicsManager, fpsController, onFrame) {
    const animate = () => {
      this.animationFrameId = requestAnimationFrame(animate);
      
      const deltaTime = Math.min(this.clock.getDelta(), 0.1);
      
      if (onFrame) {
        onFrame(deltaTime);
      }
      
      this.render();
    };
    
    animate();
  }

  stopAnimationLoop() {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  cleanup() {
    this.stopAnimationLoop();
    if (this.renderer) {
      this.renderer.dispose();
    }
  }
  
  updateOtherPlayer(playerId, playerData, worldOriginOffset) {
    if (!this.scene || !playerData) return;
    
    const parsedData = parsePlayerState(playerData);
    
    // CRITICAL: Server sends world positions, but we need to account for the CLIENT's world origin
    // The worldOriginOffset passed in is the LOCAL player's world origin
    const serverWorldPos = new THREE.Vector3(...parsedData.position);
    const serverWorldOrigin = new THREE.Vector3(...parsedData.worldOrigin);
    
    // Convert server's world position to our local coordinate system
    // Server world pos = server local pos + server world origin
    // We want: our local pos = server world pos - our world origin
    const localPosition = serverWorldPos.clone().sub(worldOriginOffset);
    
    const velocity = new THREE.Vector3(...parsedData.velocity);
    const rotation = new THREE.Quaternion(...parsedData.rotation);
    
    // Log position updates to debug movement
    const isMoving = velocity.length() > 0.1;
    if (isMoving || !this.otherPlayerMeshes[playerId]) {
      console.log(`UPDATE Player ${playerId}: world pos [${serverWorldPos.x.toFixed(1)}, ${serverWorldPos.y.toFixed(1)}, ${serverWorldPos.z.toFixed(1)}], vel [${velocity.x.toFixed(1)}, ${velocity.y.toFixed(1)}, ${velocity.z.toFixed(1)}], local pos [${localPosition.x.toFixed(1)}, ${localPosition.y.toFixed(1)}, ${localPosition.z.toFixed(1)}]`);
    }
    
    if (!this.otherPlayerMeshes[playerId]) {
      // Create new player mesh
      const playerGeometry = new THREE.CapsuleGeometry(
        PLAYER_CONFIG.RADIUS,
        PLAYER_CONFIG.HEIGHT - 2 * PLAYER_CONFIG.RADIUS,
        8,
        16
      );
      
      const playerMaterial = new THREE.MeshStandardMaterial({
        color: 0x4444ff,
        roughness: 0.7,
        metalness: 0.3
      });
      
      const playerMesh = new THREE.Mesh(playerGeometry, playerMaterial);
      playerMesh.castShadow = true;
      playerMesh.receiveShadow = true;
      
      // Set initial position from server data
      playerMesh.position.copy(localPosition);
      playerMesh.quaternion.copy(rotation);
      
      this.scene.add(playerMesh);
      
      // Create physics body at the correct LOCAL position
      if (this.physicsManager) {
        const playerBody = this.physicsManager.createOtherPlayerBody(
          localPosition.x,
          localPosition.y,
          localPosition.z,
          PLAYER_CONFIG.HEIGHT,
          PLAYER_CONFIG.RADIUS
        );
        
        playerMesh.userData.physicsBody = playerBody;
        playerMesh.userData.playerId = playerId;
      }
      
      // Initialize interpolation system
      playerMesh.userData.interpolation = {
        startPosition: localPosition.clone(),
        targetPosition: localPosition.clone(),
        startRotation: rotation.clone(),
        targetRotation: rotation.clone(),
        startTime: Date.now(),
        duration: 100,
        lastServerUpdate: Date.now()
      };
      
      this.otherPlayerMeshes[playerId] = playerMesh;
      
      console.log('Created other player:', playerId, 'at local position:', localPosition);
    }
    
    const playerMesh = this.otherPlayerMeshes[playerId];
    
    // IMPORTANT: Update physics body IMMEDIATELY with server state
    if (playerMesh.userData.physicsBody) {
      const body = playerMesh.userData.physicsBody;
      
      // Set position and velocity from server
      body.setTranslation({
        x: localPosition.x,
        y: localPosition.y,
        z: localPosition.z
      });
      
      body.setLinvel({
        x: velocity.x,
        y: velocity.y,
        z: velocity.z
      });
      
      body.setRotation(rotation);
      
      // Also update mesh position immediately for visual sync
      playerMesh.position.copy(localPosition);
      playerMesh.quaternion.copy(rotation);
    }
    
    // Store server data for reference
    playerMesh.userData.serverPosition = localPosition.clone();
    playerMesh.userData.serverVelocity = velocity.clone();
    playerMesh.userData.serverRotation = rotation.clone();
    playerMesh.userData.serverGrounded = parsedData.isGrounded;
    playerMesh.userData.serverWorldOrigin = serverWorldOrigin.clone();
    playerMesh.userData.lastServerUpdate = Date.now();
  }

  updateOtherPlayersInterpolation() {
    const now = Date.now();
    
    Object.entries(this.otherPlayerMeshes).forEach(([playerId, mesh]) => {
      if (!mesh.userData.physicsBody) return;
      
      const body = mesh.userData.physicsBody;
      const timeSinceUpdate = now - (mesh.userData.lastServerUpdate || 0);
      
      // Let physics simulation run between server updates
      // Only sync visual mesh with physics body position
      const position = body.translation();
      mesh.position.set(position.x, position.y, position.z);
      
      const rotation = body.rotation();
      mesh.quaternion.set(rotation.x, rotation.y, rotation.z, rotation.w);
      
      // If it's been too long since server update, the player might have disconnected
      if (timeSinceUpdate > 5000) {
        console.log(`Player ${playerId} hasn't updated in ${timeSinceUpdate}ms, may be disconnected`);
      }
    });
  }

  onResize() {
    if (!this.camera || !this.renderer) return;
    
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  render() {
    if (this.renderer && this.scene && this.camera) {
      this.renderer.render(this.scene, this.camera);
    }
  }

  async initializeGame(physicsManager, gameCanvas) {
    try {
      // Store physics manager reference
      this.physicsManager = physicsManager;
      
      // Initialize physics
      await physicsManager.initialize();
      
      // Initialize scene
      this.setupScene(gameCanvas);
      
      // Create game world (static geometry only)
      const planet = physicsManager.createPlanet(this.scene);
      this.planet = planet;
      
      const platformData = physicsManager.createPlatform(this.scene);
      if (platformData) {
        this.platform = platformData.platform;
        this.movingPlatform = platformData.movingPlatform;
        platformData.movingPlatform.userData.physicsBody = platformData.movingPlatformBody;
      }
      
      // Don't create rocks here - they'll come from server
      
      return true;
    } catch (e) {
      console.error("Error initializing game:", e);
      throw e;
    }
  }

  startAnimationLoop(physicsManager, fpsController, onFrame) {
    const animate = () => {
      this.animationFrameId = requestAnimationFrame(animate);
      
      const deltaTime = Math.min(this.clock.getDelta(), 0.1);
      
      if (onFrame) {
        onFrame(deltaTime);
      }
      
      this.render();
    };
    
    animate();
  }

  stopAnimationLoop() {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  cleanup() {
    this.stopAnimationLoop();
    if (this.renderer) {
      this.renderer.dispose();
    }
  }
  
  updateDynamicObjects(movingPlatformBody) {
    if (!this.scene) return;
    
    // Update moving platform
    if (this.movingPlatform && movingPlatformBody) {
      const time = performance.now() * 0.001;
      const userData = this.movingPlatform.userData;
      
      const offset = Math.sin(time * userData.moveSpeed) * userData.moveRange;
      const newX = userData.initialX + offset;
      
      this.movingPlatform.position.x = newX;
      
      movingPlatformBody.setNextKinematicTranslation({
        x: newX,
        y: this.movingPlatform.position.y,
        z: this.movingPlatform.position.z
      });
    }
    
    // Update other players interpolation - THIS IS CRITICAL FOR MOVEMENT DISPLAY
    this.updateOtherPlayersInterpolation();
    
    // Update dynamic objects interpolation
    this.updateDynamicObjectsInterpolation();
    
    // Update other physics bodies (excluding server-controlled players and objects)
    this.scene.traverse((child) => {
      if (child.isMesh && child.userData.physicsBody && 
          !child.userData.playerId && !child.userData.objectId) {
        const body = child.userData.physicsBody;
        
        const position = body.translation();
        child.position.set(position.x, position.y, position.z);
        
        const rotation = body.rotation();
        child.quaternion.set(rotation.x, rotation.y, rotation.z, rotation.w);
      }
    });
  }
  
  removeOtherPlayer(playerId) {
    const playerMesh = this.otherPlayerMeshes[playerId];
    if (playerMesh) {
      console.log('Removing other player:', playerId);
      
      // Remove physics body
      if (playerMesh.userData.physicsBody && this.physicsManager) {
        const body = playerMesh.userData.physicsBody;
        this.physicsManager.world.removeRigidBody(body);
        console.log('Removed physics body for player:', playerId);
      }
      
      // Remove from scene
      this.scene.remove(playerMesh);
      
      // Clean up geometry and materials
      if (playerMesh.geometry) {
        playerMesh.geometry.dispose();
      }
      if (playerMesh.material) {
        if (Array.isArray(playerMesh.material)) {
          playerMesh.material.forEach(material => material.dispose());
        } else {
          playerMesh.material.dispose();
        }
      }
      
      // Remove from tracking
      delete this.otherPlayerMeshes[playerId];
      
      console.log('Successfully removed other player:', playerId);
    } else {
      console.warn('Attempted to remove non-existent player:', playerId);
    }
  }

  updateDynamicObjectsInterpolation() {
    const now = Date.now();
    
    Object.entries(this.dynamicObjects).forEach(([objectId, mesh]) => {
      const interp = mesh.userData.interpolation;
      if (!interp) return;
      
      const elapsed = now - interp.startTime;
      const t = Math.min(elapsed / interp.duration, 1);
      
      // Smooth interpolation
      const smoothT = t * t * (3 - 2 * t);
      
      // Update visual position
      mesh.position.lerpVectors(interp.startPos, interp.targetPos, smoothT);
      mesh.quaternion.slerpQuaternions(interp.startRot, interp.targetRot, smoothT);
      
      // Keep physics body in sync
      if (mesh.userData.physicsBody) {
        const body = mesh.userData.physicsBody;
        body.setTranslation({
          x: mesh.position.x,
          y: mesh.position.y,
          z: mesh.position.z
        });
        body.setRotation({
          x: mesh.quaternion.x,
          y: mesh.quaternion.y,
          z: mesh.quaternion.z,
          w: mesh.quaternion.w
        });
      }
    });
  }

  createOrUpdateDynamicObject(objectId, objectData, worldOriginOffset) {
    if (!this.scene || !objectData) return;
    
    const worldPosition = new THREE.Vector3(...objectData.position);
    const localPosition = worldPosition.clone().sub(worldOriginOffset);
    const velocity = new THREE.Vector3(...objectData.velocity);
    const rotation = new THREE.Quaternion(...objectData.rotation);
    
    if (!this.dynamicObjects[objectId]) {
      // Create new dynamic object
      let geometry;
      let material;
      
      if (objectData.objectType === 'rock') {
        geometry = new THREE.DodecahedronGeometry(2 * objectData.scale, 0);
        material = new THREE.MeshStandardMaterial({
          color: 0x666666,
          roughness: 1,
          metalness: 0
        });
      } else {
        // Default to sphere
        geometry = new THREE.SphereGeometry(objectData.scale);
        material = new THREE.MeshStandardMaterial({
          color: 0x888888
        });
      }
      
      const mesh = new THREE.Mesh(geometry, material);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.scene.add(mesh);
      
      // Create physics body for the object
      if (this.physicsManager) {
        const body = this.physicsManager.createDynamicObjectBody(
          localPosition.x,
          localPosition.y,
          localPosition.z,
          objectData.scale,
          objectData.objectType
        );
        
        mesh.userData.physicsBody = body;
        mesh.userData.objectId = objectId;
      }
      
      this.dynamicObjects[objectId] = mesh;
      
      // Initialize interpolation data
      mesh.userData.interpolation = {
        startPos: localPosition.clone(),
        targetPos: localPosition.clone(),
        startRot: rotation.clone(),
        targetRot: rotation.clone(),
        startTime: Date.now(),
        duration: 100
      };
      
      console.log('Created dynamic object:', objectId, objectData.objectType);
    }
    
    const mesh = this.dynamicObjects[objectId];
    
    // Update physics body with server state
    if (mesh.userData.physicsBody && this.physicsManager) {
      const body = mesh.userData.physicsBody;
      
      // Set authoritative server state
      body.setTranslation({
        x: localPosition.x,
        y: localPosition.y,
        z: localPosition.z
      });
      
      body.setLinvel({
        x: velocity.x,
        y: velocity.y,
        z: velocity.z
      });
      
      body.setRotation(rotation);
    }
    
    // Update interpolation targets
    const interp = mesh.userData.interpolation;
    interp.startPos.copy(mesh.position);
    interp.targetPos.copy(localPosition);
    interp.startRot.copy(mesh.quaternion);
    interp.targetRot.copy(rotation);
    interp.startTime = Date.now();
  }

  removeDynamicObject(objectId) {
    const mesh = this.dynamicObjects[objectId];
    if (mesh) {
      // Remove physics body
      if (mesh.userData.physicsBody && this.physicsManager) {
        const body = mesh.userData.physicsBody;
        this.physicsManager.world.removeRigidBody(body);
      }
      
      this.scene.remove(mesh);
      if (mesh.geometry) mesh.geometry.dispose();
      if (mesh.material) mesh.material.dispose();
      delete this.dynamicObjects[objectId];
      
      console.log('Removed dynamic object:', objectId);
    }
  }
}
