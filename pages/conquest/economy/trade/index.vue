<template>
  <div class="content-container">
    <h1 class="title">Trades</h1>
    <div class="rows">
      <div v-for="t in trades" :key="t.id" class="rows">
        {{ t.id }}

        {{ t.offer_item }}
        {{ t.offer_qty }}

        {{ t.receive_item }}
        {{ t.receive_qty }}
        {{ t.trader_username }}
      </div>
    </div>

    <NuxtLink class="" to="/conquest/economy/trade/mine">
      <button>My Trades</button>
    </NuxtLink>
    <NuxtLink class="" to="/conquest/economy/trade/add">
      <button>Add</button>
    </NuxtLink>
  </div>
</template>

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