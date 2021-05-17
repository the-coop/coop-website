<template>
  <div>
    <div class="header">
      <div class="brand">
        <Logo />
      </div>
      <nav class="navigation">
        <a href="/" class="nav-link current">Home</a>
        <a href="" target="_blank" class="nav-link">Apply</a>
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

  body {
    padding: 0 5em;
  }

  .header {
    display: flex;
    flex-direction: row;
    justify-content: space-between;
    align-items: center;
    padding: 2.5em 0;
  }

  .navigation {

  }

  .nav-link {
    color: #4a4a4a;
    margin-left: 3.5em;
    text-decoration: none;
  }

  .nav-link.current {
    color: white;
  }
</style>
