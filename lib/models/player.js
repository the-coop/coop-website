import * as THREE from 'three';

export function createPlayerModel(radius, height, color = 0x00ff00) {
  const geometry = new THREE.CapsuleGeometry(
    radius,
    height - radius * 2,
    8, 8
  );
  
  const material = new THREE.MeshStandardMaterial({
    color: color, // Green for other players by default
    roughness: 0.7,
    metalness: 0.1
  });
  
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  
  return mesh;
}

export function createNameTag(text, options = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = options.width || 256;
  canvas.height = options.height || 64;
  const context = canvas.getContext('2d');
  
  // Background
  context.fillStyle = options.backgroundColor || 'rgba(0, 0, 0, 0.5)';
  context.fillRect(0, 0, canvas.width, canvas.height);
  
  // Text
  context.font = options.font || '24px Arial';
  context.fillStyle = options.textColor || 'white';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(text, canvas.width / 2, canvas.height / 2);
  
  const texture = new THREE.CanvasTexture(canvas);
  const spriteMaterial = new THREE.SpriteMaterial({ 
    map: texture,
    depthTest: true,
    depthWrite: false
  });
  
  const sprite = new THREE.Sprite(spriteMaterial);
  sprite.scale.set(
    options.scaleX || 2, 
    options.scaleY || 0.5, 
    1
  );
  
  return sprite;
}

export function createWeaponModel(weaponName) {
  let geometry;
  let color = 0x444444;
  
  switch(weaponName) {
    case 'pistol':
      geometry = new THREE.BoxGeometry(0.15, 0.2, 0.4);
      color = 0x333333;
      break;
    case 'rifle':
      geometry = new THREE.BoxGeometry(0.1, 0.15, 0.8);
      color = 0x222222;
      break;
    case 'shotgun':
      geometry = new THREE.BoxGeometry(0.12, 0.18, 0.6);
      color = 0x443322;
      break;
    default:
      return null;
  }
  
  const material = new THREE.MeshStandardMaterial({
    color: color,
    roughness: 0.7,
    metalness: 0.3
  });
  
  const weapon = new THREE.Mesh(geometry, material);
  weapon.castShadow = true;
  weapon.receiveShadow = true;
  
  // Rotate to point forward
  weapon.rotation.set(0, Math.PI / 2, 0);
  
  return weapon;
}
