<template>
  <div class="content-container">
    <h1 class="title">Create a trade</h1>
    <div class="details">
      <!-- <div v-if="trade" class="details">
        {{ trade.id }}

        {{ trade.offer_item }}
        {{ trade.offer_qty }}

        {{ trade.receive_item }}
        {{ trade.receive_qty }}
        {{ trade.trader_username }}
      </div> -->
    </div>

    <NuxtLink class="" to="/conquest/economy/trade">
      <button>Listings</button>
    </NuxtLink>
    <button v-on:click="showWIP">Confirm</button>
  </div>
</template>

<script>
  import API from '~/lib/api/api';

  export default {
    data() {
      return { 
        trade: null
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