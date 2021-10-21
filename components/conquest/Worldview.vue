<template>
  <!-- // Load the profile picture for the user if they're logged in. -->
  <div class="worldview">
    <h1 class="error-text" v-if="noWebGL && !silent">Error WebGL not supported...</h1>
      <div v-if="!silent" class="controls">
        CONTROLS

        Your location: ?

        Exit focus
      </div>
  </div>
</template>

<style>
  .worldview {
    width: 100vw;
    height: 100vh;

    position: absolute;
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
    top: 0;
    right: 0;
    background: white;
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
    data: () => ({
      noWebGL: false
    }),
    async mounted() {
      // Used for shared state.
      window.CONQUEST = {
        // Global access to socket.
        socket: null,

        // Not really sure what else will go in here yet, prolly something fun.
        players: {},

        // An easy to use global reference to me.
        me: null,

        BIOMES,
        faces: {},
        VIEW: {
          focusTarget: null,
          mouse: new THREE.Vector2(),
          raycaster: new THREE.Raycaster(),
          cameraTween: null,
        },

        scene: new THREE.Scene(),

        // Deterministic time variable.
        timeIncrement: Date.now()
      };
      
      // Check if WebGL is supported.
      const canvas = document.createElement('canvas');
      const supportsWebGL = !!(window.WebGLRenderingContext && (canvas.getContext('webgl') || canvas.getContext('experimental-webgl')));
      if (!supportsWebGL) return this.noWebGL = true;
      else {
        // Setup the engine.
        createEngine();

        // Setup the solar system geometry.
        await createSolarSystem();

        // Run the engine.
        runEngine();

        // If a tile specified on start, take me directly there.
        if (this.tile) {
          const face = window.CONQUEST.faces[this.tile];
          setFocusTarget(face.structure.mesh);
        }

        // Setup and run the game/level networking (socket based).
        setupGroundNetworking(this.$auth.strategy.token.get());
      }
    }
  }
</script>