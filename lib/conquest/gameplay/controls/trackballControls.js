
import { Vector3 } from 'three';

export default class TrackballControls {

  onChangeSOI() {
    
	}

  reset() {
    // Detach from any parent (global camera).
    WORLD.camera.removeFromParent();

		// Show own label during FPS controls.
    // if (WORLD.me?.player) {
    //   WORLD.me.player.handle.children[1].visible = true;
    //   WORLD.me.player.handle.attach(WORLD.camera);
    // }

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
    if (!WORLD.me.player) return;
    let gravityVector = WORLD.me.player.handle
      .localToWorld(new Vector3(0, 0, 0))
      .sub(WORLD.me.player.handle.localToWorld(new Vector3(0, 0, 1)))
      .normalize();
    
    WORLD.camera.up = gravityVector;
    WORLD.camera.lookAt(WORLD.me.player.handle.getWorldPosition(new Vector3(0, 0, 0)));
	};

}
