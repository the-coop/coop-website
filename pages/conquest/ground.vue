<script>
  export default {
    components: {
      'Groundlevel': () => import('@/components/conquest/GroundLevel.vue')
    },
    layout: 'fullscreen',
    head() {
      return {
        title: 'Coop Conquest: Ground Level'
      }
    },
    data() {
      return {
        tile: this.$nuxt.$route.query.tile
      }
    }
  }
</script>
  
<template>
  <!-- Load map -->
  <client-only><Groundlevel :tile="tile" /></client-only>
</template>