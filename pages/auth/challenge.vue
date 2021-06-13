<template>
  <div class="challenge-wrapper">
    <h1>Authenticating</h1>
    <p>Attemping to verify your Discord account in exchange for greater access.</p>
    <div v-if="loaded">
      <h2>Welcome ?!</h2>
      <img class="profile-image" src="" />
    </div>
  </div>
</template>

<script>
  const API_GET_JSON = async (url) => {
    const response = await fetch(url, { headers: { authorization: window.authorization }});
    const result = await response.json();
    return result;
  }

  export default {
    mounted() {
      this.authenticate();
    },
    data() {
      return {
        loaded: false
      }
    },
    methods: {
       async authenticate() {
        let error = null;

        const fragment = new URLSearchParams(window.location.hash.slice(1));
        const [ accessToken, tokenType ] = [fragment.get('access_token'), fragment.get('token_type')];
        window.authorization = `${tokenType} ${accessToken}`;

        // Exchange with Discord OAuth service for access token with data.


        // Store globally.
        

        // Put the token in session storage unless they specify remember me then -> local storage.
        // TODO: ^

        if (!accessToken) error = 'No code passed.';

        try {
          const result = await API_GET_JSON('https://discord.com/api/users/@me');

          console.log(result);

          const { username, discriminator } = result;

          console.log(username, discriminator);
          this.loaded = true;

        } catch(e) {
          error = e.message;
        }

        // If attempt failed
        if (error) {
          // Show error box and message.
        }
      }
    }
  }
</script>