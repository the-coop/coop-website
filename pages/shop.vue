<template>
  <div>
    <h1 class="title">🛍️ Shop</h1>
    <p class="subtitle">Shop items coming soon, for sale in Algorand, USD and&nbsp;
      <ItemIcon code="COOP_POINT" label="Coop Points" />
    </p>
    <LoginBlock />
  </div>
</template>

<script>
  import ItemIcon from '~/components/conquest/ItemIcon.vue';

  export default {
    components: {
      ItemIcon
    }
  }
</script>

<style>
  .title {
    color: white;
  }
  .subtitle {
    color: white;
  }
</style>
