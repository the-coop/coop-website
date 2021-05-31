import setFocusTarget from "./setFocusTarget";

export default function clickControls(clickEvent) {
    const { raycaster, mouse } = window.CONQUEST.VIEW;
    const { scene, camera } = window.CONQUEST;

    // Only works if canvas takes up full screen size
    mouse.x = (clickEvent.clientX / window.innerWidth) * 2 - 1
    mouse.y = - (clickEvent.clientY / window.innerHeight) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    // Checks through every object in the scene recursively for intersections
    const intersections = raycaster.intersectObjects(scene.children, true);
    if (intersections.length) setFocusTarget(intersections[0]);
}