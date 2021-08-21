<template>
  <div class="content-container">
    <h1 class="title">👷 Projects</h1>
  </div>
</template>

<script>
  import API from '~/lib/api/api';

  export default {
    data() {
      return {
        projects: []
      }
    },
    async fetch() {
      const projectsResp = await fetch(API.BASE_URL + 'projects');
      const projects = await projectsResp.json();
      this.projects = projects;
    }
  }
</script>