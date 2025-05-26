import * as THREE from 'three';

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
    
    // Debug visualization objects
    this.leftRayLine = null;
    this.rightRayLine = null;
    this.centerRayLine = null;
    this.facingLine = null;
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

  updateOtherPlayer(id, playerData, worldOriginOffset) {
    if (!this.scene) return;
    
    let mesh = this.otherPlayerMeshes[id];
    
    if (!mesh) {
      const geometry = new THREE.CapsuleGeometry(0.4, 1.0, 8, 8);
      const material = new THREE.MeshStandardMaterial({
        color: 0x00ff00,
        transparent: true,
        opacity: 0.7
      });
      
      mesh = new THREE.Mesh(geometry, material);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.scene.add(mesh);
      this.otherPlayerMeshes[id] = mesh;
      
      mesh.userData.interpolation = {
        fromPos: new THREE.Vector3(),
        toPos: new THREE.Vector3(),
        fromRot: new THREE.Quaternion(),
        toRot: new THREE.Quaternion(),
        startTime: Date.now(),
        duration: 100
      };
      
      console.log('Created mesh for player:', id);
    }
    
    const worldPos = new THREE.Vector3(
      playerData.position[0],
      playerData.position[1],
      playerData.position[2]
    );
    
    const relativePos = worldPos.clone().sub(worldOriginOffset);
    
    const interp = mesh.userData.interpolation;
    interp.fromPos.copy(mesh.position);
    interp.fromRot.copy(mesh.quaternion);
    interp.toPos.copy(relativePos);
    interp.toRot.set(
      playerData.rotation[0],
      playerData.rotation[1],
      playerData.rotation[2],
      playerData.rotation[3]
    );
    interp.startTime = Date.now();
  }

  updateOtherPlayersInterpolation() {
    const now = Date.now();
    
    Object.values(this.otherPlayerMeshes).forEach(mesh => {
      if (!mesh.userData.interpolation) return;
      
      const interp = mesh.userData.interpolation;
      const elapsed = now - interp.startTime;
      const t = Math.min(elapsed / interp.duration, 1.0);
      const easedT = t * t * (3.0 - 2.0 * t);
      
      mesh.position.lerpVectors(interp.fromPos, interp.toPos, easedT);
      mesh.quaternion.slerpQuaternions(interp.fromRot, interp.toRot, easedT);
    });
  }

  removeOtherPlayer(id) {
    const mesh = this.otherPlayerMeshes[id];
    if (mesh) {
      this.scene.remove(mesh);
      delete this.otherPlayerMeshes[id];
    }
  }

  updateDynamicObjects(movingPlatformBody) {
    if (!this.scene) return;
    
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
}
