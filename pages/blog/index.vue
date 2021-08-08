<template>
  <div class="page blog">
    <div class="hero">      
      <h1 class="title">Our blog will be launching here!</h1>
      <p>Stay tuned! Join our newsletter here... (when link is added ;))</p>
    </div>

    <!-- <nuxt-content :document="page" /> -->
  </div>
</template>

<script>
  import blogParser from '~/lib/blog/blogParser';

  export default {
    // async asyncData({ $axios }) {
    //   const resp = await $axios.get('/path/to/example.md');
    //   const page = await blogParser(resp.data);

    //   return { page };
    // }
  }
</script>