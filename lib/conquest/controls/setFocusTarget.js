import { Tween, Easing } from '@tweenjs/tween.js';

export default function setFocusTarget(target) {
    const { controls, camera } = window.CONQUEST;

    // Lock camera to target planet.
    window.CONQUEST.VIEW.focusTarget = target.object;
    controls.target = window.CONQUEST.VIEW.focusTarget.position;
    
    console.log({...controls.target});
    
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
        .start();
}