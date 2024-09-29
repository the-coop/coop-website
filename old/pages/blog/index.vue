<template>
  <div class="content-container page-wrapper">
    <h1 class="title">🗞️ Blog</h1>

    <p class="note">Thanks for checking out our blog, you'll find out <NuxtLink class="link" to="/blog/subscribe">subscribe-worthy</NuxtLink> latest headlines below! 🤓</p>

    <PostsList :posts="posts" />

    <p class="note">
      If you would like an email when a post is added, 
      <NuxtLink class="link" to="/blog/subscribe">please subscribe.</NuxtLink>
    </p>
  </div>
</template>

<style scoped>
</style>

<script>
  import API from '~/lib/api/api';
  import PostsList from '~/components/blog/PostsList.vue';

  export default {
    components: { PostsList },
    data() {
      return { 
        posts: []
      }
    },
    async mounted() {
      const projectsResp = await fetch(API.BASE_URL + 'blog');
      this.posts = await projectsResp.json();
    }
  }
</script>