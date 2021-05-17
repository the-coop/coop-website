<template>
  <div class="worldview">
  </div>
</template>

<style>
  .worldview {
    width: 100%;
    height: 100%;
  }
</style>

<script>
  export default {
    name: 'Worldview',
    mounted() {
      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);

      const renderer = new THREE.WebGLRenderer();

      const wrapper = document.querySelector('.worldview');

      renderer.setSize(window.innerWidth, window.innerHeight);
      wrapper.appendChild(renderer.domElement);



      // Finish landing page
      // Add favicon
      // Add thecoop.group domain name to it
      // TODO: Add the sphere

      const sunGeometry = new THREE.SphereGeometry(15, 8, 8);
      const sunMaterial = new THREE.MeshBasicMaterial({
        color: 0xffff00,
        wireframe: true
      });
      const sunSphere = new THREE.Mesh(sunGeometry, sunMaterial);
      scene.add(sunSphere);

      const earthGeometry = new THREE.SphereGeometry(5, 12, 12);
      const earthMaterial = new THREE.MeshBasicMaterial({
        color: 0x48a868,
        wireframe: true
      });
      const earthSphere = new THREE.Mesh(earthGeometry, earthMaterial);
      scene.add(earthSphere);

      const moonGeometry = new THREE.SphereGeometry(2, 6, 6);
      const moonMaterial = new THREE.MeshBasicMaterial({
        color: 0xf6f6f6,
        wireframe: true
      });
      const moonSphere = new THREE.Mesh(moonGeometry, moonMaterial);
      scene.add(moonSphere);


      earthSphere.position.x = 10;
      moonSphere.position.x = -10;

      camera.position.z = 25;

      function animate() {
        requestAnimationFrame(animate);
        renderer.render(scene, camera);
      }
      animate();
    }
  }
</script>