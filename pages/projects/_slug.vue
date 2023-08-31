<template>
  <div v-if="project" class="content-container page-wrapper">
    <div class="project">
      <h2>{{ project.title }}</h2>
      <!-- <span>{{ project.deadline }}</span> -->
      <span>{{ fmtDate(project.created) }}</span>
      <p>{{ project.description }}</p>

      <p>{{ project.username }}</p>

      <!-- <a target="_blank" :href="project.channel_id">Link to channel</a> -->
    </div>
  </div>
</template>

<style scoped>
  .project {
    color: white;
  }
</style>

<script>
  import moment from 'moment';
  import VueMarkdown from 'vue-markdown';
  import API from '~/lib/api/api';

  export default {
    components: { VueMarkdown },
    data: () => ({
      project: null
    }),
    methods: {
      fmtDate: date => moment.unix(date).format("DD/MM/YYYY")
    },
    async mounted() {
        const slug = this.$route.params.slug || null;
        const projectsResp = await fetch(API.BASE_URL + 'projects/' + slug);
        this.project = await projectsResp.json();
    }
  }
</script>