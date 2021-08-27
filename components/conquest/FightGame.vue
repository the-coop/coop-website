<template>
  <div class="fightgame-wrapper">
    <div class="fightgame" />
    <div class="ui">
      WASD to move
    </div>
  </div>
</template>

<style>
  .fightgame-wrapper {
    width: 100vw;
    height: 100vh;
    overflow: hidden;
  }
  .fightgame {
    width: 100%;
    height: 100%;

    position: absolute;
    top: 0;
    left: 0;
    z-index: -1;
  }
</style>

<script>
  import bootstrapFight from '~/lib/conquest/fight/bootstrapFight';

  export default {
    name: 'FightGame',
    methods: {},
    async mounted() {
      console.log('Fight game should start.');

      // Bootstrap the fight game engine:
      bootstrapFight();
    }
  }
</script> 