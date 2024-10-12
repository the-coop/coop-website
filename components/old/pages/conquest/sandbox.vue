<script>
  export default {
    components: {
      'Sandbox': () => import('@/components/conquest/Sandbox.vue')
    },
    layout: 'fullscreen',
    head() {
      return {
        title: 'Coop sandbox'
      };
    }
  }
</script>

<template>
  <client-only>
    <Sandbox />
  </client-only>
</template>
