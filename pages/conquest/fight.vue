<template>
  <client-only><FightGame /></client-only>
</template>

<script>
  export default {
    components: {
      'FightGame': () => {
        if (process.client)
          return import('~/components/conquest/FightGame.vue');
      }
    },
    layout: 'fullscreen'
  }
</script>

<style scoped></style>