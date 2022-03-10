<template>
  <div class="content-container">

    <h1 v-if="trade" class="title">{{ trade.trader_username }}'s trade #{{ trade.id }}</h1>
    <h2 class="subtitle">View specifics for and interacting with this trade.</h2>

    <div v-if="trade">
      {{ trade.offer_item }}
      {{ trade.offer_qty }}

      {{ trade.receive_item }}
      {{ trade.receive_qty }}

      <!-- AGE -->
    </div>

    <NuxtLink to="/conquest/economy/trade">
      <button class="button secondary">Back</button>
    </NuxtLink>
    
    <button 
      v-on:click="cancel"
      v-if="trade && this.$auth.user && this.$auth.user.id == trade.trader_id"
      class="button">Cancel</button>

    <button 
      v-on:click="accept"
      v-if="trade && this.$auth.user && this.$auth.user.id !== trade.trader_id"
      class="button confirm">Accept</button>

    <NuxtLink v-if="!this.$auth.user" to="/auth/login">
      <button class="button">Login</button>
    </NuxtLink>
  </div>
</template>

<style lang="scss" scoped>
  @use "/assets/style/_colour" as color;
</style>

<script>
  import API from '~/lib/api/api';

  export default {
    data() {
      return { 
        trade: null,
        cancelled: false,
        accepted: false
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

        this.accepted = true;
      },
      async cancel() {
        try {
          const data = await (await fetch(
            API.BASE_URL + 'trades/' + this.$route.params.id, 
            {
              method: 'DELETE',
              headers: {
                'Content-Type': 'application/json',
                "Authorization": this.$auth.strategy.token.get()
              }
            }
          )).json();
  
          console.log(data);
  
          this.cancelled = true;

        } catch(e) {
          console.log('No longer authorised.')
        }
      }
    },
    async mounted() {
      const id = this.$route.params.id;
      
      const tradeResp = await API.get('trades/' + id);
      const trade = tradeResp.data;
      this.trade = trade;

      console.log(trade);

      // console.log(id);
      // console.log(trade);
      // console.log(this.$auth.user);
    }
  }
</script>


