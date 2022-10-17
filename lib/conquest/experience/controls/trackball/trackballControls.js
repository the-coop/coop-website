import { Tween, Easing } from '@tweenjs/tween.js';

export const TRACKBALL_RESET_MS = 1250;

export default class TrackballControls {
	
	reset() {
		// Detach from any parent (global camera).
		WORLD.camera.removeFromParent();

		WORLD.camera.position.set(0, 45, 45);

		// Set the camera to appropriate zoom etc for first person
		// WORLD.camera.position.copy(WORLD.me.player.handle.position);

		WORLD.camera.fov = 50;
		// WORLD.camera.zoom = 1;
		WORLD.camera.updateProjectionMatrix();

		// Start the intro animation.
        WORLD.cameraAnimation = new Tween(WORLD.camera.position)
          .to({ x: 0, y: 15, z: 40 }, TRACKBALL_RESET_MS)
          .easing(Easing.Quadratic.InOut)
          .start()
		  .onUpdate(() => WORLD.camera.lookAt(WORLD.planets[0].body.position))
          .onComplete(() => WORLD.cameraAnimation = null);
	}

	destroy() {
	}

	update() {
	};

}
