<script>
  export default {
    components: {
      'Groundview': () => import('@/components/conquest/Groundview.vue')
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
  <client-only><Groundview :tile="tile" /></client-only>
</template>