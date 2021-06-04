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
