<template>
  <div class="content-container">
    <h1 class="title">
      Item Overview
      ({{ this.$route.params.code }})
    </h1>

    <h2 class="subtitle">Top Owners</h2>
    <a 
      v-for="i in item" :key="i.owner_id" 
      :href="`/members/${i.owner_id}`"
      class="ownership-item">
      {{ i.username }} x {{ i.quantity }}
    </a>
  </div>
</template>

<style lang="scss" scoped>
  @use "/assets/style/_colour.scss";

  .ownership-item {
    padding: .75em;
    color: colour.$red;
  }
</style>

<script>
  import API from '~/lib/api/api';

  export default {
    data() {
      return { 
        item: null
      };
    },
    async mounted() {
      this.item = (await API.get('economy/items/' + this.$route.params.code)).data;
      console.log(this.item);
    }
  }
</script>