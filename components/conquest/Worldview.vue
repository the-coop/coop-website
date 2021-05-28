<template>
  <div :class="`worldview ${loaded ? 'loaded' : ''}`">
    <h1 class="loading-text" v-if="!loaded && !silent">Loading conquest map...</h1>
    <h1 class="error-text" v-if="noWebGL && !silent">Error WebGL not supported...</h1>
  </div>
</template>

<style>
  .worldview {
    width: 100%;
    height: 100%;

    opacity: 0;
    transition: opacity 1s ease-in;
  }

  .worldview.loaded {
    opacity: 1;
  }

  .loading-text, .error-text {
    margin: 0;
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
  }

  .loading-text {
    animation: loadingPulse 5s infinite;
  }

  .error-text {
    animation: errorPulse 5s infinite;
  }

  @keyframes loadingPulse {
    from {
      color: #c7c7c7;
      font-size: 1.25em;
    }

    to {
      color: white;
      font-size: 1.5em;
    }
  }

  @keyframes errorPulse {
    from {
      color: #a70000;
      font-size: 1.25em;
    }

    to {
      color: #b91818;
      font-size: 1.5em;
    }
  }
</style>

<script>
  import { Tween, Easing } from '@tweenjs/tween.js';
  import THREE from 'three';

  export default {
    name: 'Worldview',
    props: {
      silent: {
        type: Boolean,
        default: false
      }
    },
    data: () => ({
      loaded: false,
      noWebGL: false
    }),
    mounted() {
      // Stop the loading.
      this.loaded = true;

      // Check if WebGL is supported.
      const canvas = document.createElement('canvas');
      const supportsWebGL = !!(window.WebGLRenderingContext && (canvas.getContext('webgl') || canvas.getContext('experimental-webgl')));
      if (!supportsWebGL) return this.noWebGL = true;

      const renderer = new THREE.WebGLRenderer();
      renderer.setPixelRatio(window.devicePixelRatio);
      
      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0x111111);

      const resolution = window.innerWidth / window.innerHeight;
      const camera = new THREE.PerspectiveCamera(75, resolution, 0.1, 1000);
      
      const wrapper = document.querySelector('.worldview');

      renderer.setSize(window.innerWidth, window.innerHeight);
      wrapper.appendChild(renderer.domElement);

      
      const debuggingSatelite = new THREE.IcosahedronGeometry(0.15, 1);
      const debuggingSateliteMaterial = new THREE.MeshBasicMaterial({
        color: 0xfdcf29,
        wireframe: true
      });
      const sateliteSphere = new THREE.Mesh(debuggingSatelite, debuggingSateliteMaterial);
      scene.add(sateliteSphere);

      const sunGeometry = new THREE.IcosahedronGeometry(20, 2);
      const sunMaterial = new THREE.MeshBasicMaterial({
        color: 0xf6c801,
        wireframe: true
      });
      const sunSphere = new THREE.Mesh(sunGeometry, sunMaterial);
      scene.add(sunSphere);

      const earthRadius = 5;
      const earthGeometry = new THREE.IcosahedronGeometry(earthRadius, 5);
      const earthMaterial = new THREE.MeshBasicMaterial({
        color: 0x4cff00,
        wireframe: true
      });
      const earthSphere = new THREE.Mesh(earthGeometry, earthMaterial);
      scene.add(earthSphere);

      const moonGeometry = new THREE.IcosahedronGeometry(.75, 1);
      const moonMaterial = new THREE.MeshBasicMaterial({
        color: 0xfffff1,
        wireframe: true
      });
      const moonSphere = new THREE.Mesh(moonGeometry, moonMaterial);
      scene.add(moonSphere);

      // Create the pivots for rotation as groups.
      const sunPivot = new THREE.Group();
      const earthPivot = new THREE.Group();

      // Add the ambient light where the sun is... the sun never moves. :D
      scene.add(new THREE.PointLight(0xffffff, 0.1));

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
      const  raycaster = new THREE.Raycaster();
      document.addEventListener('click', checkForClickedPlanets);

      // Time delta
      const clock = new THREE.Clock();

      // Deterministic time variable.
      // let timeIncrement = Date.now() / 1000;
      let timeIncrement = 0;
      let focusTarget = null;
      // Makes lock animation gradually faster over time. Must always be reset to 0 for every new focus
      let focusLockAnimationIncrementor = 0;
      let lookatNeeded = false;

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

        // @ISO, you're saying moon sun and earth rotate roughly the same?
        moonSphere.rotation.z = 2 * Math.PI * timeIncrement / moonSpherePeriod;
        sunSphere.rotation.z = 2 * Math.PI * timeIncrement / sunSpherePeriod;

        // @ISO, does the moon actually orbit this Earth? lmao


        if (focusTarget) {
          focusLockAnimationIncrementor = 1;

          // Create a vector towards the focus target.
          const focusTargetVector = new THREE.Vector3(0, 0, 0);
          focusTarget.getWorldPosition(focusTargetVector);
          
          const focusTargetRadius = focusTarget.geometry.parameters.radius;

          const sateliteTarget = new THREE.Vector3(0, 0, 0);
          sateliteSphere.getWorldPosition(sateliteTarget);
          // Check if Camera is locked to camera
          if(camera.position.clone().floor() === focusTargetVector.clone().floor()) {
            camera.position.copy(focusTargetVector.clone().floor());
            resetFocusTarget();
          }
          // Move the camera to the Earth, with some buffering distance.
          if (camera.position.x < focusTargetVector.x + (focusTargetRadius * 1.5))
            camera.position.x += focusLockAnimationIncrementor;
          if (camera.position.y < focusTargetVector.y + (focusTargetRadius * 1.5))
            camera.position.y += focusLockAnimationIncrementor;
          if(camera.position.x > focusTargetVector.x + (focusTargetRadius * 1.5))
            camera.position.x -= 1;
          if(camera.position.y > focusTargetVector.y + (focusTargetRadius * 1.5))
            camera.position.y -= 1;
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
        requestAnimationFrame(animate);
        renderer.render(scene, camera);
      }

      animate();

      function setFocusTarget(target) {
        console.log({...target.position})
        focusTarget = target;
        focusLockAnimationIncrementor = 0;
        lookatNeeded = true;
      }

      function resetFocusTarget() {
        focusTarget = null;
        lookatNeeded = false;
      }
      function checkForClickedPlanets(clickEvent) {
        // Only works if canvas is full screen.
        mouse.x = (clickEvent.clientX / window.innerWidth) * 2 - 1
        mouse.y = - (clickEvent.clientY / window.innerHeight) * 2 + 1;
        raycaster.setFromCamera(mouse, camera);
        const intersections = raycaster.intersectObjects(scene.children, true);
        if(intersections.length) {
          setFocusTarget(intersections[0].object);
        }
      }
    }
  }
</script>