<template>
  <div class="content-container">
    <h1 class="title">👷 Projects</h1>

    <div class="projects">
      <div v-for="project in projects" :key="project.id" class="project">
        <h2>{{ project.title }}</h2>
        <span>{{ project.deadline }}</span>
        <span>{{ project.created }}</span>
        <p>{{ project.description }}</p>
  
        <p>{{ project.owner_id }}</p>

        <!-- <a target="_blank" :href="project.channel_id">Link to channel</a> -->
      </div>
    </div>
  </div>
</template>

<script>
  import API from '~/lib/api/api';

  export default {
    data({ projects }) {
      return { projects }
    },
    async asyncData() {
      const projectsResp = await fetch(API.BASE_URL + 'projects');
      const projects = await projectsResp.json();
      console.log(projects);
      return { projects };
    }
  }
</script>