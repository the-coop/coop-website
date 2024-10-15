<template>
    <div>
        <Logo class="logo" />

        <slot></slot>
    </div>
</template>

<script setup>
  import Logo from '../components/Logo.vue';
</script>

<style scoped>
  .logo {
    width: 4em;
  }
</style>