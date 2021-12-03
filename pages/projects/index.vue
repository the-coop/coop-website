<template>
  <div class="content-container">
    <h1 class="title">👷 Projects</h1>
    <ProjectsList prefix="projects" :projects="projects" />
  </div>
</template>

<script>
  import API from '~/lib/api/api';
  import ProjectsList from '~/components/projects/ProjectsList.vue';

  export default {
    components: {
      ProjectsList
    },
    data() {
      return { projects: [] }
    },
    async mounted() {
      const projectsResp = await fetch(API.BASE_URL + 'projects');
      this.projects = await projectsResp.json();
    }
  }
</script>