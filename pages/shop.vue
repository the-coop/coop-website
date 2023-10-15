<template>
  <div class="page-wrapper">
    <h1 class="title">🛍️ Shop</h1>

    <div class="shop-items">
      <div 
        v-for="(item, key) in items" :key="key" :class="{'notforsale': item.for_sale === false}" >
        <ItemIcon :code="key" :label="key" />
      </div>
    </div>

    <LoginBlock />
  </div>
</template>

<script>
  import ITEMS from 'coop-shared/config/items.mjs';
  import ItemIcon from '~/components/conquest/ItemIcon.vue';

  export default {
    components: {
      ItemIcon
    },
    data() {
      return {
        items: ITEMS
      };
    }
  }
</script>

<style scoped>
  .title {
    color: white;
  }
  .subtitle {
    color: white;
  }
  .shop-items {
    display: flex;
    flex-wrap: wrap;
    color: white;
  }
  .shop-items > * {
    flex: 25% 0 0;
  }
  .shop-items .notforsale {
    opacity: .5;
    pointer-events: none;
  }
</style>
