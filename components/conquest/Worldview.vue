<template>
  <div class="worldview">
    <h1 class="error-text" v-if="!WEBGL_SUPPORT && !silent">Loading error...</h1>

    <button v-if="!silent" id="toggle_controls">SWITCH</button>
    <canvas id="canvas" />
  </div>
</template>

<style scoped>
  #toggle_controls {
    position: absolute;
    z-index: 1;
    top: 0;
  }
  .worldview {
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
  import { Tween, Easing } from '@tweenjs/tween.js';

  import Controls from '~/lib/conquest/experience/controls';
  import { TrackballControls } from '~/lib/conquest/experience/TrackballControls';

  import engine from '~/lib/conquest/engine';
  import buildSolarSystem from '~/lib/conquest/generation/buildSolarSystem';
  import setupNetworking from '~/lib/conquest/network/setupNetworking';

  import PLANETS_SPECIFICATION from '~/lib/conquest/generation/planets-specification.json';

  import PlayerManager from '~/lib/conquest/entities/playerManager';
  import ExperienceManager from '~/lib/conquest/experience/experienceManager';

  import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
  import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';  
  import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';

  const bloom = {
    exposure: 0.5,
    bloomStrength: 1.5,
    bloomThreshold: 0.7,
    bloomRadius: 0.1
  };

  // import Player from '~/lib/conquest/entities/player';
  const spawn = () => {
    // Add testing player (refactor into networking later).
    // const player = new Player();

    // @isoleucine, if this line is commented out, it breaks everything?
    // WORLD.players.push(player);

    // WORLD.me.player = player;
    // WORLD.players[0].handle.position.set(0, -1, -1);

    // // Add the mesh to the handle.
    // player.handle.add(player.mesh);
    // player.current_planet = WORLD.planets[1];
    // player.current_planet.body.add(WORLD.players[0].handle);
  };

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
      },
      intro: {
        type: Boolean,
        default: false
      },
      networking: {
        type: Boolean,
        default: false
      }
    },
    components: {},
    data: () => ({
      WEBGL_SUPPORT: false
    }),
    methods: {

    },

    // TODO might need a setting to disable this for low power devices
    // µSet up HDR rendering
    // WORLD.renderer.toneMapping = THREE.ReinhardToneMapping;
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
        renderer: new THREE.WebGLRenderer({ canvas, antialias: true }),
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
            CURRENT_CAMERA_KEY: ExperienceManager.CAMERA_KEYS.TRACKBALL,
          }
        },

        tween: null,

        // Deterministic time variable.
        timeIncrement: Date.now()
      };

      const renderScene = new RenderPass(WORLD.scene, WORLD.camera);

      const bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 1.5, 0.4, 0.85);

      bloomPass.threshold = bloom.bloomThreshold;
      bloomPass.strength = bloom.bloomStrength;
      bloomPass.radius = bloom.bloomRadius;

      WORLD.composer = new EffectComposer(WORLD.renderer);
      WORLD.composer.addPass(renderScene);
      WORLD.composer.addPass(bloomPass);

      // Set background colour
      WORLD.scene.background = new THREE.Color(0x050D22);

      // Generate the world.
      WORLD.scene.add(buildSolarSystem(PLANETS_SPECIFICATION));

      // Configure and add camera.
      this.intro ? 
        camera.position.set(240, 240, 240)
        :
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

      // soft white global light
      const light = new THREE.AmbientLight(0x404040); 
      WORLD.scene.add(light);

      // Add stars to scene.
      WORLD.scene.add(starsContainer);

      function resizer() {
        // Update camera
        WORLD.camera.aspect = window.innerWidth / window.innerHeight;
        WORLD.camera.updateProjectionMatrix();

        // Update renderer
        WORLD.renderer.setSize(window.innerWidth, window.innerHeight);
        WORLD.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

        //todo super sampleing, this might be laggy
        WORLD.composer.setSize(window.innerWidth * 2, window.innerHeight * 2);
      };
      window.addEventListener('resize', resizer);
      resizer();

      // Temporary measure for testing cameras
      if (!this.silent) {
        const toggleBtn = document.getElementById('toggle_controls');
        toggleBtn.addEventListener('click', e => {
            if (WORLD.settings.view.DESIRED_CAMERA_KEY === ExperienceManager.CAMERA_KEYS.FIRST_PERSON)
                WORLD.settings.view.DESIRED_CAMERA_KEY = ExperienceManager.CAMERA_KEYS.TRACKBALL
            else
                WORLD.settings.view.DESIRED_CAMERA_KEY = ExperienceManager.CAMERA_KEYS.FIRST_PERSON
        });

        Controls.initialise();
      }

      // Begin networking
      if (this.networking) {
        // Setup and run the game/level networking (socket based).
        setupNetworking(this.$auth.strategy.token.get());

        console.log('Player should load and other players...');
        console.log('Changes should be shown via network.');
        console.log(this.$auth.user);
        if (this.$auth.user) {
          // Connect websockets.
          // PlayerManager.isSpawned()
          // PlayerM
          // Spawn the player, unless unspawned.
          // if (this.$auth.user)
            // PlayerManager
          // TODO If player logged in spawn/re-center world.
          // WORLD.me
        }
      }

      // Handle intro loading if applicable.
      if (this.intro) {
        WORLD.tween = new Tween(WORLD.camera.position)
          .to({ x: 0, y: 10, z: 30 }, 2000)
          .easing(Easing.Quadratic.Out)
          .start()
          .onComplete(() => WORLD.tween = null);
      }

      engine(this);
    }
  }
</script>
