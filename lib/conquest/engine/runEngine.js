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
    let cameraTween = null;
    const cameraControls = new OrbitControls(camera, renderer.domElement);
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
            // Move Camera and update its rotation.
            cameraTween.update();
            cameraControls.update();

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
        // Lock camera to target planet.
        focusTarget = target.object;
        cameraControls.target = focusTarget.position;
        console.log({...cameraControls.target});
        // Tween the position change of the camera.
        const currentPosition = {
          x: camera.position.x,
          y: camera.position.y
        };
        const endPosition = {
          x: target.point.x,
          y: target.point.y
        }
        cameraTween = new Tween(currentPosition)
        // Feel free to change the tween duration (1500) below
        .to(endPosition, 1500)
        .easing(Easing.Quadratic.Out)
        .onUpdate(() => {
          camera.position.x = currentPosition.x;
          camera.position.y = currentPosition.y;
        })
        .start();
      }
     
    // Only works with function keyword.
    function checkForClickedPlanets(clickEvent) {
        // Only works if canvas takes up full screen size
        mouse.x = (clickEvent.clientX / window.innerWidth) * 2 - 1
        mouse.y = - (clickEvent.clientY / window.innerHeight) * 2 + 1;
        raycaster.setFromCamera(mouse, camera);

        const intersections = raycaster.intersectObjects(scene.children, true);
        if (intersections.length) setFocusTarget(intersections[0]);
    }
}












// import * as THREE from 'three';
// import TrackballControls from 'three-trackballcontrols';
// import _ from 'lodash';

// const BIOMES = ['grass','snow', 'sand', 'water'];
// const faces = {};

// const scene = new THREE.Scene();
// const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);

// const renderer = new THREE.WebGLRenderer();
// renderer.setSize(window.innerWidth, window.innerHeight);
// document.body.appendChild(renderer.domElement);

// const light1 = new THREE.DirectionalLight(0xffffff, 0.5);
// light1.position.set(1, 1, 1);
// scene.add(light1);

// const earthGroup = new THREE.Group;

// const earthRadius = 5;
// const earthGeometry = new THREE.IcosahedronGeometry(earthRadius, 4);
// const earthMaterial = new THREE.MeshLambertMaterial({ vertexColors: true });
// const earthSphere = new THREE.Mesh(earthGeometry, earthMaterial);

// earthGroup.add(earthSphere);

// const positionsRaw = earthGeometry.getAttribute('position').array;
// const vertices = _.chunk(positionsRaw, 3);
// const triangles = _.chunk(vertices, 3);


// triangles.map((triangle, index) => {
// 	const facePointerGeometry = new THREE.BoxGeometry(.1, .1, .1);
// 	const facePointerMaterial = new THREE.MeshLambertMaterial();
// 	const facePointerSphere = new THREE.Mesh(facePointerGeometry, facePointerMaterial);

// 	facePointerSphere.position.x = (triangle[0][0] + triangle[1][0] + triangle[2][0]) / 3;
// 	facePointerSphere.position.y = (triangle[0][1] + triangle[1][1] + triangle[2][1]) / 3;
// 	facePointerSphere.position.z = (triangle[0][2] + triangle[1][2] + triangle[2][2]) / 3;

// 	// Lock its rotation onto the planet's surface using vector comparison.
// 	facePointerSphere.lookAt(0, 0, 0);

// 	// Add the pointer sphere to the scene and group.
// 	earthGroup.add(facePointerSphere);
// 	scene.add(facePointerSphere);

// 	const randomBiome = BIOMES[Math.floor(Math.random() * BIOMES.length)];

// 	// Store the face data for access.
// 	faces[index] = {
// 		biome: randomBiome,
// 		position: facePointerSphere.position,
// 		structure: null,
// 		players: null
// 	};
// });


// scene.add(earthSphere);

// // Setup the controls
// const controls = new TrackballControls(camera, renderer.domElement);
// controls.noPan = true;
// controls.rotateSpeed = 5;

// controls.minDistance = 6.25;
// controls.maxDistance = 15;


// // Give the camera its initial position.
// camera.position.set(9, 9, 9);

// // Update for manual controls change.
// controls.update();


// function animate() {
// 	// Render to the scene.
// 	requestAnimationFrame(animate);

//     // Update and smooth camera.
// 	controls.update();

// 	// Process state changes to THREE scene and objects.
// 	renderer.render(scene, camera);
// }
// animate();





// const color = new THREE.Color;
// const colors = [];
// vertices.push(triangle[0][0], triangle[0][1], triangle[0][2]);
// vertices.push(triangle[1][0], triangle[1][1], triangle[1][2]);
// vertices.push(triangle[2][0], triangle[2][1], triangle[2][2]);


// color.setRGB(Math.abs(triangle[2][1]) / earthRadius, 0.5, 0.5);
// colors.push(color.r, color.g, color.b);
// colors.push(color.r, color.g, color.b);
// colors.push(color.r, color.g, color.b);



// // Make a face seperated geomtry
// const earthFaceGeometry = new THREE.BufferGeometry();
// const earthPositionAttribute = new THREE.BufferAttribute(new Float32Array(vertices));
// earthFaceGeometry.setAttribute('position', earthPositionAttribute, 3);

// // Set the colour attribute
// const earthColourAttribute = new THREE.BufferAttribute(new Float32Array(colors));
// // earthFaceGeometry.setAttribute('color', earthColourAttribute, 3);

// // compute Normals - why?
// earthFaceGeometry.computeVertexNormals();

// // normalize the earthFaceGeometry - why?