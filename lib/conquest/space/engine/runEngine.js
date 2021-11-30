import * as THREE from 'three';
import _ from 'lodash';

import setupControls from '../controls/setupControls';
import updateControls from '../controls/updateControls';
import updateOrbits from '../physics/updateOrbits';
import setFocusTarget from '../controls/setFocusTarget';

export default function runEngine() {
  const { renderer, scene, camera, earthSphere } = window.CONQUEST;

  // Time delta
  const clock = new THREE.Clock();

  // Setup the rotating and clicking controls.
  setupControls();

  // Default to focussing on Earth.
  setFocusTarget(earthSphere);

  // The animation/render loop.
  const animate = () => {
    const { players } = window.CONQUEST;

    // Increment the delta.
    window.CONQUEST.timeIncrement += clock.getDelta();

    // Update the planetary orbits. :)
    updateOrbits();

    // Controls need updated due to manual updates/positioning.
    updateControls();
    
    // Render the scenes, planets, and other objects.
    requestAnimationFrame(animate);

    // Read the player positions into the render here.
    Object.keys(players).map(playerID => {
      const player = players[playerID];

      // Rotate the player by the rotation vector.
      player.mesh.lookAt(player.rotation);

      // Move the object according to network declaration.
      player.mesh.position.add(player.direction);

      // Get the SOI
      // const soi = window.CONQUEST.SOIS[player.orbit_influence];

      // Universal constants for applying gravity.
      const gravity = -0.5;
      const delta = 0.01;
      const friction = 0.99;
      const planetSize = 15;

      // Apply gravity to player.
      const direction = player.mesh.position.clone().normalize();
      player.velocity.multiply(friction);
      player.velocity.addScaledVector(direction, gravity * delta);
      
      // A ground surface that holds the player up.
      if (player.mesh.position.length() < planetSize) {
        player.mesh.position.clampLength(planetSize, 100000);
        const reflection = player.velocity.projectOnVector(direction);
        player.velocity.sub(reflection);
      }

      // Apply friction and gravity to position.
      player.mesh.position.addScaledVector(player.velocity, delta);
    });

    // Process state changes to THREE scene and objects.
    renderer.render(scene, camera);
  }

  animate();
};
