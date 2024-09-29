<template>
  <div class="posts">
    <NuxtLink class="post" v-for="post in posts" :to="`/blog/${post.slug}`" :key="post.id">
      <h2 class="post-title">{{ post.title }}</h2>
      <p class="post-info">
        <span class="author">{{ post.author_username }}</span>
        <span class="date">{{ fmtDate(post.date) }}</span>
      </p>
    </NuxtLink>
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
  .author {
    font-weight: bold;
    color: #ff6565;
  }
</style>


<script>
  import moment from 'moment';

  export default {
    props: ['posts'],
    methods: {
      fmtDate: date => moment.unix(date).format("DD/MM/YYYY")
    }
  }
</script>