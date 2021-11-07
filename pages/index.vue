<template>
  <div>
    <div class="page home">
      <div class="hero">
        <h1 class="title">WHAT IS THE COOP?</h1>

        <h2 class="subtitle">
          The Coop <strong>discord server</strong> community supports those dedicated to business&amp;/design&amp;/programming (single/combination). We move the Earth and Moon for our <strong>free and democratic</strong> system.
        </h2>

        <div class="actions">
          <a href="https://fund-the-coop.raisely.com" target="_blank" class="button">Donate</a>
          <a v-show="!$auth.$state.loggedIn" href="https://discord.gg/dgexRwFCkc" target="_blank" class="button">Join</a>
        </div>
      </div>

      <div class="advertisement">
        <h2>Do you want to advertise here?</h2>
        <p>We hope not, it isn't supported yet!</p>
      </div>

      <client-only>
        <!-- TODO: Append after timeout. -->
        <Worldview :silent="true" />
      </client-only>
    </div>
  </div>
</template>

<script>
  import API from '~/lib/api/api';

  export default {
    components: {
      'Worldview': () => import('@/components/conquest/Worldview.vue')
    },
    // data({ posts }) {
    //   return { posts }
    // },
    // async mounted() {
    //   const projectsResp = await fetch(API.BASE_URL + 'blog');
    //   const posts = await projectsResp.json();
    //   this.posts = posts;
    //   return { posts };
    // }
    // async asyncData() {

    // }
  }
</script>

<style>
  .home {
    display: flex;
    flex-direction: column;
    justify-content: space-between;
  }

  .hero {
    z-index: 1;
  }

  .advertisement {
    margin-top: 2rem;
    color: silver;
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
    position: fixed;
    top: 0;
    left: 0;

    z-index: -1;

    opacity: .125;
  }

  @media screen and (min-width: 850px) {
    .home {
      flex-direction: row;
      justify-content: space-between;
    }
  }
</style>
