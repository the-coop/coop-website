<template>
  <div class="content-container">
    <h1>DRAFT PREVIEW</h1>

    <h1 class="title">🗞️ {{ post.title }}</h1>
    <!-- <p>{{ post.author_username }} - {{ post.date }}</p> -->
    
    <!-- <vue-markdown :source="post.content" /> -->

    <p class="note">
      If you would like an email when a post is added, 
      <NuxtLink class="link" to="/blog/subscribe">please subscribe.</NuxtLink>
    </p>
  </div>
</template>

<script>
  import API from '~/lib/api/api';
  import VueMarkdown from 'vue-markdown';

  export default {
    components: { VueMarkdown },
    async asyncData({ params, error, payload }) {
      let post = null;

      if (payload) post = payload;
      else {        
        const slug = params.slug || null;

        const projectsResp = await fetch(API.BASE_URL + 'blog/draft/' + slug);
        post = await projectsResp.json();
      }

      return { post };
    }
  }
</script>