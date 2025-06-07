import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { VehicleHelpers } from '../engine/vehicles.js';

export class SpaceshipController {
  constructor(scene, physics, position) {
    this.scene = scene;
    this.physics = physics;
    
    // State
    this.isOccupied = false;
    this.currentPlayer = null;
    this.wasInteracting = false;
    
    // Physics
    this.body = null;
    this.colliders = []; // Initialize colliders array
    
    // Visual components
    this.mesh = null;
    this.interiorMesh = null;
    
    // Movement properties
    this.thrustPower = 50;
    this.rotationSpeed = 1.0;
    this.maxSpeed = 100;
    
    // Input state - add missing keys property
    this.keys = {
      forward: false,
      backward: false,
      left: false,
      right: false,
      up: false,
      down: false,
      rollLeft: false,
      rollRight: false
    };
    
    // Auto-pilot properties
    this.autoPilotActive = false;
    this.autoPilotTimer = 0;
    this.autoPilotDelay = 5000; // 5 seconds in milliseconds
    this.autoPilotTarget = new THREE.Vector3();
    this.autoPilotTargetTimer = 0;
    
    // Light references
    this.lights = {
      entrance: null,
      windows: [],
      dome: null,
      interior: [],
      engines: []
    };
    
    // Interior dimensions
    this.interiorSize = {
      width: 8,    // Interior width
      height: 4.5, // Interior height
      depth: 12    // Interior depth
    };
    
    // Control panel
    this.controlPanel = null;
    this.controlPanelLight = null;
    
    // Create spaceship
    this.create(position);
  }
  
