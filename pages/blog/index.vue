<template>
  <div class="content-container">
    <h1 class="title">🗞️ Blog</h1>

    <p class="note">Thanks for checking out our blog, you'll find out <NuxtLink class="link" to="/blog/subscribe">subscribe-worthy</NuxtLink> latest headlines below! 🤓</p>

    <div class="posts">
      <NuxtLink class="post" v-for="post in posts" :to="`/blog/${post.slug}`" :key="post.id">
        <h2 class="post-title">{{ post.title }}</h2>
        <p class="post-info">{{ post.author_username }} - {{ post.date }}</p>
      </NuxtLink>
    </div>

    <p class="note">
      If you would like an email when a post is added, 
      <NuxtLink class="link" to="/blog/subscribe">please subscribe.</NuxtLink>
    </p>
  </div>
</template>

<style scoped>
  .posts {
    display: flex;
    justify-content: space-between;
    flex-wrap: wrap;
  }
  .post {
    color: #ff6565;
    text-decoration: none;
  }
  .post:hover .post-title {
    color: white;
  }
  .post-title {
    font-weight: bold;
    text-decoration: underline;
  }
  .post-info {
    color: silver;
    
  }

</style>

<script>
  import API from '~/lib/api/api';

  export default {
    data({ posts }) {
      return { posts }
    },
    async asyncData() {
      const projectsResp = await fetch(API.BASE_URL + 'blog');
      const posts = await projectsResp.json();
      return { posts };
    }
  }
</script>