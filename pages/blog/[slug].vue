<template>
  <div class="content-container">
    <h1 class="title">Blog</h1>
    <h5>Our blog will be launching here!</h5>
    <p>Stay tuned! Join our newsletter here... (when link is added ;))</p>
  </div>
  <!-- <nuxt-content :document="page" /> -->
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