import * as THREE from 'three';

export function createPlayerModel(radius, height) {
  const playerGroup = new THREE.Group();
  
  // Body (capsule shape)
  const bodyGeometry = new THREE.CapsuleGeometry(radius, height - radius * 2, 8, 16);
  const bodyMaterial = new THREE.MeshStandardMaterial({
    color: 0x4444ff,
    roughness: 0.7,
    metalness: 0.3
  });
  const bodyMesh = new THREE.Mesh(bodyGeometry, bodyMaterial);
  playerGroup.add(bodyMesh);
  
  // Head
  const headGeometry = new THREE.SphereGeometry(radius * 0.8, 16, 16);
  const headMaterial = new THREE.MeshStandardMaterial({
    color: 0xfdbcb4,
    roughness: 0.7,
    metalness: 0.0
  });
  const headMesh = new THREE.Mesh(headGeometry, headMaterial);
  headMesh.position.y = height * 0.4;
  playerGroup.add(headMesh);
  
  // Arms
  const armGeometry = new THREE.CylinderGeometry(radius * 0.3, radius * 0.25, height * 0.4);
  const armMaterial = new THREE.MeshStandardMaterial({
    color: 0x4444ff,
    roughness: 0.7,
    metalness: 0.3
  });
  
  // Left arm
  const leftArm = new THREE.Mesh(armGeometry, armMaterial);
  leftArm.position.set(-radius * 1.2, 0, 0);
  leftArm.rotation.z = 0.2;
  playerGroup.add(leftArm);
  
  // Right arm
  const rightArm = new THREE.Mesh(armGeometry, armMaterial);
  rightArm.position.set(radius * 1.2, 0, 0);
  rightArm.rotation.z = -0.2;
  playerGroup.add(rightArm);
  
  playerGroup.castShadow = true;
  playerGroup.receiveShadow = true;
  
  return playerGroup;
}

export function createWeaponModel(weaponType) {
  // Create simplified weapon representations for third-person view
  let geometry;
  const material = new THREE.MeshStandardMaterial({
    color: 0x444444,
    roughness: 0.7,
    metalness: 0.3
  });
  
  switch(weaponType) {
    case 'pistol':
      geometry = new THREE.BoxGeometry(0.15, 0.2, 0.4);
      break;
    case 'rifle':
      geometry = new THREE.BoxGeometry(0.1, 0.15, 0.8);
      break;
    case 'shotgun':
      geometry = new THREE.BoxGeometry(0.12, 0.18, 0.6);
      break;
    default:
      geometry = new THREE.BoxGeometry(0.1, 0.1, 0.3);
  }
  
  const weapon = new THREE.Mesh(geometry, material);
  weapon.castShadow = true;
  weapon.receiveShadow = true;
  
  return weapon;
}

export function createNameTag(text) {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  canvas.width = 256;
  canvas.height = 64;
  
  context.fillStyle = 'rgba(0, 0, 0, 0.8)';
  context.fillRect(0, 0, 256, 64);
  
  context.fillStyle = 'white';
  context.font = '24px Arial';
  context.textAlign = 'center';
  context.fillText(text, 128, 40);
  
  const texture = new THREE.CanvasTexture(canvas);
  const material = new THREE.SpriteMaterial({ map: texture });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(2, 0.5, 1);
  
  return sprite;
}
