<template>
    <div class="fullscreen">
        <slot></slot>
    </div>
</template>

<style scoped>
  body {
    height: 100dvh;
    width: 100dvw;
  }
  canvas {
    display: block;
    height: 100%;
    width: 100%;
  }
  .fullscreen {
    
  }
</style>