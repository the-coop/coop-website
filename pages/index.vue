<template>
  <div class="page">
    <div class="hero">      
      <h1 class="title">WHAT IS THE COOP?</h1>

      <h2 class="subtitle">
        The Coop is a community and experiment, aiming to push the limits of what is possible.
      </h2>

      <div class="actions">
        <button class="button">Apply Now</button>
        <button class="button secondary">Know More</button>
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
    margin: 1rem 0;
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

    font-weight: 500;
    transition: background-color .2s,border .2s;
  }

  .button.secondary {
    background-color: transparent;
    color: #ff6565;
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
</style>
