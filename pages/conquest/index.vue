<script>
  export default {
    components: {
      'Worldview': () => import('@/components/conquest/Worldview.vue')
    },
    layout: 'fullscreen',
    head() {
      return {
        title: 'Coop conquest',
        script: [
          { hid: '3js', src: 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js', defer: true }
        ]
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