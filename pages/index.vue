<template>
  <div class="page home">
    <div class="hero">      
      <h1 class="title">WHAT IS THE COOP?</h1>

      <h2 class="subtitle">
        The Coop <strong>discord server</strong> community supports those dedicated to business&amp;/design&amp;/programming (single/combination). We move the Earth and Moon for our <strong>free and democratic</strong> system.
      </h2>

      <div class="actions">
        <a href="https://opencollective.com/the-coop" target="_blank" class="button">Donate</a>
        <a v-show="!$auth.$state.loggedIn" href="https://discord.gg/2gTTUZbRVD" target="_blank" class="button">Join</a>
      </div>
    </div>

    <client-only>
      <!-- TODO: Append after timeout. -->
      <Worldview :silent="true" />
    </client-only>
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
    z-index: 1;
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

  .page.home .worldview {
    position: absolute;
    top: 0;
    left: 0;

    z-index: -1;

    opacity: .125;
  }


  @keyframes moveMouth {
    from { transform: translateX(0); }
    to { transform: translateX(5px); }
  }

  @keyframes moveWeirdChickenBeard {
    from { transform: translateY(0); }
    to { transform: translateY(5px); }
  }
</style>
