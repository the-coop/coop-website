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

  // Render cubes for other people
  // Add move (arrows) + WASD.
  // Extra
  // Load the profile picture for the user if they're logged in.
  
<template>
  <!-- Load map -->
  <client-only><Groundlevel :tile="tile" /></client-only>
</template>