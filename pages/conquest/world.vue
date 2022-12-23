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
      const newUser = !localStorage.getItem('previous-visit');

      // Persist visit data to prevent showing intro again.
      localStorage.setItem('previous-visit', true);

      return {
        tile: this.$nuxt.$route.query.tile,
        newUser
      }
    }
  }
</script>

<template>
  <client-only>
    <Worldview 
      :tile="tile" 
      :networking="true"
      :intro="newUser"
    />
  </client-only>
</template>
