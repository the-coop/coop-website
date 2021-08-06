<template>
  <div class="fightgame-wrapper">
    <div class="fightgame" />
    <div class="ui"></div>
  </div>
</template>

<style>
  .fightgame {
    width: 100vw;
    height: 100vh;

    position: absolute;
    top: 0;
    left: 0;
    z-index: -1;
  }
</style>

<script>
  export default {
    name: 'Fightgame',
    props: {
      tile: {
        type: String,
        default: null
      }
    },
    methods: {},
    async mounted() {
      alert('Fight game should start.')
    }
  }
</script> 