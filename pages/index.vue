<template>
  <div class="index">
    <h1>Welcome to The Coop!</h1>
    <p>The Coop is an open-source web3 game project. Join us and contribute to our open-source project.</p>
    <div class="cta-container">
      <NuxtLink to="/game" class="cta">Play Game</NuxtLink>
      <a href="https://discord.gg/thecoop" target="_blank" class="cta">Join Our Discord</a>
    </div>
  </div>
</template>

<style scoped>
  .index {
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    color: #fff;
    text-align: center;
    padding: 1.25em;
    gap: 1.25em;
  }

  h1 {
    font-size: 2.5em;
    margin-bottom: 0.625em;
  }

  p {
    font-size: 1.2em;
    margin-bottom: 0.625em;
    line-height: 1.6;
  }

  .cta-container {
    display: flex;
    gap: 1.25em;
    margin-top: 1.25em;
  }

  .cta {
    padding: 0.625em 1.25em;
    background-color: #ffcc00;
    color: #000;
    text-decoration: none;
    border-radius: 0.3125em;
    transition: transform 0.3s, box-shadow 0.3s;
  }

  .cta:hover {
    box-shadow: 0 0 1.25em rgba(255, 255, 255, 0.5);
    transform: scale(1.05);
  }
</style>

