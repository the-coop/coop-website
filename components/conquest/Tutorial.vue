<template>
  <div v-if="show" class="tutorial">
    <h1>Welcome!</h1>
    <h2>This is your Coopverse</h2>

    Logged in or not?
    <div></div>

    Spawned or not?
    <div></div>

    // Add the spawns to go to

    // If spawned attach camera to player perspective

    // Add collisions

    Guides page

    <button v-on:click="skipTutorial">Skip</button>
  </div>
</template>

<style scoped>
  .tutorial {
    position: absolute;
    top: 50%;
    right: 50%;
    transform: translate(50%, -50%);

    padding: 1em 2em;
    border-radius: .5em;

    background: rgba(255, 250, 250, 0.78);

    z-index: 2;
  }

  h1 {
    margin: 0;
  }

  h2 {
    margin: 0;
  }
</style>

<script>
  export default {
    props: ['show', 'skipTutorial'],
    async mounted() {}
  }
</script>