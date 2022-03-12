<template>
  <div class="worldview">
    <h1 class="error-text" v-if="!WEBGL_SUPPORT && !silent">Loading error...</h1>

    <canvas id="canvas" />
    <button id="toggle_controls">SWITCH</button>
  </div>
</template>

<style scoped>
  .worldview {
    width: 100vw;
    height: 100vh;

    position: fixed;
    top: 0;
    left: 0;
    z-index: -1;
  }
</style>

<script
  >import * as THREE from 'three';

  import Controls from '~/lib/conquest/experience/controls';
  import { TrackballControls } from '~/lib/conquest/experience/TrackballControls';

  import engine from '~/lib/conquest/engine';
  import buildSolarSystem from '~/lib/conquest/generation/buildSolarSystem';

  import PLANETS_SPECIFICATION from '~/lib/conquest/generation/planets-specification.json';
  import Player from '~/lib/conquest/entities/player';

  import ExperienceManager from '~/lib/conquest/experience/experienceManager';

  export default {
    name: 'Worldview',
    props: {
      silent: {
        type: Boolean,
        default: false
      },
      tile: {
        type: String,
        default: null
      }
    },
    components: {},
    data: () => ({
      WEBGL_SUPPORT: false
    }),
    methods: {

    },
    async mounted() {
      const canvas = document.getElementById('canvas');
      const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 200);

      // Check if WebGL is supported.
      this.WEBGL_SUPPORT = !!(
        window.WebGLRenderingContext && 
        (canvas.getContext('webgl') || canvas.getContext('experimental-webgl'))
      );;

      // Used for shared state.
      window.WORLD = {
        camera: camera,
        renderer: new THREE.WebGLRenderer({ canvas: canvas, antialias: true }),
        scene: new THREE.Scene,
        controls: new TrackballControls(camera, canvas),
        canvas,
        camera,
        
        planets: [],
        players: [],

        me: {
            player: null
        },

        settings: {
            view: {
                DESIRED_CAMERA_KEY: ExperienceManager.CAMERA_KEYS.TRACKBALL,
                CURRENT_CAMERA_KEY: ExperienceManager.CAMERA_KEYS.TRACKBALL
            }
        },

        // Deterministic time variable.
        timeIncrement: Date.now()
      };

      // Set background colour
      WORLD.scene.background = new THREE.Color(0x050D22);

      // Add testing player (refactor into networking later).
      const player = new Player();
      WORLD.players.push(player);
      WORLD.me.player = player;
      WORLD.players[0].handle.position.set(0, -1, -1);

      // Add the mesh to the handle.
      player.handle.add(player.mesh);

      WORLD.scene.add(buildSolarSystem(PLANETS_SPECIFICATION));
      player.current_planet = WORLD.planets[1];
      player.current_planet.body.add(WORLD.players[0].handle);

      // Configure and add camera.
      camera.position.set(0, 30, 30);
      WORLD.scene.add(WORLD.camera);

      // Generate the stars.
      const starsCount = 200;
      const starsContainer = new THREE.Group;
      for (let s = 0; s < starsCount; s++) {
          const star = new THREE.Mesh(
              new THREE.CircleGeometry(.1, .1),
              new THREE.MeshBasicMaterial({ color: 0xffffff }) 
          );

          // Calculate random star position.
          star.position.x = Math.random() * 300 - 125;
          star.position.y = Math.random() * 300 - 125;
          star.position.z = Math.random() * 300 - 125;

          // Limit the proximity of stars.
          const distance = star.position.distanceTo(WORLD.planets[0].body.position);
          if (distance > 50) {
              starsContainer.add(star);
              star.lookAt(WORLD.planets[0].body.position);
          }
      }

      // Add stars to scene.
      WORLD.scene.add(starsContainer);

      function resizer() {
          // Update camera
          WORLD.camera.aspect = window.innerWidth / window.innerHeight;
          WORLD.camera.updateProjectionMatrix();
        
          // Update renderer
          WORLD.renderer.setSize(window.innerWidth, window.innerHeight);
          WORLD.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      };
      window.addEventListener('resize', resizer);
      resizer();

      // Temporary measure for testing cameras
      const toggleBtn = document.getElementById('toggle_controls');
      toggleBtn.addEventListener('click', e => {
          if (WORLD.settings.view.DESIRED_CAMERA_KEY === ExperienceManager.CAMERA_KEYS.FIRST_PERSON)
              WORLD.settings.view.DESIRED_CAMERA_KEY = ExperienceManager.CAMERA_KEYS.TRACKBALL
          else
              WORLD.settings.view.DESIRED_CAMERA_KEY = ExperienceManager.CAMERA_KEYS.FIRST_PERSON
      });

      Controls.initialise();

      engine();
    }
  }
</script>