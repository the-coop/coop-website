import { Tween, Easing } from '@tweenjs/tween.js';

export default function setFocusTarget(object) {
    const { controls, camera } = window.CONQUEST;

    // Lock camera to target planet.
    window.CONQUEST.VIEW.focusTarget = object;
    window.CONQUEST.VIEW.focusTarget.getWorldPosition(controls.target);

    // Modify the camera/control settings for this new target/diameter subject.
    console.log(object);

    // Tween the position change of the camera.
    window.CONQUEST.VIEW.cameraTween = new Tween(camera.position)
        .to({ x: controls.target.x, y: controls.target.y }, 1500)
        .easing(Easing.Quadratic.Out)
        .onComplete(() => window.CONQUEST.VIEW.cameraTween = null)
        .start();
}