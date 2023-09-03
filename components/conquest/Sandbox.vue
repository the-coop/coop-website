<template>
  <div class="sandbox">
    <canvas id="canvas"></canvas>
  </div>
</template>

<style scoped>
  .sandbox {
    width: 100vw;
    height: 100vh;

    position: fixed;
    top: 0;
    left: 0;
    z-index: -1;
  }
</style>

<script>
  import * as THREE from 'three';
  import { generateCharacter } from '~/lib/conquest/players/playerManager';

  // May need moving down if it doesn't work here?
  function resizer() {
    // Update camera
    SANDBOX.camera.aspect = window.innerWidth / window.innerHeight;
    SANDBOX.camera.updateProjectionMatrix();

    // Update renderer
    SANDBOX.renderer.setSize(window.innerWidth, window.innerHeight);
    SANDBOX.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  };

  export default {
    name: 'Sandbox',
    async mounted() {
      // Check if WebGL is supported.
      const canvas = document.getElementById('canvas');

      // Is this working properly?
      this.WEBGL_SUPPORT = !!(
        window.WebGLRenderingContext && 
        (canvas.getContext('webgl') || canvas.getContext('experimental-webgl'))
      );

      // Used for shared state.
      window.SANDBOX = {
        canvas,

        renderer: new THREE.WebGLRenderer({ canvas, antialias: true }),
        scene: new THREE.Scene,
        camera: new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 200),

        cameraAnimation: null,

        // Deterministic time variable
        timeIncrement: Date.now(),
        deltaTime: 0
      };

      // Set background colour
      SANDBOX.scene.background = new THREE.Color(0x050D22);

      // Add our main camera to the engine.
      SANDBOX.scene.add(SANDBOX.camera);

      // Soft white global light
      const light = new THREE.AmbientLight(0x404040); 
      SANDBOX.scene.add(light);

      // Add screen resizing capability.
      window.addEventListener('resize', resizer);
      resizer();

      // SETUP / TESTING

      // const geometry = new THREE.BoxGeometry(1, 1, 1); 
      // const material = new THREE.MeshBasicMaterial({ color: 0x00ff00 }); 
      // const cube = new THREE.Mesh(geometry, material); 
      
      // SANDBOX.scene.add(cube); 
      
      SANDBOX.camera.position.z = 0.3;
      SANDBOX.camera.position.y = 0.1;

      const character = generateCharacter()

      SANDBOX.scene.add(character);

      function animate() { 
        requestAnimationFrame(animate); 

        // character.rotation.x += 0.01;
        // character.rotation.y += 0.01;

        SANDBOX.renderer.render(SANDBOX.scene, SANDBOX.camera); 
      } 
      animate();
    }
  }
</script>
