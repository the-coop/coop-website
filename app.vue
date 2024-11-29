<template>
  <NuxtLayout :name="layout">
    <NuxtPage />
  </NuxtLayout>
</template>

<script setup>
import { useLayout } from '~/composables/useLayout'
import { computed } from 'vue'

const { layoutName } = useLayout()

const layout = computed(() => layoutName.value)
</script>

<!-- TODO: Check if logged in / load profile from token. -->

<style>
  body, html {
    margin: 0;
    padding: 0;
    background-color: #282c34;
    font-family: 'Manrope', sans-serif;
  }
  
  h1 {
    font-family: 'Protest Strike', sans-serif;
  }

  a {
    text-decoration: none;
    color: inherit;
  }
</style>