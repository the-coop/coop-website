import * as THREE from 'three';
import { ENTITY_TYPES } from '../interfaces';

export default function generateMoon() {
    const moonGeometry = new THREE.IcosahedronGeometry(.75, 1);
    const moonMaterial = new THREE.MeshBasicMaterial({ color: 0xfffff1, wireframe: true });
    const moonSphere = new THREE.Mesh(moonGeometry, moonMaterial);
  
    moonSphere.castShadow = true;
    moonSphere.receiveShadow = true;
  
    moonSphere.entity_type = ENTITY_TYPES.PLANETARY;

    return moonSphere;
  }