  create(position) {
    // Create main spaceship group
    this.mesh = new THREE.Group();
    
    // Create hull material
    const hullMaterial = new THREE.MeshStandardMaterial({
      color: 0x4444ff,
      metalness: 0.8,
      roughness: 0.2
    });
    
    // Create window material
    const windowMaterial = new THREE.MeshStandardMaterial({
      color: 0x88ccff,
      transparent: true,
      opacity: 0.3,
      metalness: 0.9,
      roughness: 0.1,
      side: THREE.DoubleSide
    });
    
    const entranceWidth = 3;  // Wider entrance
    const entranceHeight = 4; // Taller entrance
    
    // Create hull pieces with window gaps
    
    // Bottom hull (floor)
    const floorGeometry = new THREE.BoxGeometry(10, 0.5, 15);
    const floor = new THREE.Mesh(floorGeometry, hullMaterial);
    floor.position.set(0, -2.25, 0);
    floor.castShadow = true;
    floor.receiveShadow = true;
    this.mesh.add(floor);
    
    // Top hull (roof) with skylight gaps
    // Front roof section
    const roofFrontGeometry = new THREE.BoxGeometry(10, 0.5, 4);
    const roofFront = new THREE.Mesh(roofFrontGeometry, hullMaterial);
    roofFront.position.set(0, 2.25, 5.5);
    roofFront.castShadow = true;
    this.mesh.add(roofFront);
    
    // Back roof section
    const roofBackGeometry = new THREE.BoxGeometry(10, 0.5, 4);
    const roofBack = new THREE.Mesh(roofBackGeometry, hullMaterial);
    roofBack.position.set(0, 2.25, -5.5);
    roofBack.castShadow = true;
    this.mesh.add(roofBack);
    
    // Middle roof sections (leaving gap for skylight)
    const roofMiddleLeftGeometry = new THREE.BoxGeometry(3, 0.5, 7);
    const roofMiddleLeft = new THREE.Mesh(roofMiddleLeftGeometry, hullMaterial);
    roofMiddleLeft.position.set(-3.5, 2.25, 0);
    roofMiddleLeft.castShadow = true;
    this.mesh.add(roofMiddleLeft);
    
    const roofMiddleRightGeometry = new THREE.BoxGeometry(3, 0.5, 7);
    const roofMiddleRight = new THREE.Mesh(roofMiddleRightGeometry, hullMaterial);
    roofMiddleRight.position.set(3.5, 2.25, 0);
    roofMiddleRight.castShadow = true;
    this.mesh.add(roofMiddleRight);
    
    // Left wall with window gaps and entrance
    // Left wall upper section (above entrance)
    const leftWallUpperGeometry = new THREE.BoxGeometry(0.5, 1, 15);
    const leftWallUpper = new THREE.Mesh(leftWallUpperGeometry, hullMaterial);
    leftWallUpper.position.set(-4.75, 1.5, 0);
    leftWallUpper.castShadow = true;
    this.mesh.add(leftWallUpper);
    
    // Left wall sections around entrance
    const leftWallFrontGeometry = new THREE.BoxGeometry(0.5, 3, 5);
    const leftWallFront = new THREE.Mesh(leftWallFrontGeometry, hullMaterial);
    leftWallFront.position.set(-4.75, -0.5, 5);
    leftWallFront.castShadow = true;
    this.mesh.add(leftWallFront);
    
    const leftWallBackGeometry = new THREE.BoxGeometry(0.5, 3, 5);
    const leftWallBack = new THREE.Mesh(leftWallBackGeometry, hullMaterial);
    leftWallBack.position.set(-4.75, -0.5, -5);
    leftWallBack.castShadow = true;
    this.mesh.add(leftWallBack);
    
    // Right wall with window gaps
    // Right wall sections (with gaps for windows)
    const rightWallFrontGeometry = new THREE.BoxGeometry(0.5, 4.5, 4);
    const rightWallFront = new THREE.Mesh(rightWallFrontGeometry, hullMaterial);
    rightWallFront.position.set(4.75, 0, 5.5);
    rightWallFront.castShadow = true;
    this.mesh.add(rightWallFront);
    
    const rightWallMiddleGeometry = new THREE.BoxGeometry(0.5, 4.5, 2);
    const rightWallMiddle = new THREE.Mesh(rightWallMiddleGeometry, hullMaterial);
    rightWallMiddle.position.set(4.75, 0, 0);
    rightWallMiddle.castShadow = true;
    this.mesh.add(rightWallMiddle);
    
    const rightWallBackGeometry = new THREE.BoxGeometry(0.5, 4.5, 4);
    const rightWallBack = new THREE.Mesh(rightWallBackGeometry, hullMaterial);
    rightWallBack.position.set(4.75, 0, -5.5);
    rightWallBack.castShadow = true;
    this.mesh.add(rightWallBack);
    
    // Front wall with cockpit window gap
    // Front wall sections around cockpit window
    const frontWallLeftGeometry = new THREE.BoxGeometry(2, 4.5, 0.5);
    const frontWallLeft = new THREE.Mesh(frontWallLeftGeometry, hullMaterial);
    frontWallLeft.position.set(-4, 0, 7.25);
    frontWallLeft.castShadow = true;
    this.mesh.add(frontWallLeft);
    
    const frontWallRightGeometry = new THREE.BoxGeometry(2, 4.5, 0.5);
    const frontWallRight = new THREE.Mesh(frontWallRightGeometry, hullMaterial);
    frontWallRight.position.set(4, 0, 7.25);
    frontWallRight.castShadow = true;
    this.mesh.add(frontWallRight);
    
    const frontWallTopGeometry = new THREE.BoxGeometry(4, 1, 0.5);
    const frontWallTop = new THREE.Mesh(frontWallTopGeometry, hullMaterial);
    frontWallTop.position.set(0, 1.75, 7.25);
    frontWallTop.castShadow = true;
    this.mesh.add(frontWallTop);
    
    const frontWallBottomGeometry = new THREE.BoxGeometry(4, 1.5, 0.5);
    const frontWallBottom = new THREE.Mesh(frontWallBottomGeometry, hullMaterial);
    frontWallBottom.position.set(0, -1.5, 7.25);
    frontWallBottom.castShadow = true;
    this.mesh.add(frontWallBottom);
    
    // Back wall
    const backWallGeometry = new THREE.BoxGeometry(10, 4.5, 0.5);
    const backWall = new THREE.Mesh(backWallGeometry, hullMaterial);
    backWall.position.set(0, 0, -7.25);
    backWall.castShadow = true;
    backWall.receiveShadow = true;
    this.mesh.add(backWall);
    
    // Now add windows in the gaps
    
    // Cockpit window (in front wall gap)
    const cockpitWindowGeometry = new THREE.BoxGeometry(4, 2, 0.1);
    const cockpitWindow = new THREE.Mesh(cockpitWindowGeometry, windowMaterial);
    cockpitWindow.position.set(0, 0.5, 7.25);
    this.mesh.add(cockpitWindow);
    
    // Right side windows (in gaps)
    const sideWindowGeometry = new THREE.BoxGeometry(0.1, 2, 2.5);
    
    const rightWindow1 = new THREE.Mesh(sideWindowGeometry, windowMaterial);
    rightWindow1.position.set(4.75, 0, 3);
    this.mesh.add(rightWindow1);
    
    const rightWindow2 = new THREE.Mesh(sideWindowGeometry, windowMaterial);
    rightWindow2.position.set(4.75, 0, -3);
    this.mesh.add(rightWindow2);
    
    // Central skylight (in roof gap)
    const skylightGeometry = new THREE.BoxGeometry(4, 0.1, 7);
    const skylight = new THREE.Mesh(skylightGeometry, windowMaterial);
    skylight.position.set(0, 2.25, 0);
    this.mesh.add(skylight);
    
    // Create interior space
    this.createInterior();
    
    // Create entrance ramp
    const rampGeometry = new THREE.BoxGeometry(entranceWidth, 0.3, 4);
    const rampMaterial = new THREE.MeshStandardMaterial({
      color: 0x666666,
      metalness: 0.5,
      roughness: 0.8
    });
    const ramp = new THREE.Mesh(rampGeometry, rampMaterial);
    ramp.position.set(-3.5, -2.2, -2);
    ramp.rotation.z = -0.2; // Slight angle
    this.mesh.add(ramp);
    
    // Add glowing entrance frame
    const frameGeometry = new THREE.BoxGeometry(entranceWidth + 0.2, entranceHeight + 0.2, 0.2);
    const frameMaterial = new THREE.MeshStandardMaterial({
      color: 0xffff00,
      emissive: 0xffff00,
      emissiveIntensity: 0.2,
      metalness: 0.8,
      roughness: 0.2
    });
    const doorFrame = new THREE.Mesh(frameGeometry, frameMaterial);
    doorFrame.position.set(-4.75, 0, 0);
    doorFrame.rotation.y = Math.PI / 2;
    this.mesh.add(doorFrame);
    
    // Add "ENTER" text sprite above door
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 64;
    const context = canvas.getContext('2d');
    context.fillStyle = '#00ff00';
    context.font = 'bold 48px Arial';
    context.textAlign = 'center';
    context.fillText('ENTER', 128, 48);
    
    const texture = new THREE.CanvasTexture(canvas);
    const spriteMaterial = new THREE.SpriteMaterial({ 
      map: texture,
      transparent: true,
      opacity: 0.8
    });
    const sprite = new THREE.Sprite(spriteMaterial);
    sprite.scale.set(2, 0.5, 1);
    sprite.position.set(-4.75, 3, 0);
    this.mesh.add(sprite);
    
    // Create engines
    this.createEngines();
    
    // Add interior lights
    this.createInteriorLights();
    
    // Add exterior light at entrance
    const entranceLight = new THREE.PointLight(0x00ff00, 2, 8);
    entranceLight.position.set(-4.75, 0, 0);
    this.mesh.add(entranceLight);
    this.lights.entrance = entranceLight;
    
    // Add window glow lights
    const windowLight1 = new THREE.PointLight(0x88ccff, 0.5, 3);
    windowLight1.position.set(4, 0.5, 0);
    this.mesh.add(windowLight1);
    this.lights.windows.push(windowLight1);
    
    const windowLight2 = new THREE.PointLight(0x88ccff, 0.8, 5);
    windowLight2.position.set(0, 1, 0);
    this.mesh.add(windowLight2);
    this.lights.windows.push(windowLight2);
    
    // Store dome light reference
    const domeLight = new THREE.PointLight(0xaaccff, 0.8, 5);
    domeLight.position.set(0, 3, -5);
    this.mesh.add(domeLight);
    this.lights.dome = domeLight;
    
    // Position spaceship BEFORE creating physics
    this.mesh.position.copy(position);
    
    // Add the mesh to scene BEFORE creating physics
    this.scene.scene.add(this.mesh);
    
    // Create physics at the same position
    this.createPhysicsBody(position);
    
    // Create interior colliders for player interaction
    this.createInteriorColliders();
    
    console.log('Spaceship created at position:', position);
    console.log('Mesh position:', this.mesh.position);
    console.log('Physics body position:', this.body ? this.body.translation() : 'no body');
  }

