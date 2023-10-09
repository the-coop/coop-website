<template>
    <client-only>
        <Connect />
    </client-only>
</template>

<script>
  export default {
    components: {
      'Connect': () => import('@/components/crypto/Connect.vue')
    },
    layout: 'fullscreen',
    head() {
      return {
        title: 'Coop Economy Connect'
      }
    },
    data() {
      return {

      }
    }
  }
</script>