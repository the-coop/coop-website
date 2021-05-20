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
    }
  }
</script>

<template>
  <!-- Load map -->
  <client-only><Worldview /></client-only>
</template>