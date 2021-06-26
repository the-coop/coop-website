// TODO: I will re-write trackball controls for this, because I'm not happy with current.
export default class CameraControls {

	canvasElem = null;
	camera = null;

	constructor(camera, canvasElem) {
		super();

		this.camera = camera;
		this.canvasElem = canvasElem;
	}

	rotate() {}

	zoom() {}

	transition() {}
}