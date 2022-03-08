<template>
  <div class="content-container">
    <h1 v-if="!processing" class="title">Create a trade</h1>
    <h1 v-if="processing" class="title">Submitting your trade</h1>
 
    <div v-if="$auth.$state.loggedIn">
      <form :class="`form ${processing ? 'disabled' : ''}`">
        <div class="fieldset">
          <span class="fieldset-title">Offering</span>

          <div class="input">
            <span class="input-label">Offering Item</span>
            <input v-model="offer_item" :disabled="processing" class="input-target" type="text" name="offer_item" placeholder="[ITEM_CODE]" />
          </div>

          <div class="input">
            <span class="input-label">Offering Amount</span>
            <input v-model="offer_qty" :disabled="processing" class="input-target" placeholder="1" type="number" name="offer_qty" />
          </div>
        </div>

        <div class="fieldset">
          <span class="fieldset-title">Attaining (receive)</span>

          <div class="input">
            <span class="input-label">Attaining Item</span>
            <input v-model="receive_item" :disabled="processing" class="input-target" type="text" name="receive_item" placeholder="[ITEM_CODE]" />
          </div>

          <div class="input">
            <span class="input-label">Attaining Amount</span>
            <input v-model="receive_qty" :disabled="processing" class="input-target"  placeholder="1" type="number" name="receive_qty" />
          </div>
        </div>
      </form>

      <NuxtLink to="/conquest/economy/trade">
        <button class="button secondary">Listings</button>
      </NuxtLink>
      <button class="button" v-on:click="add">Confirm</button>
      <!-- <button class="button" v-on:click="add">Confirm</button> -->
    </div>

    <div v-if="!$auth.$state.loggedIn">
      <h2 class="subtitle">Please login in order to authorise trading.</h2>
    </div>

    <PopupWrapper ref="popups" />
  </div>
</template>

<style lang="scss" scoped>
  @import "/assets/style/form/form-base.scss";

  .form {
    margin-top: 2em;
  }
</style>

<script>
  import API from '~/lib/api/api';
  import PopupWrapper from '~/components/features/popup/PopupWrapper';

  export default {
    data() {
      return { 
        trade: null,
        processing: false,

        offer_item: null,
        offer_qty: 1,
        receive_item: null,
        receive_qty: 1
      };
    },
    components: { PopupWrapper },
    methods: {
      async add() {
        this.processing = true;

        // console.log(this.offer_item, this.offer_qty, this.receive_item, this.receive_qty);

        const response = await fetch(API.BASE_URL + 'trades/create', {
          method: 'POST',
          body: {
            offer_item: this.offer_item,
            offer_qty: this.offer_qty,
            receive_item: this.receive_item,
            receive_qty: this.receive_qty
          },
          headers: {
            "Authorization": this.$auth.strategy.token.get()
          }
        });
        
        console.log(response);
      }
    },
    async mounted() {
      // const tradesResp = await API.get('economy/trades');
      // const trades = tradesResp.data;
      // this.trades = trades;
      // console.log(trades)
    }
  }
</script>