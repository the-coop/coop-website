import * as THREE from 'three';

export function createRockModel(scale = 1.0) {
  const geometry = new THREE.DodecahedronGeometry(2 * scale, 0);
  const material = new THREE.MeshStandardMaterial({
    color: 0x666666,
    roughness: 1,
    metalness: 0
  });
  
  const rock = new THREE.Mesh(geometry, material);
  rock.rotation.set(
    Math.random() * Math.PI,
    Math.random() * Math.PI,
    Math.random() * Math.PI
  );
  
  rock.castShadow = true;
  rock.receiveShadow = true;
  
  return rock;
}
