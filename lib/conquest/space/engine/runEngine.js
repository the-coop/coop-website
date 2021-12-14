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
      
      // Get the SOI
      const soi = window.CONQUEST.SOIS[player.orbit_influence];
      
      // TODO: This points the player's face at SOI, not feet.
      // Point player's feet at the SOI.
      player.mesh.lookAt(soi.mesh);

      // TODO: Add the player's rotation to quaternion.

      // Move along surface in direction provided by player.
      player.mesh.position.add(player.direction);

      // Apply gravitational force [pertains to SOI].
    });
  
    // Process state changes to THREE scene and objects.
    renderer.render(scene, camera);
  }

  animate();
};