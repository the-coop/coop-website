<template>
  <div v-if="post" class="content-container">
    <div class="post-info">
      <h1 class="title">🗞️ {{ post.title }}</h1>
      <p>{{ post.author_username }} {{ fmtDate(post.date) }}</p>
    </div>
    
    <div class="content">
      <vue-markdown :source="post.content" />
    </div>

    <p class="note">
      If you would like an email when a post is added, 
      <NuxtLink class="link" to="/blog/subscribe">please subscribe.</NuxtLink>
    </p>
  </div>
</template>

<style scoped>
  .post-info {
    color: #ff6565;
  }
  .content {
    color: white;
  }

  .content a {
    color: #ff8f8f;
  }
</style>

<script>
  import moment from 'moment';
  import VueMarkdown from 'vue-markdown';
  import API from '~/lib/api/api';

  export default {
    components: { VueMarkdown },
    data: () => ({
      post: null
    }),
    methods: {
      fmtDate: date => moment.unix(date).format("DD/MM/YYYY")
    },
    async mounted() {
      const slug = this.$route.params.slug || null;

      const projectsResp = await fetch(API.BASE_URL + 'blog/' + slug);
      this.post = await projectsResp.json();
    }
  }
</script>