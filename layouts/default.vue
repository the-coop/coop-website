<template>
  <div class="default">
    <div class="header">
      <div class="brand">
        <Logo />
      </div>
      <nav class="navigation">
        <NuxtLink to="/" class="nav-link current">
          Home
        </NuxtLink>
        <a href="https://discord.gg/2gTTUZbRVD" target="_blank" class="nav-link">Apply</a>
      </nav>
    </div>
    <Nuxt />
  </div>
</template>

<style>
  body, html {
    font-family: Poppins, sans-serif;
    background-color: #111;
  }

  .default {
    padding: 0 5em;
  }

  .header {
    display: flex;
    flex-direction: row;
    justify-content: space-between;
    align-items: center;
    padding: 2.5em 0;
  }

  .navigation {}

  .nav-link {
    color: #4a4a4a;
    margin-left: 3.5em;
    text-decoration: none;
  }

  .nav-link:hover {
    color: white;
  }

  .nav-link.current {
    color: white;
  }
</style>
