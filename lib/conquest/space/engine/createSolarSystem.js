import * as THREE from 'three';
import createEarthGroup from './createEarthGroup';
import addLighting from './addLighting';
import generateMoon from './generateMoon';

const SUN_RADIUS = 2;

export default async function createSolarSystem() {
  const { scene } = window.CONQUEST;

  // Add the world lighting.
  addLighting();

  // Set up the geometry.
  const sunGeometry = new THREE.IcosahedronGeometry(20, SUN_RADIUS);
  const sunMaterial = new THREE.MeshBasicMaterial({ color: 0xf6c801, wireframe: true });

  const SUN = new THREE.Mesh(sunGeometry, sunMaterial);
  window.CONQUEST.SOIS.SUN = SUN;

  SUN.radius = SUN_RADIUS;

  // Set the planenary entity type.
  SUN.entity_type = 'PLANETARY';

  // Add meta name for UI.
  SUN.name = 'SUN';
  
  // Generate the Earth group.
  await createEarthGroup();

  // Generate the moon.
  const MOON = generateMoon();

  // Create the pivots for rotation as groups.
  const sunPivot = new THREE.Group();
  const earthPivot = new THREE.Group();

  //  Impart Earth's orbital offset from the Sun.
  window.CONQUEST.SOIS.EARTH.position.x = 80;

  // Impart moon's orbital offset from the Earth.
  MOON.position.x = 17;

  
  scene.add(SUN);

  // Add all to sun pivot (not sun to avoid rotating the sun...???)
  sunPivot.add(window.CONQUEST.SOIS.EARTH);
  
  earthPivot.add(MOON);

  window.CONQUEST.SOIS.EARTH.add(earthPivot);

  scene.add(sunPivot);

  // Generate the stars.
  const starsCount = 300;
  const starsContainer = new THREE.Group;
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
      const distance = star.position.distanceTo(SUN.position);
      if (distance > 300) {
        starsContainer.add(star);
        star.lookAt(SUN.position);
      }
  }

  // Add stars to scene.
  scene.add(starsContainer);

  
  window.CONQUEST.sunPivot = sunPivot;
  window.CONQUEST.earthPivot = earthPivot;
  window.CONQUEST.SUN = SUN;
  window.CONQUEST.MOON = MOON;

  return true;
}

