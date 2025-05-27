import * as THREE from 'three';
import { RAPIER } from './physics.js';

export class SceneManager {
  constructor(physicsWorld) {
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.physicsWorld = physicsWorld;
    this.dynamicObjects = [];
  }

  init(canvas) {
    // Create scene
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
    canvas.appendChild(this.renderer.domElement);
    
    // Add lights
    this.setupLighting();
    
    return { scene: this.scene, camera: this.camera, renderer: this.renderer };
  }

  setupLighting() {
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
  }

  createPlanet(planetY = -250) {
    const planetRadius = 200;
    const terrainHeight = 30;
    
    // Create planet physics body
    const planetBodyDesc = RAPIER.RigidBodyDesc.fixed()
      .setTranslation(0, planetY, 0);
    
    const planetBody = this.physicsWorld.createRigidBody(planetBodyDesc);
    
    // Create visual geometry
    const subdivisions = 5;
    const icosahedronGeometry = new THREE.IcosahedronGeometry(planetRadius, subdivisions);
    
    // Apply terrain displacement
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
    
    // Create mesh
    const planetMaterial = new THREE.MeshStandardMaterial({
      color: 0x3a7c4a,
      roughness: 0.9,
      metalness: 0.0,
      flatShading: true
    });
    
    const planet = new THREE.Mesh(icosahedronGeometry, planetMaterial);
    planet.position.set(0, planetY, 0);
    planet.receiveShadow = true;
    planet.castShadow = true;
    this.scene.add(planet);
    
    // Create collision mesh
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
    
    const colliderVertices = new Float32Array(positions.length);
    for (let i = 0; i < positions.length; i++) {
      colliderVertices[i] = positions[i];
    }
    
    const trimeshDesc = RAPIER.ColliderDesc.trimesh(colliderVertices, indices)
      .setFriction(0.8)
      .setRestitution(0.1);
    
    const planetCollider = this.physicsWorld.createCollider(trimeshDesc, planetBody);
    
    return { mesh: planet, body: planetBody, collider: planetCollider };
  }

  createPlatform() {
    const platformWidth = 50;
    const platformHeight = 3;
    const platformDepth = 50;
    
    // Create visual mesh
    const platformGeometry = new THREE.BoxGeometry(platformWidth, platformHeight, platformDepth);
    const platformMaterial = new THREE.MeshStandardMaterial({
      color: 0x888888,
      roughness: 0.7,
      metalness: 0.2
    });
    
    const platform = new THREE.Mesh(platformGeometry, platformMaterial);
    platform.position.set(0, 30, 0);
    platform.receiveShadow = true;
    platform.castShadow = true;
    this.scene.add(platform);
    
    // Create physics
    const platformBodyDesc = RAPIER.RigidBodyDesc.fixed()
      .setTranslation(platform.position.x, platform.position.y, platform.position.z);
    
    const platformBody = this.physicsWorld.createRigidBody(platformBodyDesc);
    const platformColliderDesc = RAPIER.ColliderDesc.cuboid(
      platformWidth / 2, platformHeight / 2, platformDepth / 2
    )
    .setFriction(0.8)
    .setRestitution(0.2);
    
    const platformCollider = this.physicsWorld.createCollider(platformColliderDesc, platformBody);
    
    return { mesh: platform, body: platformBody, collider: platformCollider };
  }

  createPushableRock(position, scale = 1.0) {
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
    this.scene.add(rock);
    
    // Create physics
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
    
    const rockBody = this.physicsWorld.createRigidBody(rockBodyDesc);
    
    const rockColliderDesc = RAPIER.ColliderDesc.ball(2 * scale)
      .setDensity(0.3)
      .setFriction(0.8)
      .setRestitution(0.4);
    
    this.physicsWorld.createCollider(rockColliderDesc, rockBody);
    
    rock.userData.physicsBody = rockBody;
    this.dynamicObjects.push(rock);
    
    return { mesh: rock, body: rockBody };
  }

  updateDynamicObjects() {
    for (const obj of this.dynamicObjects) {
      if (obj.userData.physicsBody) {
        const body = obj.userData.physicsBody;
        const position = body.translation();
        obj.position.set(position.x, position.y, position.z);
        
        const rotation = body.rotation();
        obj.quaternion.set(rotation.x, rotation.y, rotation.z, rotation.w);
      }
    }
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
