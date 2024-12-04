<template>
  <div class="start">
    <span @click="$emit('start')">Click to Play</span>
  </div>
</template>

<script>
  export default {
    name: 'Start',
  };
</script>

<style scoped>
  .start {

  }
</style>
