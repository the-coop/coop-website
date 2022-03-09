<template>
  <div class="content-container">
    <h1 class="title">Trade Details #{{ trade.id }}</h1>
    <h4 class="subtitle">*** This page should allow clicking specific trades for details</h4>

    <h2 v-if="!trades" class="no-trades">
      There are currently no active/ongoing trades.
    </h2>

    <!-- {{ t.id }}

    {{ t.offer_item }}
    {{ t.offer_qty }}

    {{ t.receive_item }}
    {{ t.receive_qty }}
    {{ t.trader_username }} -->

    <NuxtLink to="/conquest/economy/trade/mine">
      <button class="button secondary">My Trades</button>
    </NuxtLink>
    <NuxtLink to="/conquest/economy/trade/add">
      <button class="button">Add</button>
    </NuxtLink>
  </div>
</template>

<style lang="scss" scoped>
  @use "/assets/style/_colour" as color;

  .no-trades {
    color: color.$gray;
  }
</style>

<script>
  import API from '~/lib/api/api';

  export default {
    data() {
      return { 
        trades: [] 
      };
    },
    methods: {
    },
    async mounted() {
      // const tradesResp = await API.get('economy/trades');
      // const trades = tradesResp.data;
      // this.trades = trades;
      // console.log(trades);
    }
  }
</script>


