import { Tween, Easing } from '@tweenjs/tween.js';

export default function setFocusTarget(target) {
    const { controls, camera } = window.CONQUEST;

    // Lock camera to target planet.
    window.CONQUEST.VIEW.focusTarget = target.object;
    window.CONQUEST.VIEW.focusTarget.getWorldPosition(controls.target);

    // Tween the position change of the camera.
    const currentPosition = {
        x: camera.position.x,
        y: camera.position.y
    };
    const endPosition = {
        x: target.point.x,
        y: target.point.y
    }

    window.CONQUEST.VIEW.cameraTween = new Tween(currentPosition)
        .to(endPosition, 1500)
        .easing(Easing.Quadratic.Out)
        .onUpdate(() => {
            camera.position.x = currentPosition.x;
            camera.position.y = currentPosition.y;
        })
        .onComplete(() => {
            window.CONQUEST.VIEW.cameraTween = null;
        })
        .start();
}