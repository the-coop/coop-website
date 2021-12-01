<template>
  <div class="content-container">
    <h1 class="title">Items</h1>

    <div class="items">
      <a 
        v-for="i in items" :key="i.item_code" 
        :href="`/conquest/economy/items/${i.item_code}`"
        class="item">
        {{ i.item_code }}x{{ i.total_qty }}
      </a>
    </div>
  </div>
</template>

<style lang="scss" scoped>
  @use "/assets/style/_colour.scss";

  .item {
    padding: .75em;
    color: colour.$red;
  }
</style>

<script>
  import API from '~/lib/api/api';
  
  export default {
    data() {
      return { 
        items: [] 
      };
    },
    async mounted() {
      this.items = (await API.get('economy/items')).data;
      console.log(this.items);
    }
  }
</script>