<template>
  <div class="layout">
    <nav v-if="$route.name !== 'game'" class="nav">
      <Logo class="logo" />
    </nav>

    <slot></slot>
  </div>
</template>

<script setup>
  import Logo from '../components/Logo.vue';
</script>

<style scoped>
  .layout {
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
    width: 5em;
  }
</style>