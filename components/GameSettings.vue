<template>
  <div class="ui">
    <h2>Settings</h2>
    <button @click="$emit('close')">Close</button>
  </div>
</template>

<script setup>
defineEmits(['close'])
</script>

<style scoped>
.ui {
  position: fixed;
  inset: 50% auto auto 50%;
  transform: translate(-50%, -50%);
  background: #000;
  color: #fff;
  padding: 1rem;
  border: 1px solid #fff;
}
</style>
