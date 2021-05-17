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

      const sunGeometry = new THREE.SphereGeometry(13, 8, 8);
      const sunMaterial = new THREE.MeshBasicMaterial({
        color: 0xffff00,
        wireframe: true
      });
      const sunSphere = new THREE.Mesh(sunGeometry, sunMaterial);
      scene.add(sunSphere);

      const earthGeometry = new THREE.SphereGeometry(6, 12, 12);
      const earthMaterial = new THREE.MeshBasicMaterial({
        color: 0x48a868,
        wireframe: true
      });
      const earthSphere = new THREE.Mesh(earthGeometry, earthMaterial);
      scene.add(earthSphere);

      const moonGeometry = new THREE.SphereGeometry(2, 5, 5);
      const moonMaterial = new THREE.MeshBasicMaterial({
        color: 0xf6f6f6,
        wireframe: true
      });
      const moonSphere = new THREE.Mesh(moonGeometry, moonMaterial);
      scene.add(moonSphere);


      const sunPivot = new THREE.Group();
      const earthPivot = new THREE.Group();

      // Add all to sun pivot (not sun to avoid rotating the sun...???)
      sunPivot.add(earthPivot);
      // sunPivot.add(sunSphere);
      
      earthPivot.add(earthSphere);
      earthPivot.add(moonSphere);

      scene.add(sunPivot);
      scene.add(earthPivot);



      earthSphere.position.x = 40;
      moonSphere.position.x = 57;

      camera.position.z = 60;

      function animate() {
        // Orbit the Earth around the sun.

        // Orbit the moon around the Earth.

        earthPivot.rotation.z += 0.01;
        sunPivot.rotation.z += 0.01;
        earthSphere.rotation.z += 0.01;
        moonSphere.rotation.z += 0.01;
        sunSphere.rotation.z += 0.01;
        // earthPivot.rotation.x += 0.01;
        // sunPivot.rotation.x += 0.01;
        // earthSphere.rotation.x += 0.01;
        // moonSphere.rotation.x += 0.01;
        // sunSphere.rotation.x += 0.01;
        // earthPivot.rotation.y += 0.01;
        // sunPivot.rotation.y += 0.01;
        // earthSphere.rotation.y += 0.01;
        // moonSphere.rotation.y += 0.01;
        // sunSphere.rotation.y += 0.01;

        requestAnimationFrame(animate);
        renderer.render(scene, camera);
      }
      animate();
    }
  }
</script>