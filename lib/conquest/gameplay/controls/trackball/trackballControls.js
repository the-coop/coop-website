


export default class TrackballControls {
	
	reset() {
		// Show own label during FPS controls.
		if (WORLD.me?.player)
			WORLD.me.player.handle.children[1].visible = true;

		// Detach from any parent (global camera).
		WORLD.camera.removeFromParent();

		// Set the camera to appropriate zoom etc for first person
		// WORLD.camera.position.copy(WORLD.me.player.handle.position);

		WORLD.camera.fov = 50;
		// WORLD.camera.zoom = 1;
		WORLD.camera.updateProjectionMatrix();

		// Reset camera aim to planet.
		WORLD.camera.position.set(0, 15, 40);
		WORLD.camera.lookAt(WORLD.planets[0].body.position)
	}

	destroy() {
	}

	update() {
	};

}
