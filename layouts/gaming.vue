<template>
  <div class="layout" ref="layout">
    <h1>TEST</h1>
    <slot></slot>
  </div>
</template>

<style scoped>
    .layout {
        position: absolute;
        top: 0;
        left: 0;
        height: 100dvh;
        width: 100vw;
        background: red;
    }
    h1 {
      color: white;
    }
</style>

<script>
  export default {
      name: 'Gaming'
  };
</script>
