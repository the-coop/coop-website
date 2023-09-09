import { Vector3, Euler, Quaternion, MathUtils, Matrix3 } from 'three';

export default class FirstPersonControls {
	
	onChangeSOI() {
		
	}

	reset() {
		console.log('First person controls');
		// console.log();

		// Hide own label during FPS controls.
		if (WORLD.me?.player) {
			WORLD.me.player.handle.visible = false;

			// Attach to player handle rather than constantly updating its position referentially.
			WORLD.me.player.handle.attach(WORLD.camera);
		}

		// Set the camera to appropriate zoom etc for first person
        WORLD.camera.position.set(0, 0, 0);

		// Recreate projection frustrum (reduce scale).
		WORLD.camera.near = 0.002;
		WORLD.camera.far = 125;
		WORLD.camera.fov = 30;

		// Apply changes.
		WORLD.camera.updateProjectionMatrix();
	}

	regroundCamera() {
		console.log('Regrounding camera');
	}

	update(delta) {
		if (!WORLD.me.player) return;

		let gravityVector = WORLD.me.player.handle
			.localToWorld(new Vector3(0, 0, 0))
			.sub(WORLD.me.player.handle.localToWorld(new Vector3(0, 0, 1)))
			.normalize();

		WORLD.camera.up = gravityVector;

		// Invert "Y" direction by user preference.
		const adjustedLat = WORLD.settings.controls.INVERTED_Y ?
			WORLD.me.player.lat : -WORLD.me.player.lat;

		const targetPosition = new Vector3(-WORLD.me.player.lon, 1, adjustedLat).normalize();

		targetPosition.setFromSphericalCoords(1, (3.1415926 / 2) + adjustedLat, WORLD.me.player.lon);

		// const targetPosition2 = WORLD.me.player.handle.localToWorld(new Vector3(targetPosition.x, targetPosition.z, targetPosition.y));
		// WORLD.camera.lookAt(targetPosition2);

		WORLD.me.player.mesh.lookAt(gravityVector);
	}

	destroy() {
		// TODO: Need to unattach.
		// WORLD.me.player.handle.unattach(WORLD.camera);
		// WORLD.camera.removeFromParent();
	};

};
