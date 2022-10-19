<template>
  <div class="challenge-wrapper content-container">
    <div v-if="!loaded && !error">
      <h1 class="title">Authenticating</h1>
      <p class="text">Attemping to verify your Discord account in exchange for greater access.</p>
    </div>

    <div v-if="error">
      <h2 class="title">Error authenticating.</h2>
      <p class="text">{{ error }}</p>
    </div>
  </div>
</template>

<style scoped>
  .text {
    color: #ff6565;
  }
</style>

<script>
  import API from '~/lib/api/api';
  import UserAPI from '~/lib/api/userAPI';

  export default {
    // middleware: 'guest',
    mounted() {
      // Attempt to authenticate, this page should only be arrived at during auth process.
      this.authenticate();
    },
    data() {
      return {
        loaded: false,
        error: null
      }
    },
    methods: {
      async authenticate() {
        const params = new URLSearchParams(window.location.search);

        // Extract code from oauth redirect.
        const code = params.get('code');
        const method = params.get('method') || 'discord_oauth';
        const state = params.get('state');

        // If the user is not already logged in.
        if (!this.$auth.$state.loggedIn)
          await this.login(code, method);

        // If known state redirect there, otherwise go to home.
        switch (state) {
          case 'game':
            this.$router.push('/conquest/world');
            break;

          default: 
            this.$router.push('/');
        }
      },
      async login(code, method) {
        try {
          // Clear the messy codes in URL/router state.
          this.$router.replace({ query: null });

          // Exchange grant token with access token to validate identity.
          const loginAttempt = await this.$auth.loginWith('local', { data: { code, method } });
          const data = loginAttempt.data || null;
          if (!data) throw new Error('No data returned.');

          // Access/check for token within response.
          const token = data.token || null;
          if (!token) throw new Error('Could not verify you have an account in The Coop. Try joining via the 🥚 Community menu?');

          // Load additional data from our API, not just Discord (may be able to collapse/optimise later)
          const user = await UserAPI.me(this.$auth);

          // Set the user to nuxt auth/local memory.
          this.$auth.setUser(user);

          // Update the header immediately on login.
          this.$nuxt.$emit('user_updated', user);

          // Set as loaded.
          this.loaded = true;

        } catch(e) {
          this.error = e.message;
          
          console.log('Login error');
          console.error(e);
        }
      }
    }
  }
</script>
