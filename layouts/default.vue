<template>
  <div class="layout">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />
    <nav v-if="$route.name !== 'game'" class="nav">
      <Logo class="logo" />
    </nav>
    <main class="main">
      <slot></slot>
    </main>
  </div>
</template>

<script setup>
  import Logo from '../components/Logo.vue';
</script>

<style scoped>
  html, body {
    height: 100%;
    margin: 0;
    padding: 0;
  }

  .layout {
    min-height: 100vh;
    background: #000;
    color: white;
  }

  .nav {
    display: flex;
    flex-direction: column;
    align-items: center;
    flex: 0 0 auto;
    padding: 1.2em;
    background: rgba(0, 0, 0, 0.8);
  }

  .logo {
    width: 3em;
  }

  .main {
    position: relative;
    height: 100%;
    display: flex;
    flex-direction: column;
  }
</style>