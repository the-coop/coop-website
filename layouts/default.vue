<template>
  <div class="layout">
    <nav class="nav" :class="{ 'nav--hidden': $route.name === 'game' }">
      <Logo class="logo" />
    </nav>
    <main class="main" :class="{ 'main--fullscreen': $route.name === 'game' }">
      <slot></slot>
    </main>
  </div>
</template>

<script setup>
  import Logo from '../components/Logo.vue';
</script>

<style scoped>
  /* Ensure html and body occupy full height and have no margins */
  html, body {
    height: 100%;
    margin: 0;
    padding: 0;
  }

  .layout {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    background: #000;
    color: white;
    overflow: hidden;
  }

  .nav {
    flex: 0 0 auto;
    padding: 20px;
    display: flex;
    flex-direction: column;
    align-items: center;
    background: rgba(0, 0, 0, 0.8);
  }

  .logo {
    width: 3em;
  }

  .main {
    flex: 1;
    position: relative;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  .nav--hidden {
    display: none;
  }

  .main--fullscreen {
    height: 100vh;
  }
</style>