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
  <client-only placeholder="Loading conquest map...">
    <Worldview />
  </client-only>
</template>