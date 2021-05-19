<template>
  <div class="worldview">
    <h1>Loading conquest map...</h1>
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
      if (!process.server && !window.THREE) {
        const scriptElem = document.createElement("script");
        scriptElem.onload = this.onScriptLoaded;
        scriptElem.type = "text/javascript";
        scriptElem.src = "https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js";
        document.head.appendChild(scriptElem);
      } else
        this.onScriptLoaded();
    },
    methods: {
      onScriptLoaded() {
        const scene = new THREE.Scene();
        const resolution = window.innerWidth / window.innerHeight;
        const camera = new THREE.PerspectiveCamera(75, resolution, 0.1, 1000);

        const renderer = new THREE.WebGLRenderer();

        const wrapper = document.querySelector('.worldview');

        renderer.setSize(window.innerWidth, window.innerHeight);
        wrapper.appendChild(renderer.domElement);

        const sunGeometry = new THREE.IcosahedronGeometry(20, 2);
        const sunMaterial = new THREE.MeshBasicMaterial({
          color: 0xffff00,
          wireframe: true
        });
        const sunSphere = new THREE.Mesh(sunGeometry, sunMaterial);
        scene.add(sunSphere);

        const earthRadius = 5;
        const earthGeometry = new THREE.IcosahedronGeometry(earthRadius, 5);
        const earthMaterial = new THREE.MeshBasicMaterial({
          color: 0x48a868,
          wireframe: true
        });
        const earthSphere = new THREE.Mesh(earthGeometry, earthMaterial);
        scene.add(earthSphere);

        const moonGeometry = new THREE.IcosahedronGeometry(1, 1);
        const moonMaterial = new THREE.MeshBasicMaterial({
          color: 0xf6f6f6,
          wireframe: true
        });
        const moonSphere = new THREE.Mesh(moonGeometry, moonMaterial);
        scene.add(moonSphere);


        const sunPivot = new THREE.Group();
        const earthPivot = new THREE.Group();

        // Add the ambient light where the sun is... the sun never moves. :D
        scene.add(new THREE.PointLight(0xffffff, 0.1)); // optional

        // Add all to sun pivot (not sun to avoid rotating the sun...???)
        sunPivot.add(earthPivot);
        
        earthPivot.add(earthSphere);
        earthPivot.add(moonSphere);

        scene.add(sunPivot);
        scene.add(earthPivot);

        // Impart Earth's orbital offset from the sun.
        earthSphere.position.x = 80;

        // Impart moon's orbital offset from the Earth.
        moonSphere.position.x = earthSphere.position.x + 17;

        // Deterministic time variable.

        // Orbital parameters in seconds.
        const earthPivotPeriod = 50;
        const sunPivotPeriod = 100;
        const earthSpherePeriod = 10;
        const moonSpherePeriod = 10;
        const sunSpherePeriod = 10;


        // Position the camera for initial placement.
        // camera.position.z = earthRadius;
        // camera.position.x = earthSphere.position.x;



        camera.position.z = 100;

        const clock = new THREE.Clock();
        let timeIncrement = Date.now() / 1000;

        function animate() {
          timeIncrement += clock.getDelta();

          // Orbit the Earth around the sun.
          sunPivot.rotation.z = 2 *  Math.PI * timeIncrement / sunPivotPeriod;

          // Orbit the moon around the Earth.
          earthPivot.rotation.z = 2 * Math.PI * timeIncrement / earthPivotPeriod;

          // Rotate the planets under their own motion/weight.
          earthSphere.rotation.z = 2 * Math.PI * timeIncrement / earthSpherePeriod;
          // @ISO, you're saying moon sun and earth rotate roughly the same?
          moonSphere.rotation.z = 2 * Math.PI * timeIncrement / moonSpherePeriod;
          sunSphere.rotation.z = 2 * Math.PI * timeIncrement / sunSpherePeriod;

          // @ISO, does the moon actually orbit this Earth? lmao

          // Create a vector towards the Earth target.
          const earthTarget = new THREE.Vector3(0, 0, 0);
          earthSphere.getWorldPosition(earthTarget);

          // Move the camera to the Earth, with some buffering distance.
          camera.position.z = earthTarget.z + (earthRadius * 1.5);
          camera.position.x = earthTarget.x + (earthRadius * 1.5);
          camera.position.y = earthTarget.y + (earthRadius * 1.5);

          // Point the camera at the Earth.
          camera.lookAt(earthTarget);

          // Render the scenes, planets, and other objects.
          requestAnimationFrame(animate);
          renderer.render(scene, camera);
        }

        animate();
      }
    }
  }
</script>