  createInterior() {
    // Create interior group
    this.interiorMesh = new THREE.Group();
    
    // Interior floor
    const floorGeometry = new THREE.BoxGeometry(8, 0.2, 12);
    const floorMaterial = new THREE.MeshStandardMaterial({
      color: 0x444444,
      metalness: 0.3,
      roughness: 0.7
    });
    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.position.y = -2.4;
    floor.receiveShadow = true;
    this.interiorMesh.add(floor);
    
    // Control panels
    const panelGeometry = new THREE.BoxGeometry(2, 1, 0.3);
    const panelMaterial = new THREE.MeshStandardMaterial({
      color: 0x333366,
      metalness: 0.6,
      roughness: 0.4,
      emissive: 0x111144,
      emissiveIntensity: 0.2
    });
    
    // Front control panel
    const frontPanel = new THREE.Mesh(panelGeometry, panelMaterial);
    frontPanel.position.set(0, -1, 6);
    this.interiorMesh.add(frontPanel);
    
    // Side panels
    const leftPanel = new THREE.Mesh(panelGeometry, panelMaterial);
    leftPanel.position.set(-3, -1, 0);
    leftPanel.rotation.y = Math.PI / 2;
    this.interiorMesh.add(leftPanel);
    
    const rightPanel = new THREE.Mesh(panelGeometry, panelMaterial);
    rightPanel.position.set(3, -1, 0);
    rightPanel.rotation.y = -Math.PI / 2;
    this.interiorMesh.add(rightPanel);
    
    // Seats
    const seatGeometry = new THREE.BoxGeometry(1, 0.5, 1);
    const seatMaterial = new THREE.MeshStandardMaterial({
      color: 0x666633,
      metalness: 0.2,
      roughness: 0.8
    });
    
    const pilotSeat = new THREE.Mesh(seatGeometry, seatMaterial);
    pilotSeat.position.set(0, -2, 4);
    this.interiorMesh.add(pilotSeat);
    
    const copilotSeat = new THREE.Mesh(seatGeometry, seatMaterial);
    copilotSeat.position.set(0, -2, 2);
    this.interiorMesh.add(copilotSeat);
    
    // Create main control panel (visual only now)
    const controlPanelGeometry = new THREE.BoxGeometry(1.5, 1, 0.2);
    const controlPanelMaterial = new THREE.MeshStandardMaterial({
      color: 0x333366,
      metalness: 0.6,
      roughness: 0.4,
      emissive: 0x111144,
      emissiveIntensity: 0.2
    });
    
    this.controlPanel = new THREE.Mesh(controlPanelGeometry, controlPanelMaterial);
    this.controlPanel.position.set(0, 0, 5.5); // Front center of interior
    this.controlPanel.name = 'controlPanel';
    this.interiorMesh.add(this.controlPanel);
    
    // Add activation light on control panel
    const lightGeometry = new THREE.SphereGeometry(0.1, 8, 8);
    const lightMaterial = new THREE.MeshStandardMaterial({
      color: 0xff0000,
      emissive: 0xff0000,
      emissiveIntensity: 0.5
    });
    this.controlPanelLight = new THREE.Mesh(lightGeometry, lightMaterial);
    this.controlPanelLight.position.set(0, 0.3, 0.11);
    this.controlPanel.add(this.controlPanelLight);
    
    // Add "PRESS I TO ACTIVATE" text above spaceship (changed from U)
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 128;
    const context = canvas.getContext('2d');
    context.fillStyle = '#00ff00';
    context.font = 'bold 32px Arial';
    context.textAlign = 'center';
    context.fillText('PRESS I TO ACTIVATE', 256, 48);
    context.fillText('AUTOPILOT', 256, 90);
    
    const texture = new THREE.CanvasTexture(canvas);
    const spriteMaterial = new THREE.SpriteMaterial({ 
      map: texture,
      transparent: true,
      opacity: 0.8
    });
    const sprite = new THREE.Sprite(spriteMaterial);
    sprite.scale.set(2.5, 0.625, 1);
    sprite.position.set(0, 4, 0); // Position above spaceship exterior
    this.mesh.add(sprite); // Add to main mesh instead of interior
    
    // Add interior to main mesh
    this.mesh.add(this.interiorMesh);
  }

