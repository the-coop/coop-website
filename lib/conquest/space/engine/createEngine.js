import * as THREE from 'three';

export default function createEngine() {
  const renderer = new THREE.WebGLRenderer();
  renderer.setPixelRatio(window.devicePixelRatio);
  
  window.CONQUEST.scene.background = new THREE.Color(0x111111);

  const wrapper = document.querySelector('.worldview');

  const resolution = window.innerWidth / window.innerHeight;
  const camera = new THREE.PerspectiveCamera(75, resolution, 0.1, 1000);

  renderer.setSize(window.innerWidth, window.innerHeight);
  wrapper.appendChild(renderer.domElement);
  
  window.CONQUEST.renderer = renderer;
  window.CONQUEST.camera = camera;
}