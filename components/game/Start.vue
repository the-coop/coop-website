<template>
  <div class="start">
    <span @click="start">Click to Play</span>

    <!-- Display connected gamepads -->
    <div v-if="gamepads.length">
      <h3>Connected Gamepads:</h3>
      <div v-for="(gp, index) in gamepads" :key="index">
        {{ gp.id }} - {{ gp.buttons.filter(btn => btn.pressed).length }} buttons pressed
      </div>
    </div>
  </div>
</template>

<script>
  export default {
    name: 'Start',
    props: {
      gamepads: { type: Array, default: () => [] },
      start: { type: Function, required: true }
    },
    data() {
      return {
        listening: false
      };
    },
    mounted() {
      this.listening = true;
      this.listen();
    },
    methods: {
      listen() {
        // Flag for stopping/cleaning up.
        if (!this.listening) return;

        // Check gamepads for button presses.
        navigator.getGamepads().map(gp => {
          if (gp && gp.buttons.some(button => button.pressed)) {
            console.log(button, button.pressed);

            this.start();
            this.listening = false;
          }
        });

        requestAnimationFrame(this.listen);
      }
    },
    unmounted() {
      this.listening = false;
    },
  };
</script>

<style scoped>
  .start {

  }
</style>