  createInteriorLights() {
    // Ensure interiorMesh exists
    if (!this.interiorMesh) {
      console.error('Interior mesh not created');
      return;
    }
    
    // Main interior light
    const mainLight = new THREE.PointLight(0xffffcc, 1, 10);
    mainLight.position.set(0, 0, 0);
    this.interiorMesh.add(mainLight);
    this.lights.interior.push(mainLight);
    
    // Cockpit light
    const cockpitLight = new THREE.PointLight(0x6666ff, 0.5, 5);
    cockpitLight.position.set(0, 0, 5);
    this.interiorMesh.add(cockpitLight);
    this.lights.interior.push(cockpitLight);
    
    // Ambient interior light
    const ambientLight = new THREE.AmbientLight(0x444444, 0.3);
    this.interiorMesh.add(ambientLight);
  }

  createEngines() {
    const engineGeometry = new THREE.CylinderGeometry(0.8, 1, 3);
    const engineMaterial = new THREE.MeshStandardMaterial({
      color: 0x222222,
      metalness: 0.9,
      roughness: 0.3
    });
    
    // Main engines
    const engine1 = new THREE.Mesh(engineGeometry, engineMaterial);
    engine1.rotation.x = Math.PI / 2;
    engine1.position.set(-3, -1, -8);
    this.mesh.add(engine1);
    
    const engine2 = new THREE.Mesh(engineGeometry, engineMaterial);
    engine2.rotation.x = Math.PI / 2;
    engine2.position.set(3, -1, -8);
    this.mesh.add(engine2);
    
    // Engine glow (will be visible when engines are on)
    this.engineGlows = [];
    
    const glowGeometry = new THREE.ConeGeometry(0.6, 2, 8);
    const glowMaterial = new THREE.MeshBasicMaterial({
      color: 0x4488ff,
      transparent: true,
      opacity: 0.8,
      emissive: 0x4488ff,
      emissiveIntensity: 2
    });
    
    const glow1 = new THREE.Mesh(glowGeometry, glowMaterial);
    glow1.rotation.x = -Math.PI / 2;
    glow1.position.set(-3, -1, -9.5);
    glow1.visible = false;
    this.engineGlows.push(glow1);
    this.mesh.add(glow1);
    
    const glow2 = new THREE.Mesh(glowGeometry, glowMaterial);
    glow2.rotation.x = -Math.PI / 2;
    glow2.position.set(3, -1, -9.5);
    glow2.visible = false;
    this.engineGlows.push(glow2);
    this.mesh.add(glow2);
    
    // Engine lights
    const leftEngineLight = new THREE.PointLight(0x4488ff, 1, 5);
    leftEngineLight.position.set(-3, -2, -9);
    this.mesh.add(leftEngineLight);
    this.lights.engines.push(leftEngineLight);
    
    const rightEngineLight = new THREE.PointLight(0x4488ff, 1, 5);
    rightEngineLight.position.set(3, -2, -9);
    this.mesh.add(rightEngineLight);
    this.lights.engines.push(rightEngineLight);
  }
  
