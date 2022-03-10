<template>
  <div class="content-container">

    <h1 v-if="trade" class="title">
      {{ trade.trader_username }}'s trade #{{ trade.id }}
      {{ accepted ? '(accepted)' : '' }}
      {{ cancelled ? '(cancelled)' : '' }}
    </h1>
    <h2 class="subtitle">View specifics for and interacting with this trade.</h2>

    <div v-if="trade" :class="`trade 
      ${accepted ? 'accepted' : ''}
      ${cancelled ? 'cancelled' : ''}`">
      <div :class="`trade-item ${
        isOwn() ? 
          'incoming' : 'outgoing'
        }`">
        <span class="trade-item-label">
          {{
            cancelled ? '⬅ Trader Refunded' : '⬅ Buyer Receives'
          }}
        </span>
        {{ trade.offer_item }}
        <span class="trade-item-qty-flourish">x</span>
        <span class="trade-item-qty">
          {{ trade.offer_qty }}
        </span>
      </div>

      <div :class="`trade-item ${
        !isOwn() ? 
          'incoming' : 'outgoing'
        }`">
        <span class="trade-item-label">
          ➡ Trader Receives 
        </span>
        {{ trade.receive_item }}
        <span class="trade-item-qty-flourish">x</span>
        <span class="trade-item-qty">
          {{ trade.receive_qty }}
        </span>
      </div>

      <!-- AGE -->
    </div>


    <div class="actions">
      <NuxtLink to="/conquest/economy/trade">
        <button class="button secondary">Back</button>
      </NuxtLink>
      
      <button 
        v-on:click="cancel"
        v-if="!cancelled && trade && this.$auth.user && this.$auth.user.id == trade.trader_id"
        class="button">Cancel</button>

      <button 
        v-on:click="accept"
        v-if="trade && this.$auth.user && this.$auth.user.id !== trade.trader_id"
        class="button confirm">Accept</button>

      <NuxtLink v-if="cancelled" to="/conquest/economy/trade/add">
        <button class="button confirm">New trade</button>
      </NuxtLink>

      <NuxtLink v-if="!this.$auth.user" to="/auth/login">
        <button class="button">Login</button>
      </NuxtLink>
    </div>
  </div>
</template>

<style lang="scss" scoped>
  @use "/assets/style/_colour" as color;

  // transform: translateX(-100%);

  .trade {
    display: flex;
    justify-content: space-evenly;
    margin-bottom: 2em;
    font-size: 1.25em;
  }
  .trade-item {
    display: flex;
    flex: 50% 0 0;
    
    flex-direction: column;
    box-sizing: border-box;
    padding: .5em 2em;
    color: white;
    border-width: .25em;
    border-style: solid;
    
    text-align: center;

    transition: transform .22s linear;
  }



  .trade-item.incoming {
    border-color: rgb(70, 70, 70);
  }
  .trade-item.outgoing {
    border-color: rgb(194, 194, 194);
  }
  
  .trade-item-label {
    font-weight: bold;
    margin-bottom: .25em;
  }
  .trade-item-qty {}
  .trade-item-qty-flourish {
    font-size: 3em;
    line-height: .75em;
  }

  .trade.accepted .trade-item:first-child {
    // border-color: red;
    transform: translateX(100%);
  }
  .trade.accepted .trade-item:last-child {
    // border-color: yellow;
    transform: translateX(-100%);
  }

  .trade.cancelled .trade-item.outgoing {
    display: none;
  }


  @media (min-width: 800px) {
    .trade-item {
      flex: 45% 0 0;
    }
  }

  .actions {
    text-align: center;
  }
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
      isOwn() {
        return (
          this.$auth.user && 
          this.$auth.user.id === this.trade.trader_id
        );
      },
      async accept() {
        const data = await (await fetch(API.BASE_URL + 'trades/accept', {
          method: 'POST',
          body: JSON.stringify({ trade_id: this.trade.id }),
          headers: {
            'Content-Type': 'application/json',
            "Authorization": this.$auth.strategy.token.get()
          }
        }))
          .json();

        if (data.success)
          this.accepted = true;

        console.log(data);
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
  
          if (data.success)
            this.cancelled = true;

          console.log(data);
          
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


