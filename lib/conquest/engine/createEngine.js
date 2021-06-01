import * as THREE from 'three';

export default function createEngine() {
  const renderer = new THREE.WebGLRenderer();
  renderer.setPixelRatio(window.devicePixelRatio);
  
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x111111);

  scene.testingData = true;
  scene.userData.test = 'llama';

  const resolution = window.innerWidth / window.innerHeight;
  const camera = new THREE.PerspectiveCamera(75, resolution, 0.1, 1000);
  
  const wrapper = document.querySelector('.worldview');

  renderer.setSize(window.innerWidth, window.innerHeight);
  wrapper.appendChild(renderer.domElement);

  window.CONQUEST.renderer = renderer
  window.CONQUEST.scene = scene
  window.CONQUEST.camera = camera
}