// https://threejs.org/docs/#api/en/cameras/PerspectiveCamera
// Note: that after making changes to most of these properties you 

import ControlsManager from "./controlsManager";

// will have to call .updateProjectionMatrix for the changes to take effect.
export default class CameraManager {

    static isFPS() {
        return WORLD.settings.view.CURRENT_CAMERA_KEY === ControlsManager.CAMERA_KEYS.FIRST_PERSON;
    }

    static isTrackball() {
        return WORLD.settings.view.CURRENT_CAMERA_KEY === ControlsManager.CAMERA_KEYS.TRACKBALL;
    }

}