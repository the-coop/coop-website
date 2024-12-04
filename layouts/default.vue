<template>
  <div class="layout">
    <nav class="nav">
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
  .layout {
    min-height: 100vh;
    background: #000;
    color: white;
  }

  .nav {
    padding: 20px;
    display: flex;
    flex-direction: column;
    align-items: center;
    background: rgba(0, 0, 0, 0.8);
  }

  .logo {
    width: 100px;
    height: auto;
  }

  .main {
    padding: 20px;
  }
</style>