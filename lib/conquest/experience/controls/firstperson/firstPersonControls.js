export default class FirstPersonControls {
	
	reset() {
		console.log('First person controls');

		// Attach to player handle rather constantly updating its position referentially.
		WORLD.me.player.handle.attach(WORLD.camera);
		
		// Set the camera to appropriate zoom etc for first person
		WORLD.camera.position.copy(WORLD.me.player.handle.position);

		WORLD.camera.fov = 1;
		WORLD.camera.zoom = .1;
		WORLD.camera.updateProjectionMatrix();

		console.log(WORLD.me.player.handle.position);
		console.log(WORLD.camera.position);
	
		// .aspect : Float
		// Camera frustum aspect ratio, usually the canvas width / canvas height. Default is 1 (square canvas).
		
		// .far : Float
		// Camera frustum far plane. Default is 2000.
		
		// Must be greater than the current value of near plane.
		
		// .filmGauge : Float
		// Film size used for the larger axis. Default is 35 (millimeters). This parameter does not influence the projection matrix unless .filmOffset is set to a nonzero value.
		
		// .filmOffset : Float
		// Horizontal off-center offset in the same unit as .filmGauge. Default is 0.
		
		// .focus : Float
		// Object distance used for stereoscopy and depth-of-field effects. This parameter does not influence the projection matrix unless a StereoCamera is being used. Default is 10.
		
		// .fov : Float
		// Camera frustum vertical field of view, from bottom to top of view, in degrees. Default is 50.
		
		// .isPerspectiveCamera : Boolean
		// Read-only flag to check if a given object is of type PerspectiveCamera.
		
		// .near : Float
		// Camera frustum near plane. Default is 0.1.
		
		// The valid range is greater than 0 and less than the current value of the far plane. Note that, unlike for the OrthographicCamera, 0 is not a valid value for a PerspectiveCamera's near plane.
		
		// .view : Object
		// Frustum window specification or null. This is set using the .setViewOffset method and cleared using .clearViewOffset.
		
		// .zoom : number
		// Gets or sets the zoom factor of the camera. Default is 1.
	}

	update(delta) {
		// TODO: Handle the rotations
	}

	destroy() {
		// TODO: Need to unattach.
		// WORLD.me.player.handle.unattach(WORLD.camera);
	};

};
