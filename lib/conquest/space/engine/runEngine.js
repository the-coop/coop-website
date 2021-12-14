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

  // Step time for physics integration.
  let lastUpdateTime = 0;

  // The animation/render loop.
  const animate = () => {
    const { players } = window.CONQUEST;

    // Update physics world step.
    const elapsedTime = clock.getElapsedTime();
    const deltaTime = elapsedTime - lastUpdateTime;
    lastUpdateTime = elapsedTime;

    // Throttled physics update.
    window.CONQUEST.world.step(1 / 60, deltaTime, 3);

    // Increment the delta.
    window.CONQUEST.timeIncrement += clock.getDelta();

    // Update the planetary orbits. :)
    updateOrbits();

    // Controls need updated due to manual updates/positioning.
    updateControls();

    // Render the scenes, planets, and other objects.
    requestAnimationFrame(animate);

    // Update the SOI body positions.
    Object.keys(window.CONQUEST.SOIS).map(soiKey => {
      const soi = window.CONQUEST.SOIS[soiKey];
      soi.body.position.copy(soi.mesh.position);
    });

    // Read the player positions into the render here.
    Object.keys(players).map(playerID => {
      const player = players[playerID];
      
      // Get the SOI
      const soi = window.CONQUEST.SOIS[player.orbit_influence];
      
      // Point player's feet at the SOI.
      // player.mesh.lookAt(soi.mesh.position);

      // TODO: Add the player's rotation to quaternion.

      // Move along surface in direction provided by player.
      const moveVec = new THREE.Vector3(player.body.position);
      moveVec.add(player.direction);
      player.body.position.copy(moveVec);

      // Apply gravitational force [pertains to SOI].
      const gravityVec = new THREE.Vector3();
      gravityVec
        .copy(player.body.position)
        .sub(soi.body.position)
        .normalize().multiplyScalar(-5);

      // What does this do?
      gravityVec.clampScalar(-.5, .5);

      // Apply the calculated gravity vector as a force.
      player.body.force.copy(gravityVec);
      
      // Sync the physics body positions to the mesh positions
      player.mesh.position.copy(player.body.position);
      player.mesh.quaternion.copy(player.body.quaternion);
    });
  
    // Process state changes to THREE scene and objects.
    renderer.render(scene, camera);
  }

  animate();
};