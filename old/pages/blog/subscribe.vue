<template>
  <div class="content-container">
    <!-- TODO: Swap for success title. -->
    <h1 v-if="!success" class="title">Subscribe to newsletter!</h1>
    <h1 v-if="success" class="title">See, successfully subscribed!</h1>

    <div v-if="success">
      <p>You successfully subscribed to The Coop Community. 🐔</p>
      <p class="note">
        Default: You will only receive 1 email a month unless you opt for more emails. You can quickly 
        <NuxtLink class="link" to="/blog/unsubscribe">unsubscribe any time.</NuxtLink>
      </p>
    </div>

    <form v-if="!success" @submit="subscribe">
      <div class="field">
        <label for="email">Email address</label>
        <input 
          type="email" aria-autocomplete="email" 
          v-model="email"
        />
      </div>

      <button class="button only-action" type="submit" >Subscribe</button>
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
      async subscribe(ev) {
        ev.preventDefault();

        // Access state field value.
        const resp = await this.$axios.post(API.BASE_URL + 'blog/subscribe', { email: this.email });
        const data = resp.data;

        // Provide feedback.
        if (data.success)
          this.success = true;
      }
    }
  }
</script>