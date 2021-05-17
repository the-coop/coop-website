<template>
  <div class="page">
    <div class="hero">      
      <h1 class="title">WHAT IS THE COOP?</h1>

      <h2 class="subtitle">
        The Coop is a community and experiment, aiming to push the limits of what is possible.
      </h2>

      <div class="actions">
        <a href="https://discord.gg/2gTTUZbRVD" target="_blank" class="button">Apply Now</a>
      </div>
    </div>

    <Logo class="decoration" />
  </div>
</template>

<script>
  // import Vue from 'vue'
  // export default Vue.extend({})
</script>

<style>
  .hero {
    margin: 3rem 0;
  }

  .hero > * {
    margin: 2rem 0;
  }

  .hero .title {
    color: #4a4a4a;
    font-size: clamp(18px,4vw,20px);
    font-weight: 500;
  }

  .hero .subtitle {
    color: #fefefe;
    font-size: clamp(26px, 4vw, 40px);
    font-weight: 600;
    line-height: 150%;

    width: 50vw;
  }

  .actions {
    margin-top: 3rem;
  }

  .actions .button {
    margin-right: 1.5em;
  }

  .actions .button:last-child {
    margin-right: 0;
  }

  .button {
    padding: .75em 2.5rem;

    cursor: pointer;

    background-color: #ff6565;
    border: .125em solid #ff6565;
    color: #fefefe;

    font-size: 1.15em;
    text-decoration: none;

    font-weight: 500;
    transition: background-color .2s;
  }

  .button:hover {
    background-color: transparent;
  }

  .button.secondary {
    background-color: transparent;
    color: #ff6565;
  }

  .button.secondary:hover {
    background-color: #ff6565;
    color: white;
  }

  .decoration {
    position: absolute;
    z-index: 0;
    right: 3em;
    bottom: 3em;
    width: 15em;
    height: 15em;
    transform: scaleX(-1);
    opacity: .2;
  }

  .decoration .beak {
    animation-duration: 3s;
    animation-name: moveMouth;
    /* animation-direction: alternate-reverse; */
    animation-iteration-count: infinite;
  }

  .decoration .beard {
    animation-duration: 3s;
    animation-name: moveWeirdChickenBeard;
    /* animation-direction: alternate-reverse; */
    animation-iteration-count: infinite;
  }

  @keyframes moveMouth {
    from {
      transform: translateX(0);
    }

    to {
      transform: translateX(5px);
    }
  }

  @keyframes moveWeirdChickenBeard {
    from {
      transform: translateY(0);
    }

    to {
      transform: translateY(5px);
    }
  }
</style>
