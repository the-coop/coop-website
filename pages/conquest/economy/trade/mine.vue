<template>
  <div class="content-container">
    <h1 class="title">Your trades</h1>

    <h2 :v-if="!trades" class="no-trades">
      You have no currently active/ongoing trades.
    </h2>

    <div :v-if="trades" class="details">
      <!-- <div v-if="trade" class="details">
        {{ trade.id }}

        {{ trade.offer_item }}
        {{ trade.offer_qty }}

        {{ trade.receive_item }}
        {{ trade.receive_qty }}
        {{ trade.trader_username }}
      </div> -->
    </div>

    <NuxtLink to="/conquest/economy/trade">
      <button class="button secondary">Listings</button>
    </NuxtLink>
    <NuxtLink to="/conquest/economy/trade/add">
      <button class="button">Create</button>
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
        trades: null
      };
    },
    methods: {
      loadTrade() {

      },
      showWIP() {
        alert('WIP...');
      }
    },
    async mounted() {
      // const tradesResp = await API.get('economy/trades');
      // const trades = tradesResp.data;
      // this.trades = trades;
      // console.log(trades);
    }
  }
</script>