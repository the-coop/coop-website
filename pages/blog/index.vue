<template>
  <div class="content-container">
    <h1 class="title">🗞️ Blog</h1>
    <p class="note">
      If you would like an email when a post is added, 
      <NuxtLink class="link" to="/blog/subscribe">please subscribe.</NuxtLink>
    </p>

    <div class="posts">
      <div class="post" v-for="post in posts" :key="post.id">
        Title: {{ post.title }}
        ID: {{ post.id }}
        <!-- Slug: {{ post.slug }} -->
        Owner: {{ post.author_id }}
        Date: {{ post.date }}
      </div>
    </div>
  </div>
</template>

<script>
  import API from '~/lib/api/api';

  export default {
    data() {
      return {
        posts: []
      }
    },
    async fetch() {
      const projectsResp = await fetch(API.BASE_URL + 'blog');
      const headlines = await projectsResp.json();
      this.posts = headlines;
    }
  }
</script>