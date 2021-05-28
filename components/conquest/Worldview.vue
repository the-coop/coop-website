<template>
  <div class="worldview">
    <h1 class="error-text" v-if="noWebGL && !silent">Error WebGL not supported...</h1>
  </div>
</template>

<style>
  .worldview {
    width: 100%;
    height: 100%;
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
  import * as THREE from 'three';
  import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls'
  import createEngine from '../../lib/conquest/engine/createEngine';  
  import runEngine from '../../lib/conquest/engine/runEngine';
  import createSolarSystemGeometry from '../../lib/conquest/engine/createSolarSystemGeometry';  

  export default {
    name: 'Worldview',
    props: {
      silent: {
        type: Boolean,
        default: false
      }
    },
    data: () => ({
      noWebGL: false
    }),
    mounted() {
      // Check if WebGL is supported.
      const canvas = document.createElement('canvas');
      const supportsWebGL = !!(window.WebGLRenderingContext && (canvas.getContext('webgl') || canvas.getContext('experimental-webgl')));
      if (!supportsWebGL) return this.noWebGL = true;

      // TODO: Make these things all global on window

      // Setup the engine.
      const { renderer, scene, camera } = createEngine();
      
      // Setup the solar system geometry.
      const { sunPivot, earthPivot, earthSphere, sunSphere, moonSphere, sateliteSphere, earthRadius } = createSolarSystemGeometry({ scene });

      // Run the engine.
      runEngine({ renderer, scene, camera, sunPivot, earthPivot, earthSphere, sunSphere, moonSphere, sateliteSphere, earthRadius });
    }
  }
</script>