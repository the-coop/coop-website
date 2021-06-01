import { Tween, Easing } from '@tweenjs/tween.js';

export default function setFocusTarget(target) {
    const { controls, camera } = window.CONQUEST;

    // Lock camera to target planet.
    window.CONQUEST.VIEW.focusTarget = target.object;
    window.CONQUEST.VIEW.focusTarget.getWorldPosition(controls.target);

    // Tween the position change of the camera.
    window.CONQUEST.VIEW.cameraTween = new Tween(camera.position)
        .to({ x: target.point.x, y: target.point.y }, 1500)
        .easing(Easing.Quadratic.Out)
        .onComplete(() => window.CONQUEST.VIEW.cameraTween = null)
        .start();
}