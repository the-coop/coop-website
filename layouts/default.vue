<template>
  <div class="layout">
    <Logo class="logo" />
    <div class="content">
      <slot></slot>
    </div>
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
    /* min-height: 100vh; */
  }

  .logo {
    width: 6em;
    margin-bottom: 1.25em;
    z-index: 10;
  }

  .content {
    flex: 1;
    width: 100%;
    position: relative;
  }
</style>