<template>
  <div class="layout">
    <Logo class="logo" />
    <h1 v-if="title" class="page-title">{{ title }}</h1>
    <div class="content">
      <slot></slot>
    </div>
  </div>
</template>

<script setup>
  import Logo from '../components/Logo.vue';

  defineProps({
    title: {
      type: String,
      default: ''
    }
  });
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
    z-index: 10;
  }

  .page-title {
    color: white;
    font-size: 3em;
    margin: 0 0 0.5em;
    text-shadow: 0 0 10px rgba(255, 204, 0, 0.5);
  }

  .content {
    flex: 1;
    width: 100%;
    position: relative;
  }
</style>