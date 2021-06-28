import { Scene, PerspectiveCamera, WebGLRenderer } from 'three';

// Define the animation loop.
export default function generateGroundScene() {
    const scene = new Scene();

    const renderer = new WebGLRenderer();

    const wrapper = document.querySelector('.groundlevel');

    const resolution = window.innerWidth / window.innerHeight;
    const camera = new PerspectiveCamera(75, resolution, 0.1, 1000);
  
    // Set the size and append the element.
    renderer.setSize(window.innerWidth, window.innerHeight);
    wrapper.appendChild(renderer.domElement);

    // Give the camera its initial position.
    camera.position.z = 25;

    // Globalise the ground/scene/core components for better access later.
    return { renderer, scene, camera };
};