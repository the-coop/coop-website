<template>
  <div class="page home">
    <div class="hero">      
      <h1 class="title">WHAT IS THE COOP?</h1>

      <h2 class="subtitle">
        The Coop is a <strong>discord server</strong> community that focuses on business, design, and programming. In our <strong>free and democratic</strong> system, you make the decisions!
      </h2>

      <div class="actions">
        <a href="https://discord.gg/2gTTUZbRVD" target="_blank" class="button">Apply Now</a>
      </div>
    </div>

    <Logo class="decoration" />

    <client-only><Worldview :silent="true" /></client-only>
  </div>
</template>

<script>
  export default {
    components: {
      'Worldview': () => import('@/components/conquest/Worldview.vue')
    }
  }
</script>

<style>
  .hero {
    margin: 3rem 0;
    z-index: 1;
  }

  .hero > * {
    margin: 2rem 0;
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

  .page.home .worldview.loaded {
    position: absolute;
    top: 0;
    left: 0;

    z-index: -1;

    opacity: .125;
  }

  .decoration {
    position: absolute;
    z-index: 0;
    right: 3em;
    bottom: 3em;
    width: 26em;
    height: 23em;
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
