export default class FirstPersonControls {
	
	reset() {
		console.log('First person controls');
		// console.log();

		// Hide own label during FPS controls.
		if (WORLD.me?.player)
			WORLD.me.player.handle.children[1].visible = false;

		// Attach to player handle rather constantly updating its position referentially.
		WORLD.me.player.mesh.attach(WORLD.camera);
		
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
	}

	destroy() {
		// TODO: Need to unattach.
		// WORLD.me.player.handle.unattach(WORLD.camera);
	};

};
