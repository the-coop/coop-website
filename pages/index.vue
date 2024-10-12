<template>
  <div class="index">
    <div class="text">
      <h1 class="title">What, The<br /> Actual Flock?</h1>
      <div class="brand">
        <h2 class="subtitle">Yes, We're</h2>
        <Logo class="logo" />
      </div>
      <p>We came to peck seeds and kick ass and we're all outta seeds.</p>
    </div>
    <div class="ctas">
      <NuxtLink to="/game" class="cta">Play Game</NuxtLink>
      <NuxtLink to="/home" class="cta">General Website</NuxtLink>
    </div>
  </div>
</template>

<script setup>
  import Logo from '../components/Logo.vue';
</script>

<style scoped>
  .index {
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    min-height: 100vh;
    color: #fff;
  }

  .text {
    margin: 2em;
    padding: 2em;
    border: 3px solid rgba(255, 255, 255, 0.8);
    border-radius: 15px;
    background: rgba(0, 0, 0, 0.6);
    box-shadow: 0 0 20px rgba(255, 255, 255, 0.5);
    backdrop-filter: blur(10px);

    background: linear-gradient(
      to bottom,
      #ff69b4,
      #ffa500,
      #ffd700,
      #40e0d0
      );
  }

  .title {
    font-family: 'Protest Strike', sans-serif;
    font-size: 5em;
    margin: 0;
    color: #fff;
    text-shadow: 0 0 10px rgba(0, 0, 0, 0.5);
  }

  .subtitle {
    color: #fff;
    margin: 0;
    font-size: 1.5em;
    text-shadow: 0 0 5px rgba(0, 0, 0, 0.5);
  }

  .brand {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 1em;
    margin-top: 1em;
  }

  .logo {
    width: 4em;
    filter: drop-shadow(0 0 5px rgba(0, 0, 0, 0.5));
  }

  .ctas {
    display: flex;
    gap: 2em;
    margin-top: 2em;
  }

  .cta {
    display: block;
    background: rgba(0, 0, 0, 0.6);
    color: #fff;
    font-family: 'Manrope', sans-serif;
    padding: 0.5em 1em;
    font-size: 1.5em;
    text-decoration: none;
    border: 2px solid #fff;
    border-radius: 25px;
    transition: all 0.3s ease;
    position: relative;
    overflow: hidden;
    backdrop-filter: blur(5px);

    background: linear-gradient(
      to bottom,
      #ff69b4,
      #ffa500,
      #ffd700,
      #40e0d0
      );
  }

  .cta::before {
    content: '';
    position: absolute;
    top: 0;
    left: -100%;
    width: 100%;
    height: 100%;
    background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.3), transparent);
    transition: all 0.4s;
  }

  .cta:hover::before {
    left: 100%;
  }

  .cta-play {
    background: rgba(255, 255, 255, 0.2);
  }

  .cta-website {
    background: rgba(0, 0, 0, 0.4);
  }

  .cta:hover {
    box-shadow: 0 0 20px rgba(255, 255, 255, 0.5);
    transform: scale(1.05);
  }
</style>

