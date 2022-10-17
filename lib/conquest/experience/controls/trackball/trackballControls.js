import { Tween, Easing } from '@tweenjs/tween.js';

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

        WORLD.cameraAnimation = new Tween(WORLD.camera.position)
          .to({ x: 0, y: 15, z: 40 }, 1250)
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
