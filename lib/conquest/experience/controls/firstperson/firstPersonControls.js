export default class FirstPersonControls {
	
	reset() {
		console.log('First person controls');
		// WORLD.camera.position.copy(WORLD.me.player.handle.position);
		WORLD.me.player.handle.attach(WORLD.camera);
	}

	update(delta) {
		// TODO: Handle the rotations
	}

	destroy() {
		// TODO: Need to unattach.
		// WORLD.me.player.handle.unattach(WORLD.camera);
	};

};
