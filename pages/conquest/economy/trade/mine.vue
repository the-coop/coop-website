<template>
  <div class="content-container">
    <h1 class="title">Your trades</h1>

    <h2 v-if="$auth.user && trades.length === 0" class="subtitle">
      You have no currently active/ongoing trades.
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
          </tr>
        </thead>
        <tr v-for="t in trades" :key="t.id" class="rows" v-on:click="ev => view(t.id)">
          <td>{{ t.id }}</td>

          <td>{{ t.offer_item }}</td>
          <td>{{ t.receive_item }}</td>

          <td>{{ t.offer_qty }}</td>
          <td>{{ t.receive_qty }}</td>
        </tr>
      </table>
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

  export default {
    data() {
      return { 
        trades: []
      };
    },
    methods: {
      view(tradeID) {
        this.$router.push({ path: '/conquest/economy/trade/' + tradeID });
      }
    },
    async mounted() {
      if (this.$auth.user) {
        const tradesResp = await API.getAuthed('trades/mine', this.$auth);
        this.trades = tradesResp.data;
      }
    }
  }
</script>