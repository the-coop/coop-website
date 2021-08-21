<template>
  <div class="content-container">
    <h1 class="title">Subscribe to newsletter!</h1>

    <form @submit="ev => { ev.preventDefault(); alert('Work in progress 21/9/2021'); }">
      <div class="field">
        <label for="email">Email address</label>
        <input type="email" aria-autocomplete="email" />
      </div>

      <button type="submit" >Subscribe</button>
    </form>

  </div>
  <!-- <nuxt-content :document="page" /> -->
</template>

<script>
  export default {
    // async asyncData({ $axios }) {
    //   const resp = await $axios.get('/path/to/example.md');
    //   const page = await blogParser(resp.data);

    //   return { page };
    // }
  }
</script>