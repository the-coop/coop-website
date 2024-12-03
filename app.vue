<template>
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
</template>

<style>
  body, html {
    margin: 0;
    padding: 0;
    background-color: #282c34;
    font-family: 'Manrope', sans-serif;
    height: 100%;
    width: 100%;
    /* Removed overflow: hidden; to prevent breaking other pages */
  }
  
  #app {
    height: 100%;
    width: 100%;
  }
  
  a {
    text-decoration: none;
    color: inherit;
  }
</style>