<template>
  <div class="content-container">

    <h1 v-if="trade" class="title">{{ trade.trader_username }}'s trade #{{ trade.id }}</h1>
    <h2 class="subtitle">View specifics for and interacting with this trade.</h2>

    <div v-if="trade">
      {{ trade.offer_item }}
      {{ trade.offer_qty }}

      {{ trade.receive_item }}
      {{ trade.receive_qty }}
      {{ trade.trader_username }}
    </div>

    <NuxtLink to="/conquest/economy/trade">
      <button class="button secondary">Back</button>
    </NuxtLink>
    
    <button 
      v-if="this.$auth.user && this.$auth.user.id == trade.trader_id"
      class="button">Cancel</button>

    <button 
      v-if="this.$auth.user && this.$auth.user.id !== trade.trader_id"
      class="button confirm">Accept</button>

    <NuxtLink v-if="!this.$auth.user" to="/auth/login">
      <button class="button">Login</button>
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
        trade: [] 
      };
    },
    methods: {
      async accept() {
        const data = await (await fetch(API.BASE_URL + 'trades/', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            "Authorization": this.$auth.strategy.token.get()
          }
        }))
          .json();
        console.log(data);
      },
      async cancel() {
        const data = await (await fetch(
          API.BASE_URL + 'trades/cancel/' + this.$route.params.id, 
          {
            method: 'DELETE',
            headers: {
              'Content-Type': 'application/json',
              "Authorization": this.$auth.strategy.token.get()
            }
          }
        )).json();

        console.log(data);
      }
    },
    async mounted() {
      const id = this.$route.params.id;
      console.log(id);
      
      const tradeResp = await API.get('trades/' + id);
      const trade = tradeResp.data;
      this.trade = trade;

      console.log(trade);

      // console.log(this.$auth.user);
    }
  }
</script>


