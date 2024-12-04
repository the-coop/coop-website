<template>
  <div class="start">
    <span class="startcta" @click="start">
      Start Game
    </span>
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
        if (!this.listening) return;

        const pressed = this?.gamepad?.buttons[0].pressed;
        if (pressed) {
          this.start();
          this.listening = false;
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
