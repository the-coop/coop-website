import * as THREE from 'three';
import { Tween, Easing } from '@tweenjs/tween.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls'

export default function runEngine({ renderer, scene, camera, sunPivot, earthPivot, earthSphere, sunSphere, moonSphere, sateliteSphere, earthRadius }) {
    // Modifier for overall orbit speed.
    const orbitBaseSpeed = 10;

    // Orbital parameters in seconds.
    const earthPivotPeriod = 50 * orbitBaseSpeed;
    const sunPivotPeriod = 100 * orbitBaseSpeed;
    const earthSpherePeriod = 10 * orbitBaseSpeed;
    const moonSpherePeriod = 10 * orbitBaseSpeed;
    const sunSpherePeriod = 10 * orbitBaseSpeed;

    // Make camera zoom to planet onclick.
    const mouse = new THREE.Vector2();
    const raycaster = new THREE.Raycaster();
    document.addEventListener('click', checkForClickedPlanets);

    // Time delta
    const clock = new THREE.Clock();

    // Deterministic time variable.
    let timeIncrement = 0;
    let focusTarget = null;

    let didLog = false;

    camera.position.z = 35;

    const animate = () => {
        timeIncrement += clock.getDelta();

        // Orbit the Earth around the sun.
        sunPivot.rotation.z = 2 * Math.PI * timeIncrement / sunPivotPeriod;

        // Orbit the moon around the Earth.
        earthPivot.rotation.z = 2 * Math.PI * timeIncrement / earthPivotPeriod;

        // Rotate the planets under their own motion/weight.
        earthSphere.rotation.z = 2 * Math.PI * timeIncrement / earthSpherePeriod;

        // Improve the rotations? [Later]
        moonSphere.rotation.z = 2 * Math.PI * timeIncrement / moonSpherePeriod;
        sunSphere.rotation.z = 2 * Math.PI * timeIncrement / sunSpherePeriod;

        if (focusTarget) {

            // Create a vector towards the focus target.
            const focusTargetVector = new THREE.Vector3(0, 0, 0);
            focusTarget.getWorldPosition(focusTargetVector);
            
            const sateliteTarget = new THREE.Vector3(0, 0, 0);
            // Move the artifical satelite to the center of the Earth.
            sateliteSphere.position.x = focusTargetVector.x;
            sateliteSphere.position.y = focusTargetVector.y;
            sateliteSphere.position.z = focusTargetVector.z + earthRadius;
        }

        // Log the data of the of faces
        if (!didLog) {
            console.log(earthSphere);

            didLog = true;
        }

        // Render the scenes, planets, and other objects.
        renderer.render(scene, camera);
        requestAnimationFrame(animate);
    }

    animate();

    const setFocusTarget = (target) => {
        console.log({...target.position})
        focusTarget = target;
        focusLockAnimationIncrementor = 0;
    }

    const checkForClickedPlanets = (clickEvent) => {
        mouse.x = (clickEvent.clientX / window.innerWidth) * 2 - 1
        mouse.y = - (clickEvent.clientY / window.innerHeight) * 2 + 1;
        raycaster.setFromCamera(mouse, camera);

        const intersections = raycaster.intersectObjects(scene.children, true);
        if (intersections.length) setFocusTarget(intersections[0].object);
    }
}