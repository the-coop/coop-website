<template>
  <div class="content-container">
    <!-- TODO: Swap for success title. -->
    <h1 v-if="!success" class="title">Unsubscribe 😞</h1>
    <h1 v-if="success" class="title">See, successfully unsubscribed!</h1>

    <div v-if="success">
      <p>You successfully unsubscribed to The Coop Community. 🐔</p>
      <p class="note">
        You can <NuxtLink class="link" to="/blog/subscribe">subscribe again</NuxtLink> any time to 1 Newsletter email a month.
      </p>
    </div>

    <form v-if="!success" @submit="unsubscribe">
      <div class="field">
        <label for="email">Email address</label>
        <input 
          type="email" aria-autocomplete="email" 
          v-model="email"
        />
      </div>

      <button class="button only-action" type="submit">Unsubscribe</button>
    </form>

  </div>
</template>

<script>
  import API from '~/lib/api/api';

  // Acts as a way to subscribe OR update email address.
  export default {
    data() {
      return {
        email: null,
        success: false
      }
    },
    methods: {
      async unsubscribe(ev) {
        ev.preventDefault();

        // Access state field value.
        const resp = await this.$axios.post(API.BASE_URL + 'blog/unsubscribe', { email: this.email });
        const data = resp.data;

        // Provide feedback.
        if (data.success)
          this.success = true;
      }
    }
  }
</script>