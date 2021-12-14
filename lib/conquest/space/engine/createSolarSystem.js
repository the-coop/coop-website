import * as THREE from 'three';
import * as CANNON from 'cannon-es';

import createEarthGroup from './createEarthGroup';
import addLighting from './addLighting';
import generateMoon from './generateMoon';

const SUN_RADIUS = 2;
const earthOrbitalOffset = 80;
const moonOrbitalOffset = 17;

export default async function createSolarSystem() {
  const { scene } = window.CONQUEST;

  // Add the world lighting.
  addLighting();

  // Set up the geometry.
  const sunGeometry = new THREE.IcosahedronGeometry(20, SUN_RADIUS);
  const sunMaterial = new THREE.MeshBasicMaterial({ color: 0xf6c801, wireframe: true });

  const SUN = new THREE.Mesh(sunGeometry, sunMaterial);
  window.CONQUEST.SOIS.SUN = SUN;

  // Convenience property.
  window.CONQUEST.SOIS.SUN.mesh = SUN;

  SUN.radius = SUN_RADIUS;

  const body = SUN.body = new CANNON.Body({
    mass: SUN_RADIUS * 3,
    position: new CANNON.Vec3(0, 0, 0),
    shape: new CANNON.Sphere(SUN_RADIUS)
  });

  // Add test impulse.
  // body.applyImpulse(new CANNON.Vec3(earthRadius * .5, earthRadius * .5, earthRadius * .5));

  window.CONQUEST.world.addBody(body);

  // Set the planenary entity type.
  SUN.entity_type = 'PLANETARY';

  // Add meta name for UI.
  SUN.name = 'SUN';
  
  // Generate the Earth group.
  await createEarthGroup(earthOrbitalOffset);

  // Generate the moon.
  const MOON = generateMoon(moonOrbitalOffset);

  // Create the pivots for rotation as groups.
  const sunPivot = new THREE.Group();
  const earthPivot = new THREE.Group();

  // Impart Earth's orbital offset from the Sun.
  window.CONQUEST.SOIS.EARTH.position.x = earthOrbitalOffset;

  // Impart moon's orbital offset from the Earth.
  MOON.position.x = moonOrbitalOffset;

  
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

