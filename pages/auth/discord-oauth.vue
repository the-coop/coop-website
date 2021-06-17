<template>
  <div class="challenge-wrapper content-container">
    <div v-if="!loaded && !error">
      <h1 class="title">Authenticating</h1>
      <p>Attemping to verify your Discord account in exchange for greater access.</p>
    </div>

    <h1 v-if="loaded && !error">
      <h2 class="subtitle">Welcome {{this.username}}!</h2>
      <img class="profile-image" src="" />
    </h1>

    <div v-if="error">
      <h2 class="title">Error authenticating.</h2>
      {{error}}
    </div>
  </div>
</template>

<script>
  import Auth from '~/lib/auth/auth';

  export default {
    mounted() {
      // Attempt to authenticate, this page should only be arrived at during auth process.
      this.authenticate();
    },
    data() {
      return {
        username: null,
        loaded: false,
        error: null
      }
    },
    methods: {
      async authenticate() {
        try {
          // This is all outdated bullshit now, all I need to do is
          // Access the code from URL and post it securely to our API
          // in return for a token
          






          // Access the authorisation params provided by OAuth redirect.
          const fragment = new URLSearchParams(window.location.hash.slice(1));

          // Guard against no token at all.
          if (!fragment.get('access_token')) throw new Error('No code passed.');

          // Put the token in session storage unless they specify remember me then -> local storage.
          Auth.setToken(fragment.get('access_token'));

          // Assert that it's actually valid.
          const me = await Auth._me();
          if (!me) throw new Error('Invalid user/token.');

          // Set the username for a visual feedback.
          this.username = me.username;

          // Set as loaded.
          this.loaded = true;

        } catch(e) {
          this.error = e.message;
        }
      }
    }
  }
</script>