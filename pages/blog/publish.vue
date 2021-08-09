<template>
  <div class="content-container">
    <h1 class="title">Publish</h1>
    <textarea id="content"></textarea>
    <button>Post</button>
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