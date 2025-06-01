import * as THREE from 'three';

export function createPlayerModel(radius, height) {
  const geometry = new THREE.CapsuleGeometry(
    radius,
    height - radius * 2,
    8, 8
  );
  const material = new THREE.MeshStandardMaterial({
    color: 0xff9900,
    transparent: true,
    opacity: 0.7
  });
  
  const mesh = new THREE.Mesh(geometry, material);
  return mesh;
}
