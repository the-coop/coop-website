import * as THREE from 'three';
import ENTITY_TYPES from '../entity-types';
import createEarthGroup from './createEarthGroup';
import addLighting from './addLighting';
import generateMoon from './generateMoon';

export default async function createSolarSystem() {
  const { scene } = window.CONQUEST;

  // Add the world lighting.
  addLighting();

  // Set up the geometry.
  const sunGeometry = new THREE.IcosahedronGeometry(20, 2);
  const sunMaterial = new THREE.MeshBasicMaterial({ color: 0xf6c801, wireframe: true });
  const sunSphere = new THREE.Mesh(sunGeometry, sunMaterial);
  sunSphere.entity_type = ENTITY_TYPES.PLANETARY;
  
  // Generate the Earth group.
  await createEarthGroup();

  // Generate the moon.
  const moonSphere = generateMoon();
  
  // Create the pivots for rotation as groups.
  const sunPivot = new THREE.Group();
  const earthPivot = new THREE.Group();

  window.CONQUEST.earthGroup.position.x = 80;

  // Impart moon's orbital offset from the Earth.
  moonSphere.position.x = 17;

  
  scene.add(sunSphere);

  // Add all to sun pivot (not sun to avoid rotating the sun...???)
  sunPivot.add(window.CONQUEST.earthGroup);
  
  earthPivot.add(moonSphere);

  window.CONQUEST.earthGroup.add(earthPivot);

  scene.add(sunPivot);

  
  window.CONQUEST.sunPivot = sunPivot;
  window.CONQUEST.earthPivot = earthPivot;
  window.CONQUEST.sunSphere = sunSphere;
  window.CONQUEST.moonSphere = moonSphere;

  return true;
}

