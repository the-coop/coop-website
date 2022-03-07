<template>
  <div class="content-container">
    <h1 class="title">Create a trade</h1>
 
    <div v-if="$auth.$state.loggedIn">
      <form class="form">
        <div class="fieldset">
          <span class="fieldset-title">Offering</span>

          <div class="input">
            <span class="input-label">Offering Item [ITEM_CODE]</span>
            <input class="input-target" type="text" name="offer_item" />
          </div>

          <div class="input">
            <span class="input-label">Offering Amount [ITEM_CODE]</span>
            <input class="input-target" type="number" name="offer_qty" />
          </div>
        </div>

        <div class="fieldset">
          <span class="fieldset-title">Attaining (receive)</span>

          <div class="input">
            <span class="input-label">Attaining Item [ITEM_CODE]</span>
            <input class="input-target" type="text" name="receive_item" />
          </div>

          <div class="input">
            <span class="input-label">Attaining Amount [ITEM_CODE]</span>
            <input class="input-target" type="number" name="receive_qty" />
          </div>
        </div>
      </form>

      <NuxtLink class="" to="/conquest/economy/trade">
        <button class="button secondary">Listings</button>
      </NuxtLink>
      <button class="button" v-on:click="showWIP">Confirm</button>
    </div>

    <div v-if="!$auth.$state.loggedIn">
      <h2 class="subtitle">Please login in order to authorise trading.</h2>
    </div>
  </div>
</template>

<style lang="scss" scoped>
  @import "/assets/style/form/form-base.scss";

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