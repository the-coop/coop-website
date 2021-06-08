<template>
  <div class="worldview">
    <h1 class="error-text" v-if="noWebGL && !silent">Error WebGL not supported...</h1>
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
  import createEngine from '../../lib/conquest/engine/createEngine';  
  import runEngine from '../../lib/conquest/engine/runEngine';
  import createSolarSystem from '../../lib/conquest/engine/createSolarSystem';  
  import * as THREE from 'three';

  import { BIOMES } from '../../lib/conquest/interfaces';
  import setFocusTarget from '~/lib/conquest/controls/setFocusTarget';

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
    mounted() {
      // Used for shared state.
      window.CONQUEST = {
        BIOMES,
        faces: {},
        VIEW: {
          focusTarget: null,
          mouse: new THREE.Vector2(),
          raycaster: new THREE.Raycaster(),
          cameraTween: null
        },

        // Deterministic time variable.
        timeIncrement: 0
      };
      
      // Check if WebGL is supported.
      const canvas = document.createElement('canvas');
      const supportsWebGL = !!(window.WebGLRenderingContext && (canvas.getContext('webgl') || canvas.getContext('experimental-webgl')));
      if (!supportsWebGL) return this.noWebGL = true;
      else {
        // Setup the engine.
        createEngine();

        // Setup the solar system geometry.
        createSolarSystem();
  
        // Run the engine.
        runEngine();

        // If a tile specified on start, take me directly there.
        if (this.tile) {
          const face = window.CONQUEST.faces[this.tile];
          setFocusTarget(face.structure.mesh);
        }
      }
    }
  }
</script>