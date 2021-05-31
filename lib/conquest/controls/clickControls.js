import setFocusTarget from "./setFocusTarget";

export default function clickControls(clickEvent) {
    const { raycaster, mouse } = window.CONQUEST.VIEW;
    const { scene, camera } = window.CONQUEST;

    // Only works if canvas takes up full screen size
    mouse.x = (clickEvent.clientX / window.innerWidth) * 2 - 1
    mouse.y = - (clickEvent.clientY / window.innerHeight) * 2 + 1;

    // Collision check children from the mouse-camera vector perspective.
    raycaster.setFromCamera(mouse, camera);
<<<<<<< HEAD
    // Checks through every object in the scene recursively for intersections
=======

    // Recursively collect the raycast intersection/collections of click.
>>>>>>> f52083b40e2ab6d05d0dd847b68a42c894b75530
    const intersections = raycaster.intersectObjects(scene.children, true);
    console.log(intersections);
    if (intersections.length) 
        setFocusTarget(intersections[0]);
}