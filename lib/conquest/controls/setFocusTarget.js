import { Tween, Easing } from '@tweenjs/tween.js';
import { ENTITY_TYPES } from '../interfaces';

const cameraTween = (cameraRef, target) => 
    window.CONQUEST.VIEW.cameraTween = new Tween(cameraRef.position)
        .to({ x: target.x, y: target.y }, 1500)
        .easing(Easing.Quadratic.Out)
        .onComplete(() => window.CONQUEST.VIEW.cameraTween = null)
        .start();

export default function setFocusTarget(meshTarget) {
    const { controls, camera } = window.CONQUEST;

    // Set the new target.
    window.CONQUEST.VIEW.focusTarget = meshTarget;

    // Lock camera to target planet.
    window.CONQUEST.VIEW.focusTarget.getWorldPosition(controls.target);

    // Tween the position change of the camera.
    cameraTween(camera, controls.target);

    // Debugging only.
    if (meshTarget.entity_type === ENTITY_TYPES.STRUCTURE) {
        meshTarget.scale.x = meshTarget.scale.x * 2;
        meshTarget.scale.y = meshTarget.scale.y * 2;
        meshTarget.scale.z = meshTarget.scale.z * 4;

        controls.noRotate = true;
    }


    if (meshTarget.entity_type === ENTITY_TYPES.PLANETARY) {
        controls.noRotate = false;

        camera.zoom = 5;
    }


}