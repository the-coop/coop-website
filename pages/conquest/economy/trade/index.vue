<template>
  <div class="content-container page-wrapper">
    <h1 class="title">Latest Trades</h1>

    <h2 v-if="trades.length === 0" class="no-trades subtitle">
      There are currently no active/ongoing trades.
    </h2>

    <div v-if="trades.length > 0">
      <table class="trades">
        <thead>
          <tr>
            <th>#</th>
            <th>Offering</th>
            <th>Receiving</th>
            <th>Offer Qty</th>
            <th>Receive Qty</th>
            <th>Trader</th>
          </tr>
        </thead>
        <tr v-for="t in trades" :key="t.id" class="rows" v-on:click="ev => view(t.id)">
          <td>{{ t.id }}</td>

          <td>
            <ItemIcon :code="t.offer_item" :label="t.offer_item" />
          </td>
          <td>
            <ItemIcon :code="t.receive_item" :label="t.receive_item" />
          </td>

          <td>{{ t.offer_qty }}</td>
          <td>{{ t.receive_qty }}</td>

          <td>{{ t.trader_username }}</td>
        </tr>
      </table>
    </div>

    <NuxtLink v-if="$auth.user" to="/conquest/economy/trade/mine">
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
  .trades {
    width: 100%;
    color: color.$gray;

    margin-bottom: 1em;
  }
  .trades thead {
    font-weight: bold;
    text-decoration: underline;
  }
  .rows:hover {
    color: white;
    cursor: pointer;
  }
</style>

<script>
  import API from '~/lib/api/api';
  import ItemIcon from '~/components/conquest/ItemIcon.vue';

  export default {
    components: { ItemIcon },
    data() {
      return { 
        trades: [] 
      };
    },
    methods: {
      view(tradeID) {
        this.$router.push({ path: 'trade/' + tradeID });
      }
    },
    async mounted() {
      const tradesResp = await API.get('economy/trades');
      const trades = tradesResp.data;
      this.trades = trades;
    }
  }
</script>