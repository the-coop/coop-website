<template>
  <div class="projects">

    <NuxtLink 
      :to="`/projects/${project.slug}`"
      v-for="project in projects" :key="project.id" class="project">
      <h2 class="project-title">{{ project.title }}</h2>
      <!-- <span>{{ project.deadline }}</span> -->
      <span>{{ fmtDate(project.created) }}</span>
      <p>{{ project.description }}</p>

      <p>{{ project.username }}</p>

      <!-- <a target="_blank" :href="project.channel_id">Link to channel</a> -->
    </NuxtLink>
  </div>
</template>

<style scoped>
  .projects {
    color: white;
  }

  .project {
    display: block;
    color: #ff6565;
    text-decoration: none;
  }
  .project:hover .project-title {
    color: white;
  }
</style>

<script>
  import moment from 'moment';
  
  export default {
    props: ['projects'],
    methods: {
      fmtDate: date => moment.unix(date).format("DD/MM/YYYY")
    }
  }
</script>