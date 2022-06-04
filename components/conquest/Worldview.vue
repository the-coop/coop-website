<template>
  <div class="worldview">
    <h1 class="error-text" v-if="!WEBGL_SUPPORT && !silent">Loading error...</h1>

    <div 
      class="settings-toggle"
      @click="ev => { ev.preventDefault(); this.settingsOpen = !this.settingsOpen}"
      v-if="!silent">
      <Gear />
    </div>

    <div v-if="settingsOpen && !silent" class="settings">
      <h1>SETTINGS</h1>

      <span v-show="$auth.$state.loggedIn" 
        class="primary-action"
        @click="logout">⏏️ Logout</span>

      <span class="primary-action" @click="toggleGUI">
        🐛 GUI
      </span>

      <span class="primary-action" @click="closeSettings">
        x Close
      </span>
    </div>

    <div class="primary" v-if="!silent">
      <button 
        class="primary-action"
        v-show="$auth.$state.loggedIn" 
        @click="spawn" 
        v-if="!silent && !spawned" id="spawn">
        🧬 Spawn
      </button>
      <NuxtLink v-show="!$auth.$state.loggedIn" 
        class="primary-action"
        :to="{ path: '/auth/login', query: { intent: 'game' }}">
        🔑 Login
      </NuxtLink>
    </div>

    <div class="info" v-if="!silent && guiOpen">
      Target: {{ selected }}
      <p>
        <button 
          @click="changeCamera"
          id="toggle_controls">SWITCH POV</button>
      </p>
    </div>

    <canvas id="canvas" />
  </div>
</template>

<style scoped>
  * {
    user-select: none;
  }
  .info {
    position: absolute;
    z-index: 1;
    top: 0;
    right: 0;

    background: rgba(255, 255, 255, 0.77);
    padding: .25em 2.25em;
  }
  .settings-toggle {
    position: absolute;
    z-index: 1;

    top: .35em;
    left: .75em;

    cursor: pointer;
  }
  .settings-toggle svg {
    fill: #747474;
    stroke: rgb(163, 162, 162);
    width: 1.75em;
  }
  .settings-toggle:hover svg {
    fill: #2d2d2d;
    stroke: rgb(144, 144, 144);
  }
  .settings {
    display: flex;
    position: fixed;

    height: 100%;
    width: 100%;

    background: rgba(23, 23, 23, 0.93);
    color: white;

    flex-direction: column;
    justify-content: center;
    align-items: center;
    z-index: 2;
  }
  .primary {
    position: absolute;
    z-index: 1;

    bottom: .35em;
    right: .75em;
  }
  .primary-action {
    font-size: 3em;
    color: rgba(255, 255, 255, 0.77);
    background: none;
    border: none;
    cursor: pointer;
    text-decoration: none;
  }
  .primary-action:hover {
    opacity: .65;
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

  import ExperienceManager from '~/lib/conquest/experience/experienceManager';

  import Gear from '../socials/Gear.vue';

  import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
  import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';  
  import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';

  const bloom = {
    exposure: 0.5,
    bloomStrength: 1.5,
    bloomThreshold: 0.7,
    bloomRadius: 0.1
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
    components: {
      Gear
    },
    data: () => ({
      WEBGL_SUPPORT: false,

      settingsOpen: false,
      guiOpen: false,

      spawned: false,

      selected: null
    }),
    methods: {
      changeCamera() {
        if (WORLD.settings.view.DESIRED_CAMERA_KEY === ExperienceManager.CAMERA_KEYS.FIRST_PERSON)
          WORLD.settings.view.DESIRED_CAMERA_KEY = ExperienceManager.CAMERA_KEYS.TRACKBALL;
        else
          WORLD.settings.view.DESIRED_CAMERA_KEY = ExperienceManager.CAMERA_KEYS.FIRST_PERSON;
      },
      logout() {
        this.$auth.logout();
        this.closeSettings();
      },
      toggleGUI() {
        this.guiOpen = !this.guiOpen;
        this.closeSettings();
      },
      closeSettings() {
        this.settingsOpen = false;
      },
      spawn() {
        // Move all of this to player recognised event?
        const target = WORLD.planets[0];
        console.log(target);

        const spawnPos = target.body.position;
        // Offset from the planet?
        // spawnPos.set(50, 50, 50);

        window.WORLD.socket.emit('player_spawned', {
          spawn_location: spawnPos,
          orbit_influence: target.name
          // TODO: Pass the ID for the solar system
        });

        // Update GUI actions related to spawnign.
        this.spawned = true;
      }
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

        socket: null,
        
        planets: [],
        players: {},

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

      window.addEventListener('click', ev => {
        // Check that the click was on the canvas and not a menu etc.
        if (ev.target !== canvas) return false;

        console.log('Conquest clicked...');
        console.log(ev);
        console.log(ev.target);
      });

      // Temporary measure for testing cameras
      if (!this.silent) {
        Controls.initialise();
      }

      // Setup and run the game/level networking (socket based).
      if (this.networking && this.$auth.user)
        setupNetworking(this.$auth.strategy.token.get(), this.$auth.user);

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
