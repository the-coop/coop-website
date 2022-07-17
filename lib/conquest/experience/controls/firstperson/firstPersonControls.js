export default class FirstPersonControls {
	reset() {
		// TODO: This will need unattaching later.
		this.object.position.copy(WORLD.me.player.handle.position);
		WORLD.me.player.handle.attach(this.object);
	}

	update(delta) {
	}

	destroy() {
	};

};