  createPhysicsBody(position) {
    // Create main body
    this.body = this.physics.createDynamicBody(position, {
      linearDamping: 0.5,
      angularDamping: 0.8
    });
    
    // Create compound collider for hull with entrance
    // Main hull colliders (avoiding entrance area)
    
    // Left side collider
    const leftColliderDesc = this.physics.createBoxCollider(
      new THREE.Vector3(1.75, 2.5, 7.5),
      { density: 2.0, friction: 0.4, restitution: 0.1 }
    );
    leftColliderDesc.setTranslation(-3.25, 0, 0);
    this.colliders.push(this.physics.world.createCollider(leftColliderDesc, this.body));
    
    // Right side collider
    const rightColliderDesc = this.physics.createBoxCollider(
      new THREE.Vector3(1.75, 2.5, 7.5),
      { density: 2.0, friction: 0.4, restitution: 0.1 }
    );
    rightColliderDesc.setTranslation(3.25, 0, 0);
    this.colliders.push(this.physics.world.createCollider(rightColliderDesc, this.body));
    
    // Top collider above entrance
    const topColliderDesc = this.physics.createBoxCollider(
      new THREE.Vector3(1.5, 0.5, 7.5),
      { density: 2.0, friction: 0.4, restitution: 0.1 }
    );
    topColliderDesc.setTranslation(-3.5, 2, 0);
    this.colliders.push(this.physics.world.createCollider(topColliderDesc, this.body));
    
    // Floor collider (full width)
    const floorColliderDesc = this.physics.createBoxCollider(
      new THREE.Vector3(5, 0.25, 7.5),
      { density: 2.0, friction: 0.4, restitution: 0.1 }
    );
    floorColliderDesc.setTranslation(0, -2.25, 0);
    this.colliders.push(this.physics.world.createCollider(floorColliderDesc, this.body));
    
    // Back wall collider
    const backColliderDesc = this.physics.createBoxCollider(
      new THREE.Vector3(5, 2.5, 0.5),
      { density: 2.0, friction: 0.4, restitution: 0.1 }
    );
    backColliderDesc.setTranslation(0, 0, -7);
    this.colliders.push(this.physics.world.createCollider(backColliderDesc, this.body));
    
    // Front wall collider
    const frontColliderDesc = this.physics.createBoxCollider(
      new THREE.Vector3(5, 2.5, 0.5),
      { density: 2.0, friction: 0.4, restitution: 0.1 }
    );
    frontColliderDesc.setTranslation(0, 0, 7);
    this.colliders.push(this.physics.world.createCollider(frontColliderDesc, this.body));
    
    // Interior floor for walking
    const interiorFloorDesc = this.physics.createBoxCollider(
      new THREE.Vector3(4, 0.1, 6),
      { density: 1.0, friction: 0.8, restitution: 0.1 }
    );
    interiorFloorDesc.setTranslation(0, -2, 0);
    this.colliders.push(this.physics.world.createCollider(interiorFloorDesc, this.body));
  }

