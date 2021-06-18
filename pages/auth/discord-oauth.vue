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
  import API from '~/lib/api/api';
  import Auth from '~/lib/auth/auth';

  export default {
    middleware: 'guest',
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
          // Extract code from oauth redirect.
          const params = new URLSearchParams(window.location.search);
          const code = params.get('code');

          // TODO: Do state comparison to prevent against CSRF

          // Exchange grant token with access token to validate identity.
          // const authResponse = await API.post('auth/access-discord', { code });
          // const data = authResponse.data || null;
          // if (!data) throw new Error('No data returned.');

          const loginAttempt = await this.$auth.loginWith('local', { data: { code } });
          console.log(loginAttempt);
          console.log(loginAttempt.data);

          // Access/check for token within response.
          const token = data.token || null;
          if (!token) throw new Error('No token returned.');

          // Put the token in session storage unless they specify remember me then -> local storage.
          Auth.setToken(token);

          // Attempt to set token globally for axios.
          API.configureAxiosIncludeAuthGlobally(token);

          // Set the username for a visual feedback.
          this.username = data.user.username;

          // Set as loaded.
          this.loaded = true;

          // Set the user to nuxt auth/local memory.
          this.$auth.setUser(data.user);
          // this.$auth.setUserToken(data.token);

        } catch(e) {
          this.error = e.message;
        }
      }
    }
  }
</script>