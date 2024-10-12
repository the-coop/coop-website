<template>
  <div class="page-wrapper">
    <h1 class="title">🏷️ Services</h1>

    <ServicesList />
  </div>
</template>

<script>
  import ServicesList from '~/components/users/services/ServicesList.vue';
  // import API from '~/lib/api/api';

  export default {
    components: {
      ServicesList
    }
  }
</script>