  createInteriorColliders() {
    // These are already created in createPhysicsBody
    // This method is here for consistency but could be used
    // to create additional interior physics elements if needed
  }

  getPosition() {
    return VehicleHelpers.getPosition(this);
  }
  
  getVelocity() {
    return VehicleHelpers.getVelocity(this);
  }
  
  getInteriorFloorNormal() {
    // Get the spaceship's up vector (floor normal in world space)
    const rotation = this.body.rotation();
    const quaternion = new THREE.Quaternion(rotation.x, rotation.y, rotation.z, rotation.w);
    const floorNormal = new THREE.Vector3(0, 1, 0);
    floorNormal.applyQuaternion(quaternion);
    return floorNormal;
  }
  
  getForwardVector() {
    if (!this.body) return new THREE.Vector3(0, 0, 1);
    
    const rotation = this.body.rotation();
    const quaternion = new THREE.Quaternion(rotation.x, rotation.y, rotation.z, rotation.w);
    const forward = new THREE.Vector3(0, 0, 1);
    forward.applyQuaternion(quaternion);
    return forward;
  }
  
  isPlayerInside(playerPosition) {
    if (!this.mesh || !this.body) return false;
    
    // Get spaceship world position
    const shipPos = this.getPosition();
    const shipRot = this.body.rotation();
    const shipQuat = new THREE.Quaternion(shipRot.x, shipRot.y, shipRot.z, shipRot.w);
    
    // Transform player position to spaceship local space
    const localPos = playerPosition.clone().sub(shipPos);
    
    // Apply inverse rotation to get position in ship's local coordinates
    const inverseQuat = shipQuat.clone().invert();
    localPos.applyQuaternion(inverseQuat);
    
    // Check if player is within spaceship interior bounds
    const bounds = {
      x: this.interiorSize.width / 2,   // Half width
      y: this.interiorSize.height / 2,  // Half height
      z: this.interiorSize.depth / 2    // Half depth
    };
    
    return Math.abs(localPos.x) < bounds.x &&
           Math.abs(localPos.y) < bounds.y &&
           Math.abs(localPos.z) < bounds.z;
  }
  
  handleMovement(deltaTime) {
    if (!this.engineOn || !this.body) return;
    
    const rotation = this.body.rotation();
    const quaternion = new THREE.Quaternion(rotation.x, rotation.y, rotation.z, rotation.w);
    
    // Get local axes
    const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(quaternion);
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(quaternion);
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(quaternion);
    
    // Apply thrust
    const thrustForce = this.keys.boost ? this.thrust * 2 : this.thrust;
    
    if (this.keys.forward) {
      const force = forward.multiplyScalar(thrustForce * deltaTime);
      this.body.applyImpulse({ x: force.x, y: force.y, z: force.z });
    }
    if (this.keys.backward) {
      const force = forward.multiplyScalar(-thrustForce * 0.5 * deltaTime);
      this.body.applyImpulse({ x: force.x, y: force.y, z: force.z });
    }
    
    // Strafe
    if (this.keys.left) {
      const force = right.multiplyScalar(-thrustForce * 0.3 * deltaTime);
      this.body.applyImpulse({ x: force.x, y: force.y, z: force.z });
    }
    if (this.keys.right) {
      const force = right.multiplyScalar(thrustForce * 0.3 * deltaTime);
      this.body.applyImpulse({ x: force.x, y: force.y, z: force.z });
    }
    
    // Vertical movement
    if (this.keys.up) {
      const force = up.multiplyScalar(thrustForce * 0.5 * deltaTime);
      this.body.applyImpulse({ x: force.x, y: force.y, z: force.z });
    }
    if (this.keys.down) {
      const force = up.multiplyScalar(-thrustForce * 0.5 * deltaTime);
      this.body.applyImpulse({ x: force.x, y: force.y, z: force.z });
    }
    
    // Rotation
    const torque = this.rotationalThrust * deltaTime;
    
    // Pitch (controlled by mouse in vehicle mode)
    // Yaw (controlled by mouse in vehicle mode)
    
    // Roll
    if (this.keys.rollLeft) {
      this.body.applyTorqueImpulse({ 
        x: forward.x * -torque, 
        y: forward.y * -torque, 
        z: forward.z * -torque 
      });
    }
    if (this.keys.rollRight) {
      this.body.applyTorqueImpulse({ 
        x: forward.x * torque, 
        y: forward.y * torque, 
        z: forward.z * torque 
      });
    }
    
    // Speed limiting
    const velocity = this.body.linvel();
    const speed = Math.sqrt(velocity.x * velocity.x + velocity.y * velocity.y + velocity.z * velocity.z);
    
    if (speed > this.maxSpeed) {
      const scale = this.maxSpeed / speed;
      this.body.setLinvel({
        x: velocity.x * scale,
        y: velocity.y * scale,
        z: velocity.z * scale
      });
    }
  }
  
