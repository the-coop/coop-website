<template>
  <div class="content-container">
    <h1 class="title">Latest Trades</h1>

    <h2 :v-if="!trades" class="no-trades">
      There are currently no active/ongoing trades.
    </h2>

    <div :v-if="trades" class="rows">
      <div v-for="t in trades" :key="t.id" class="rows">
        {{ t.id }}

        {{ t.offer_item }}
        {{ t.offer_qty }}

        {{ t.receive_item }}
        {{ t.receive_qty }}
        {{ t.trader_username }}
      </div>
    </div>

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
  // .item {
  //   padding: .75em;
  //   color: colour.$red;
  // }
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
      showWIP() {
        alert('WIP...');
      }
    },
    async mounted() {
      const tradesResp = await API.get('economy/trades');
      const trades = tradesResp.data;
      this.trades = trades;
      console.log(trades);
    }
  }
</script>