import { Vector3, Euler, Quaternion, MathUtils } from 'three';

export default class FirstPersonControls {
	
	reset() {
		console.log('First person controls');
		// console.log();

		// Hide own label during FPS controls.
		if (WORLD.me?.player)
			WORLD.me.player.handle.children[1].visible = false;

		// Attach to player handle rather constantly updating its position referentially.
    WORLD.me.player.handle.attach(WORLD.camera);
		
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
		// TODO: Handle the rotations
    if (!WORLD.me.player) return;


    var gravityPosition = WORLD.me.player.handle.position.clone().normalize();
    WORLD.camera.up = gravityPosition;

    const targetPosition = new Vector3(0, 0, 0);
    const axis2 = new Vector3(1, WORLD.me.player.lon, WORLD.me.player.lat);
    targetPosition.setFromSphericalCoords(1, WORLD.me.player.lon, WORLD.me.player.lat);
    const targetPosition2 = WORLD.me.player.handle.localToWorld(axis2);
    WORLD.camera.lookAt(axis2);
	}

	destroy() {
		// TODO: Need to unattach.
		// WORLD.me.player.handle.unattach(WORLD.camera);
	};

};
