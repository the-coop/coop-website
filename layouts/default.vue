<template>
  <div class="layout">
    <Logo class="logo" />
    <slot></slot>
  </div>
</template>

<script setup>
  import Logo from '../components/Logo.vue';
</script>

<style scoped>
  .layout {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 1.25em;
    color: #fff;
  }

  .logo {
    width: 6em;
    margin-bottom: 1.25em;
  }
</style>