<template>
  <div class="start">
    <span class="startcta" @click="start">
      <span v-if="!gamepad">Start Game</span>
      <span v-if="gamepad">Press Button</span>
    </span>

    <!-- Display connected gamepad -->
    <div v-if="gamepad" class="gamepad-info">
      <h3>Connected Controller:</h3>
      <div>
        Type: {{ gamepad.type || 'Unknown' }}
        <br>
        Buttons pressed: {{ gamepad.buttons?.filter(btn => btn.pressed).length || 0 }}
      </div>
    </div>
  </div>
</template>

<script>
  export default {
    name: 'Start',
    props: {
      gamepad: { type: Object, default: null },
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
        if (!this.listening || !this.gamepad) return;

        const buttons = this?.gamepad?.buttons;

        // Check buttons 0 (A/Cross) and 2 (X/Square)
        if (buttons?.[0].pressed || buttons?.[2].pressed) {
          this.start();
          this.listening = false;
          return;
        }

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
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    color: white;
    z-index: 1;
    background: rgba(0, 0, 0, 0.8);
  }

  .startcta {
    cursor: pointer;
    font-size: 2em;
    padding: 1em 2em;
    border: .1em solid white;
    border-radius: .4em;
    transition: all 0.2s ease;
  }

  .startcta:hover {
    background: white;
    color: black;
  }

  .gamepad-info {
    margin-top: 2em;
    text-align: center;
  }
</style>
