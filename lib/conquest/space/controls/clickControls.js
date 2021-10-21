import _ from "lodash";
import setFocusTarget from "./setFocusTarget";


export function isTouchEvent(event) {
    return (
      event.touches && event.touches.length ||
      event.changedTouches && event.changedTouches.length
    );
}

export default function clickControls(event) {
    const { raycaster, mouse } = window.CONQUEST.VIEW;
    const { scene, camera } = window.CONQUEST;

    // Differentiate between touch event and mouse.
    if (isTouchEvent(event)) {
        mouse.x = (event.changedTouches[0].clientX / window.innerWidth) * 2 - 1;
        mouse.y = -(event.changedTouches[0].clientY / window.innerHeight) * 2 + 1;
    } else {
        mouse.x = (event.clientX / window.innerWidth) * 2 - 1
        mouse.y = - (event.clientY / window.innerHeight) * 2 + 1;
    }

    // Collision check children from the mouse-camera vector perspective.
    raycaster.setFromCamera(mouse, camera);

    // Recursively collect the raycast intersection/collections of click.
    const intersections = raycaster.intersectObjects(scene.children, true);
    const intersectionResult = intersections[0] || null;
    if (!intersectionResult) return false;

    // Check current target different from new target.
    const prevTarget = window.CONQUEST.VIEW.focusTarget;
    const newTarget = intersectionResult.object.uuid;
    if (prevTarget && prevTarget.uuid === newTarget)
        return false;
        
    setFocusTarget(intersectionResult.object);
}