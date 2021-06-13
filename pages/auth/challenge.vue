<template>
  <div class="challenge-wrapper">
    <h1>Authenticating</h1>
    <p>Attemping to verify your Discord account in exchange for greater access.</p>
    <div v-if="loaded">
      <h2>Welcome {{this.username}}!</h2>
      <p>We value privacy so this session will be forgotten/discarded when you close your browser, if you wish to be remembered for convenience - click here: <a href="upgrade-session">upgrade session/remember me.</a></p>
      <img class="profile-image" src="" />
    </div>
    <div v-if="error">
      <h2>Error authenticating.</h2>
      {{error}}
    </div>
  </div>
</template>

<script>
  import Auth from '~/lib/auth/auth';
  import API from '../../lib/api/api';

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
          // Access the authorisation params provided by OAuth redirect.
          const fragment = new URLSearchParams(window.location.hash.slice(1));

          console.log(fragment.get('token_type'));

          // Guard against no token at all.
          if (!fragment.get('access_token')) throw new Error('No code passed.');

          // Put the token in session storage unless they specify remember me then -> local storage.
          Auth.setToken(fragment.get('access_token'));

          // Assert that it's actually valid.
          const me = await API.get_json('https://discord.com/api/users/@me');
          console.log(me);

          if (!me) throw new Error('Invalid user/token.');

          // Set the username for a visual feedback.
          console.log('valid user', me);
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