  // Add method to change light colors
  setLightColors(color) {
    const lightColor = new THREE.Color(color);
    
    // Change all lights
    if (this.lights.entrance) this.lights.entrance.color = lightColor.clone();
    this.lights.windows.forEach(light => light.color = lightColor.clone());
    if (this.lights.dome) this.lights.dome.color = lightColor.clone();
    this.lights.engines.forEach(light => light.color = lightColor.clone());
    
    // Also update engine glow materials
    this.mesh.traverse((child) => {
      if (child.isMesh && child.material && child.material.name === 'engineGlow') {
        child.material.color = lightColor.clone();
        child.material.emissive = lightColor.clone();
      }
    });
  }

  // Add method to activate auto-pilot
  activateAutoPilot() {
    if (this.autoPilotActive) return; // Already active
    
    this.autoPilotActive = true;
    
    // Change lights to red to indicate auto-pilot
    this.setLightColors(0xff0000);
    
    // Change control panel light to green
    if (this.controlPanelLight) {
      this.controlPanelLight.material.color.setHex(0x00ff00);
      this.controlPanelLight.material.emissive.setHex(0x00ff00);
    }
    
    // Show engine glows
    if (this.engineGlows) {
      this.engineGlows.forEach(glow => glow.visible = true);
    }
    
    // Set initial random target
    this.setNewAutoPilotTarget();
    
    console.log('Spaceship autopilot activated! The spaceship will now fly around the platform.');
  }

  // Set a new random target for auto-pilot
  setNewAutoPilotTarget() {
    // Create a circular path around the platform
    const angle = Math.random() * Math.PI * 2;
    const radius = 50 + Math.random() * 50; // 50-100 units from center
    const height = 20 + Math.random() * 40; // 20-60 units high
    
    this.autoPilotTarget.set(
      Math.cos(angle) * radius,
      height,
      Math.sin(angle) * radius
    );
    this.autoPilotTargetTimer = 0;
  }

