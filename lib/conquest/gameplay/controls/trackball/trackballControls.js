
import { Vector3, Euler, Quaternion, MathUtils, Matrix3 } from 'three';

export default class TrackballControls {
	
  reset() {

    // Detach from any parent (global camera).
    WORLD.camera.removeFromParent();

		// Show own label during FPS controls.
    if (WORLD.me?.player) {
      WORLD.me.player.handle.children[1].visible = true;
      WORLD.me.player.handle.attach(WORLD.camera);


    }

		// Set the camera to appropriate zoom etc for first person
		// WORLD.camera.position.copy(WORLD.me.player.handle.position);

		WORLD.camera.fov = 50;
		// WORLD.camera.zoom = 1;
		WORLD.camera.updateProjectionMatrix();

		// Reset camera aim to planet.
		WORLD.camera.position.set(0, -0.5, -0.5);
	}

	destroy() {
	}

  update() {
    if (!WORLD.me.player) return;
    let gravityVector = WORLD.me.player.handle
      .localToWorld(new Vector3(0, 0, 0))
      .sub(WORLD.me.player.handle.localToWorld(new Vector3(0, 0, 1)))
      .normalize();


    
    WORLD.camera.up = gravityVector;
    WORLD.camera.lookAt(WORLD.me.player.handle.getWorldPosition(new Vector3(0, 0, 0)));

	};

}
