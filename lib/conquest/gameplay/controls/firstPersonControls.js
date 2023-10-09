
import { Vector3, Euler, Quaternion, MathUtils, Matrix3, Matrix4 } from 'three';

const _v1 = /*@__PURE__*/ new Vector3();
const _q1 = /*@__PURE__*/ new Quaternion();
const _m1 = /*@__PURE__*/ new Matrix4();
const _position = /*@__PURE__*/ new Vector3();

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


  lookAtHelper(obj, target) {

    const parent = obj.parent;
    obj.updateWorldMatrix(true, false);
    _position.setFromMatrixPosition(obj.matrixWorld);
    if (obj.isCamera) {
      _m1.lookAt(_position, target, obj.up);
    } else {
      _m1.lookAt(target, _position, obj.up);
    }

    const result = new Quaternion();
    result.setFromRotationMatrix(_m1);

    //if (parent) {
    //  _m1.extractRotation(parent.matrixWorld);
    ///  _q1.setFromRotationMatrix(_m1);
    //  result.premultiply(_q1.invert());
    //}
    return result;
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

		const targetPosition2 = WORLD.me.player.handle.localToWorld(new Vector3(targetPosition.x, targetPosition.z, targetPosition.y));
		WORLD.camera.lookAt(targetPosition2);

    //const NewQuad = this.lookAtHelper(WORLD.camera, new Vector3(targetPosition.x, targetPosition.z, targetPosition.y));
    //WORLD.camera.quaternion.set(NewQuad);


		WORLD.me.player.mesh.lookAt(gravityVector);
	}

	destroy() {
		// TODO: Need to unattach.
		// WORLD.me.player.handle.unattach(WORLD.camera);
		// WORLD.camera.removeFromParent();
	};

};