  // Handle auto-pilot movement
  handleAutoPilot(deltaTime) {
    if (!this.autoPilotActive || !this.body) return;
    
    const position = this.getPosition();
    const toTarget = this.autoPilotTarget.clone().sub(position);
    const distance = toTarget.length();
    
    // If close to target or been trying for too long, pick a new one
    this.autoPilotTargetTimer += deltaTime * 1000;
    if (distance < 30 || this.autoPilotTargetTimer > 8000) {
      this.setNewAutoPilotTarget();
      
      // Occasionally change light color for effect
      const colors = [0xff0000, 0xff00ff, 0xffff00, 0x00ffff];
      const randomColor = colors[Math.floor(Math.random() * colors.length)];
      this.setLightColors(randomColor);
    }
    
    // Calculate direction to target
    toTarget.normalize();
    
    // Get current forward direction
    const forward = this.getForwardVector();
    
    // Calculate how much to turn
    const dot = forward.dot(toTarget);
    const cross = new THREE.Vector3().crossVectors(forward, toTarget);
    
    // Apply stronger rotation
    const rotationStrength = 3.0; // Increased rotation speed
    if (cross.y > 0.1) {
      this.body.applyTorqueImpulse({ x: 0, y: this.rotationSpeed * rotationStrength * deltaTime, z: 0 });
    } else if (cross.y < -0.1) {
      this.body.applyTorqueImpulse({ x: 0, y: -this.rotationSpeed * rotationStrength * deltaTime, z: 0 });
    }
    
    // Apply thrust if facing roughly the right direction
    if (dot > 0.3) { // Reduced threshold to apply thrust more often
      const thrustStrength = this.thrustPower * 2; // Increased thrust
      this.body.applyImpulse({
        x: forward.x * thrustStrength * deltaTime,
        y: forward.y * thrustStrength * deltaTime,
        z: forward.z * thrustStrength * deltaTime
      });
    }
    
    // Add some random movements for fun
    if (Math.random() < 0.02) {
      const randomTorque = {
        x: (Math.random() - 0.5) * this.rotationSpeed * deltaTime,
        y: (Math.random() - 0.5) * this.rotationSpeed * deltaTime * 2,
        z: (Math.random() - 0.5) * this.rotationSpeed * deltaTime
      };
      this.body.applyTorqueImpulse(randomTorque);
    }
    
    // Apply less damping to maintain speed
    const velocity = this.body.linvel();
    this.body.setLinvel({
      x: velocity.x * 0.99,
      y: velocity.y * 0.99,
      z: velocity.z * 0.99
    });
    
    const angVel = this.body.angvel();
    this.body.setAngvel({
      x: angVel.x * 0.98,
      y: angVel.y * 0.98,
      z: angVel.z * 0.98
    });
  }

  update(deltaTime) {
    if (!this.body || !this.mesh) return;
    
    // Update mesh position to match physics
    const position = this.body.translation();
    this.mesh.position.set(position.x, position.y, position.z);
    
    const rotation = this.body.rotation();
    this.mesh.quaternion.set(rotation.x, rotation.y, rotation.z, rotation.w);
    
    // Only fly if autopilot is active
    if (this.autoPilotActive) {
      this.handleAutoPilot(deltaTime);
    }
    // No manual controls - spaceship stays put unless autopilot is on
  }
  
  // Override handleControls to use local keys
  handleControls(deltaTime) {
    // Don't handle any movement controls if autopilot is active
    if (this.autoPilotActive) return;
    
    // Player can look around but cannot fly the spaceship manually
    // The spaceship stays stationary unless autopilot is activated
  }
  
  // Fix getFlightData to not use this.keys
  getFlightData() {
    // Return null to indicate this vehicle doesn't need flight HUD
    return null;
  }
  
  // Add method to identify vehicle type
  getVehicleType() {
    return 'spaceship_demo';
  }
  
  // Update enter/exit methods
  enterVehicle(player) {
    this.isOccupied = true;
    this.currentPlayer = player;
    this.autoPilotTimer = 0;
    // Don't automatically activate auto-pilot anymore
    
    // Reset lights to normal color
    this.setLightColors(0x88ccff);
    
    // Reset control panel light to red (inactive)
    if (this.controlPanelLight) {
      this.controlPanelLight.material.color.setHex(0xff0000);
      this.controlPanelLight.material.emissive.setHex(0xff0000);
    }
  }
  
  exitVehicle() {
    this.isOccupied = false;
    this.currentPlayer = null;
    this.autoPilotTimer = 0;
    this.autoPilotActive = false;
    
    // Reset lights to green (entrance indication)
    if (this.lights.entrance) {
      this.lights.entrance.color = new THREE.Color(0x00ff00);
    }
    this.setLightColors(0x88ccff);
    
    // Reset control panel light
    if (this.controlPanelLight) {
      this.controlPanelLight.material.color.setHex(0xff0000);
      this.controlPanelLight.material.emissive.setHex(0xff0000);
    }
    
    // Reset interior colors
    if (this.interiorMesh) {
      this.interiorMesh.traverse((child) => {
        if (child.isMesh && child.material && child.userData.originalColor) {
          child.material.color.setHex(child.userData.originalColor);
          if (child.material.emissive && child.userData.originalEmissive) {
            child.material.emissive.setHex(child.userData.originalEmissive);
          }
        }
      });
    }
    
    // Reset hull colors
    if (this.mesh) {
      this.mesh.traverse((child) => {
        if (child.isMesh && child.material && child.userData.originalColor) {
          child.material.color.setHex(child.userData.originalColor);
        }
      });
    }
  }
}
