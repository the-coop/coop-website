<template>
  <div class="worldview">
    <h1 class="error-text" v-if="!WEBGL_SUPPORT && !silent">Loading error...</h1>
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

<script>
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
      // Used for shared state.
      window.CONQUEST = {

        // Deterministic time variable.
        timeIncrement: Date.now()
      };

      // Check if WebGL is supported.
      const canvas = document.createElement('canvas');
      this.WEBGL_SUPPORT = !!(
        window.WebGLRenderingContext && 
        (canvas.getContext('webgl') || canvas.getContext('experimental-webgl'))
      );;
    }

  }
</script>