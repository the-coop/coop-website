<template>
  <!-- // Load the profile picture for the user if they're logged in. -->
  <div class="worldview">
    <h1 class="error-text" v-if="noWebGL && !silent">Loading error...</h1>

    <div v-if="!silent && !tutorial" class="controls">
      <div v-if="focus && focus.name !== 'EARTH'" class="content-container">
        <h3>{{ focus.name }}</h3>

        <!-- When focus is a structure, show details about the structure? -->
        <div v-if="focus.entity_type === 'STRUCTURE'">
          <h4>Owner</h4>

          <a :href="`http://localhost:3000/members/${getStructure(focus.face_id).structure.owner.id}`" target="_blank">
            {{ getStructure(focus.face_id).structure.owner.username }}
          </a>
        </div>
        
        <!-- biome: "SNOW" -->

        <!-- Coordinates -->
          
        <button 
          v-on:click="spawn"
          v-if="focus.entity_type === 'STRUCTURE' && $auth.$state.loggedIn && !me"
          class="ui-main-button button">
          Spawn
        </button>

        <button 
          v-on:click="unfocus"
          class="ui-main-button button">
          Unlock
        </button>
      </div>

      <!-- Need to add a help/guide link somewhere. -->

      <div 
        class="content-container"
        v-if="$auth.$state.loggedIn && me">
        <h2>{{ me.username }}</h2>
        <div>
          <div>X: {{ me.position.x.toFixed(2) }}</div>
          <div>Y: {{ me.position.y.toFixed(2) }}</div>
          <div>Z: {{ me.position.z.toFixed(2) }}</div>
        </div>

        <button 
          v-on:click="focusMe"
          class="ui-main-button button">
          Focus
        </button>
      </div>

      <div 
        class="content-container"
        v-if="!$auth.$state.loggedIn">
        You must log in to play.
        <NuxtLink 
          :to="{ 
            path: '/auth/login', 
            query: { redirect: 'http://thecoop.group/conquest/world' }
          }">
          <button class="ui-main-button play-button button">Play</button>
        </NuxtLink>
      </div>
    </div>

    <Tutorial :show="tutorial" :skipTutorial="skipTutorial" />
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

  .controls {
    position: absolute;
    z-index: 2;
    top: 1em;
    right: 1em;
  }

  .ui-main-button {
    width: 100%;
    margin-top: .5em;
  }

  .content-container {
    background: rgba(255, 250, 250, 0.87);
    border-radius: .5rem;
  }

  .content-container + .content-container {
    margin-top: 0;
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
  import * as THREE from 'three';

  import createEngine from '../../lib/conquest/space/engine/createEngine';
  import runEngine from '../../lib/conquest/space/engine/runEngine';
  import createSolarSystem from '../../lib/conquest/space/engine/createSolarSystem';

  import BIOMES from '../../lib/conquest/space/biomes';
  import setFocusTarget from '../../lib/conquest/space/controls/setFocusTarget';

  import setupGroundNetworking from '~/lib/conquest/space/ground/setupGroundNetworking';

  import Tutorial from './Tutorial.vue';

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
    components: {
      Tutorial
    },
    data: () => ({
      noWebGL: false,
      tutorial: false,
      me: null,
      focus: null
    }),
    methods: {
      getStructure(faceID) {
        console.log(window.CONQUEST.faces?.[faceID]);
        return window.CONQUEST.faces?.[faceID];
      },
      skipTutorial() {
        this.tutorial = false;
        localStorage.setItem('skip-tutorial', true);
      },
      unfocus() {
        // Default to focussing on Earth.
        setFocusTarget(window.CONQUEST.earthSphere);
      },
      focusMe() {
        setFocusTarget(window.CONQUEST.me.mesh);
      },
      spawn() {
        const focusTarget = window.CONQUEST.VIEW.focusTarget;
        const spawnFace = focusTarget.face_id;
        const spawnPos = window.CONQUEST.faces[spawnFace].position;

        window.CONQUEST.socket.emit('player_spawned', {
          // Pass the yet unvalidated spawn location.
          spawn_location: spawnPos,

          // Make this dynamic so we can spawn on other planets. Elon.
          orbit_influence: 'EARTH'
        });
      }
    },
    async mounted() {
      // Used for shared state.
      window.CONQUEST = {
        // Global access to socket.
        socket: null,

        // Not really sure what else will go in here yet, prolly something fun.
        players: {},

        // An easy to use global reference to me.
        me: null,

        // Entites with orbital gravity.
        SOIS: {},

        BIOMES,
        faces: {},

        VIEW: {
          UI: this,
          focusTarget: null,
          mouse: new THREE.Vector2(),
          raycaster: new THREE.Raycaster(),
          cameraTween: null
        },

        scene: new THREE.Scene(),

        // Deterministic time variable.
        timeIncrement: Date.now()
      };

      // Check if WebGL is supported.
      const canvas = document.createElement('canvas');
      const supportsWebGL = !!(
        window.WebGLRenderingContext && 
        (
          canvas.getContext('webgl') || 
          canvas.getContext('experimental-webgl')
        )
      );

      // Prevent WebGL access.
      if (!supportsWebGL) 
        return this.noWebGL = true;

      // Setup the engine.
      createEngine();

      // Setup the solar system geometry.
      await createSolarSystem();

      // Run the engine.
      runEngine();

      // If a tile specified on start, take me directly there.
      if (this.tile) {
        // Check it's a valid base.
        const face = window.CONQUEST.faces[this.tile];
        if (face?.structure?.mesh)
          // Note: Maybe just lock to the tile itself and not the base?
          setFocusTarget(face.structure.mesh);
      }

      // Setup and run the game/level networking (socket based).
      setupGroundNetworking(this.$auth.strategy.token.get());

      // Display statistics to the UI.
      const statsInterval = setInterval(() => {
        // Update UI ref's property for rendering UI data.
        if (!window.CONQUEST.me) return;

        const player = window.CONQUEST.players[window.CONQUEST.me.id];

        const currentPos = new THREE.Vector3();
        player.mesh.getWorldPosition(currentPos);
        window.CONQUEST.VIEW.UI.me.position = currentPos;
        
      }, 777);

      // Start tutorial if appropriate.
      if (!localStorage.getItem('skip-tutorial') && !this.silent)
        this.tutorial = true;

      // Add resize listener for canvas and scene.
      window.addEventListener('resize', () => {
        // this.handleResize();


        // Update sizes
        // sizes.width = window.innerWidth;
        // sizes.height = window.innerHeight;

        // Update camera
        // camera.aspect = sizes.width / sizes.height;
        // camera.updateProjectionMatrix();

        // Update renderer
        // renderer.setSize(sizes.width, sizes.height);
        // renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      });
    }

  }
</script>