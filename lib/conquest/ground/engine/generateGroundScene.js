import { Scene, PerspectiveCamera, WebGLRenderer } from 'three';

// Define the animation loop.
export default function generateGroundScene() {
    const scene = new Scene();
    const camera = new PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    const renderer = new WebGLRenderer();

    // Set the size and append the element.
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);

    // Give the camera its initial position.
    camera.position.z = 25;

    // Globalise the ground/scene/core components for better access later.
    return { renderer, scene, camera };
};