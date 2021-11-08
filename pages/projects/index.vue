<template>
  <div class="content-container">
    <h1 class="title">👷 Projects</h1>
    <ProjectsList :projects="projects" />
  </div>
</template>

<script>
  import API from '~/lib/api/api';
  import ProjectsList from '~/components/projects/ProjectsList.vue';

  export default {
    components: {
      ProjectsList
    },
    data({ projects }) {
      return { projects }
    },
    async asyncData() {
      const projectsResp = await fetch(API.BASE_URL + 'projects');
      const projects = await projectsResp.json();
      return { projects };
    }
  }
</script>