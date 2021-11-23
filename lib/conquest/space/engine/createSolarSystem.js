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

  // Add meta name for UI.
  sunSphere.name = 'SUN';
  
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


  // Generate the stars.
  const starsContainer = new THREE.Group;

  let starsCount = 300;
  for (let s = 0; s < starsCount; s++) {
      const star = new THREE.Mesh(
        new THREE.CircleGeometry(1, 1),
        new THREE.MeshBasicMaterial({ color: 0xffffff }) 
      );

      // Calculate random star position.
      star.position.x = Math.random() * 2000 - 1000;
      star.position.y = Math.random() * 2000 - 1000;
      star.position.z = Math.random() * 2000 - 1000;

      // Limit the proximity of stars.
      const distance = star.position.distanceTo(sunSphere.position);
      if (distance > 300) {
        starsContainer.add(star);
        star.lookAt(sunSphere.position);
      }
  }

  // Add stars to scene.
  scene.add(starsContainer);

  
  window.CONQUEST.sunPivot = sunPivot;
  window.CONQUEST.earthPivot = earthPivot;
  window.CONQUEST.sunSphere = sunSphere;
  window.CONQUEST.moonSphere = moonSphere;

  return true;
}

