import * as THREE from 'three';

export function createPlayerModel(radius, height) {
  const playerGroup = new THREE.Group();
  playerGroup.name = 'Player';
  
  // Body (capsule)
  const bodyGeometry = new THREE.CapsuleGeometry(radius, height - radius * 2, 8, 8);
  const bodyMaterial = new THREE.MeshStandardMaterial({
    color: 0xff9900,
    transparent: true,
    opacity: 0.7
  });
  const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
  body.castShadow = true;
  body.receiveShadow = true;
  body.name = 'Body';
  playerGroup.add(body);
  
  // Head
  const headGeometry = new THREE.SphereGeometry(radius * 0.6, 8, 8);
  const headMaterial = new THREE.MeshStandardMaterial({
    color: 0xfdbcb4,
    roughness: 0.7,
    metalness: 0.0
  });
  const head = new THREE.Mesh(headGeometry, headMaterial);
  head.position.y = height * 0.35;
  head.castShadow = true;
  head.receiveShadow = true;
  head.name = 'Head';
  playerGroup.add(head);
  
  // Hands - positioned at the front of the player capsule
  const handGeometry = new THREE.BoxGeometry(0.08, 0.05, 0.12);
  const handMaterial = new THREE.MeshStandardMaterial({
    color: 0xfdbcb4,
    roughness: 0.7,
    metalness: 0.0
  });
  
  // Left hand
  const leftHand = new THREE.Mesh(handGeometry, handMaterial);
  leftHand.position.set(-radius * 0.7, height * 0.1, radius * 0.8);
  leftHand.rotation.set(0.2, 0.3, -0.2);
  leftHand.castShadow = true;
  leftHand.receiveShadow = true;
  leftHand.name = 'LeftHand';
  playerGroup.add(leftHand);
  
  // Right hand
  const rightHand = new THREE.Mesh(handGeometry, handMaterial.clone());
  rightHand.position.set(radius * 0.7, height * 0.1, radius * 0.8);
  rightHand.rotation.set(0.2, -0.3, 0.2);
  rightHand.castShadow = true;
  rightHand.receiveShadow = true;
  rightHand.name = 'RightHand';
  playerGroup.add(rightHand);
  
  // Add simple fingers for left hand
  const fingerGeometry = new THREE.BoxGeometry(0.015, 0.015, 0.03);
  
  for (let i = 0; i < 4; i++) {
    const finger = new THREE.Mesh(fingerGeometry, handMaterial.clone());
    finger.position.set(
      -radius * 0.7 + (i - 1.5) * 0.02,
      height * 0.075,
      radius * 0.9
    );
    finger.rotation.set(0.3, 0.3, -0.2);
    finger.castShadow = true;
    finger.name = `LeftFinger${i}`;
    playerGroup.add(finger);
  }
  
  // Add simple fingers for right hand
  for (let i = 0; i < 4; i++) {
    const finger = new THREE.Mesh(fingerGeometry, handMaterial.clone());
    finger.position.set(
      radius * 0.7 + (i - 1.5) * 0.02,
      height * 0.075,
      radius * 0.9
    );
    finger.rotation.set(0.3, -0.3, 0.2);
    finger.castShadow = true;
    finger.name = `RightFinger${i}`;
    playerGroup.add(finger);
  }
  
  // Store references to hands for later manipulation
  playerGroup.userData.leftHand = leftHand;
  playerGroup.userData.rightHand = rightHand;
  
  return playerGroup;
}

export function createWeaponModel(weaponType) {
  if (!weaponType || weaponType === 'hands') return null;
  
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
