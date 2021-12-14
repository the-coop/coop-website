import * as THREE from 'three';
import * as CANNON from 'cannon-es';

export default function createEngine() {
  const renderer = new THREE.WebGLRenderer();

  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  renderer.setPixelRatio(window.devicePixelRatio);
  
  window.CONQUEST.scene.background = new THREE.Color(0x111111);

  const wrapper = document.querySelector('.worldview');

  const resolution = window.innerWidth / window.innerHeight;
  const camera = new THREE.PerspectiveCamera(75, resolution, 0.1, 1000);

  renderer.setSize(window.innerWidth, window.innerHeight);
  wrapper.appendChild(renderer.domElement);


  const world = new CANNON.World;

  // Turn off global gravity and use impulses towards SOIs.
  world.gravity.set(0, 0, 0);

  world.broadphase = new CANNON.SAPBroadphase(world);
  world.allowSleep = true;

  const defaultMaterial = new CANNON.Material('default');
  const defaultContactMaterial = new CANNON.ContactMaterial(
    defaultMaterial, 
    defaultMaterial, 
    { friction: 100, restitution: 0.01 }
  );
 
  world.defaultContactMaterial = defaultContactMaterial;


  window.CONQUEST.world = world;
  window.CONQUEST.renderer = renderer;
  window.CONQUEST.camera = camera;
}