<template>
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
</template>

<script>
  export default {
    props: ['projects']
  }
</script>