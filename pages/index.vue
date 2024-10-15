<template>
  <div class="index">
    <NuxtLink to="/game" class="cta">Play Game</NuxtLink>
  </div>
</template>

<style scoped>
  .index {
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    min-height: 100vh;
    color: #fff;
  }

  .cta:hover {
    box-shadow: 0 0 20px rgba(255, 255, 255, 0.5);
    transform: scale(1.05);
  }
</style>

