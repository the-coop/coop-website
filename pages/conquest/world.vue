<script>
  export default {
    components: {
      'Worldview': () => import('@/components/conquest/Worldview.vue')
    },
    layout: 'fullscreen',
    head() {
      return {
        title: 'Coop conquest'
      };
    },
    data() {
      return {
        tile: this.$nuxt.$route.query.tile
      }
    }
  }
</script>

<template>
  <client-only>
    <Worldview 
      :tile="tile" 
      :networking="true"
      :intro="false"
    />
  </client-only>
</template>