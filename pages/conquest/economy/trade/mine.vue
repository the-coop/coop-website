<template>
  <div class="content-container">
    <h1 class="title">Your trades</h1>

    <h2 :v-if="!trades" class="no-trades">
      You have no currently active/ongoing trades.
    </h2>

    <div v-if="trades">
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
      const trades = await (await fetch(
        API.BASE_URL + 'trades/mine',
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            "Authorization": this.$auth.strategy.token.get()
          }
        }
      )).json();

      this.trades = trades;
      console.log(trades);
    }
  }
</script>