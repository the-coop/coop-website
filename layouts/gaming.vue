<template>
  <div class="layout" ref="layout">
    <slot></slot>
  </div>
</template>

<style scoped>
  html, body {
    margin: 0;
    padding: 0;
  }

  .layout {
    position: absolute;
    height: 100dvh;
    width: 100vw;
  }
</style>
