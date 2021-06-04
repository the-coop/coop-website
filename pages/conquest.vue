<script>
  export default {
    components: {
      'Worldview': () => import('@/components/conquest/Worldview.vue')
    },
    layout: 'fullscreen',
    head() {
      return {
        title: 'Coop conquest'
      }
    },
    data() {
      return {
        tile: this.$nuxt.$route.query.tile
      }
    },
    mounted() {
      console.log(this.tile);
    }
  }
</script>

<template>
  <!-- Load map -->
  <client-only><Worldview :tile="tile" /></client-only>
</template>