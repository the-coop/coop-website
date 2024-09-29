<template>
  <div class="content-container">
    <h1>DRAFT PREVIEW</h1>

    <div v-if="post">
      <h1 class="title">🗞️ {{ post.title }}</h1>
      <!-- <p>{{ post.author_username }} - {{ post.date }}</p> -->
      
      <vue-markdown :source="post.content" />

      <p class="note">
        If you would like an email when a post is added, 
        <NuxtLink class="link" to="/blog/subscribe">please subscribe.</NuxtLink>
      </p>
    </div>

  </div>
</template>

<script>
  import API from '~/lib/api/api';
  import VueMarkdown from 'vue-markdown';

  export default {
    components: { VueMarkdown },
    data() {
      return { post: null };
    },
    async mounted() {
      const channelID = this.$route.query.channel_id;
      if (channelID) {
        const projectsResp = await fetch(API.BASE_URL + 'blog/draft/' + channelID);
        const postData = await projectsResp.json();
        if (postData) {
          postData.content = postData.content ? postData.content : '';
          this.post = postData;
        }
      }
    }
  }
</script>