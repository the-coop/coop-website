<template>
  <div class="content-container">
    <div v-if="$auth.$state.loggedIn">
      <h1 v-if="!processing && !success" class="title">Create a trade</h1>
      <h1 v-if="processing" class="title">Submitting your trade</h1>
      <h1 v-if="success" class="title">Trade submitted</h1>
    </div>
 
    <div v-if="$auth.$state.loggedIn">
      <form v-if="!success" :class="`form ${processing ? 'disabled' : ''}`">
        <div class="fieldset">
          <span class="fieldset-title">Offering</span>

          <div class="input">
            <span class="input-label">Offering Item</span>
            <ItemCodeInputSuggestions 
              :onSelect="ev => selectSuggestion('offer')(ev)"
              :suggestions="offer_suggestions" 
            />

            <input required v-model="offer_item" :disabled="processing" 
              @input="itemCodeChange"
              @focus="itemCodeChange"
              :class="`item-code input-target ${errors.invalid_offer_item ? 'errored' : ''}`"
              type="text" name="offer_item" placeholder="[ITEM_CODE]" />
          </div>

          <div class="input">
            <span class="input-label">Offering Amount</span>
            <input v-model="offer_qty" :disabled="processing" 
              :class="`input-target ${errors.invalid_offer_qty ? 'errored' : ''}`" 
              placeholder="1" type="number" name="offer_qty" />
          </div>
        </div>

        <div class="fieldset">
          <span class="fieldset-title">Attaining (receive)</span>

          <div class="input">
            <span class="input-label">Attaining Item</span>
            <ItemCodeInputSuggestions 
              :onSelect="ev => selectSuggestion('receive')(ev)"
              :suggestions="receive_suggestions" 
            />
            <input required v-model="receive_item" :disabled="processing" 
              @input="itemCodeChange"

              :class="`item-code input-target ${errors.invalid_receive_item ? 'errored' : ''}`" 
              type="text" name="receive_item" placeholder="[ITEM_CODE]" />
          </div>

          <div class="input">
            <span class="input-label">Attaining Amount</span>
            <input v-model="receive_qty" :disabled="processing" 
              :class="`input-target ${errors.invalid_receive_qty ? 'errored' : ''}`"
              placeholder="1" type="number" name="receive_qty" />
          </div>
        </div>
      </form>

      <div class="subtitle" v-if="success">
        <strong>-></strong> {{ trade.offer_qty }} x 
        <ItemIcon :code="trade.offer_item" :label="trade.offer_item" />
        <br />
        <strong>&lt;-</strong> {{ trade.receive_qty }} x 
        <ItemIcon :code="trade.receive_item" :label="trade.receive_item" />
        <br />
        <!-- Add link to view trade specifically. -->
        <p>Thank you, {{ trade.trader_username }}. Your trade (#{{ trade.id }}) was successfully submitted, use the buttons below to return to listings or place another trade.</p>
      </div>

      <NuxtLink to="/conquest/economy/trade">
        <button class="button secondary">Listings</button>
      </NuxtLink>
      <button v-if="!success" class="button" v-on:click="add">Confirm</button>
      <button v-if="success" class="button secondary" v-on:click="view">View</button>
      <button v-if="success" class="button" v-on:click="reset">Reset</button>
    </div>

    <div v-if="!$auth.$state.loggedIn">
      <h2 class="subtitle">Please login (🥚 Community menu) in order to authorise trading.</h2>
    </div>

    <!-- <PopupWrapper ref="popups" /> -->
  </div>
</template>

<style lang="scss" scoped>
  @import "/assets/style/form/form-base.scss";

  .form {
    margin-top: 2em;
  }

  .errored {
  // .errored:after {
    // display: block;
    background-color: #5b0000;
    // position: absolute;
    // content: 'Invalid';
    color: red;
    z-index: 2;
  }

  .item-code {
    text-transform: uppercase;
  }

  .input {
    position: relative;
  }


</style>

<script>
  import ITEMS from 'coopshared/config/items.mjs';
  import API from '~/lib/api/api';
  import PopupWrapper from '~/components/features/popup/PopupWrapper.vue';
  import ItemCodeInputSuggestions from '~/components/trade/ItemCodeInputSuggestions.vue';
  import ItemIcon from '~/components/conquest/ItemIcon.vue';

  const ITEM_CODES = Object.keys(ITEMS);

  export default {
    data() {
      return { 
        trade: null,
        processing: false,

        offer_item: '',
        offer_qty: 1,
        receive_item: '',
        receive_qty: 1,

        offer_suggestions: [],
        receive_suggestions: [],

        success: false,
        errors: {}
      };
    },
    components: { PopupWrapper, ItemCodeInputSuggestions, ItemIcon },
    methods: {
      closeIfNotSelecting(key) {
        return (ev) => console.log(ev.currentTarget);
      },
      selectSuggestion(key) {
        return (ev) => {
          const itemCode = ev.target.dataset.code || '';
          this[key + '_item'] = itemCode;          
          this[key + '_suggestions'] = [];
        };
      },
      itemCodeChange(ev) {
        const type = ev.target.name.split('_')[0];
        const value = (ev.target.value || '').toUpperCase();

        // Clear errors if it's a real item code and error exists.
        if (this.errors?.['invalid_' + type + '_item'] && !!ITEMS?.[value])
          this.errors['invalid_' + type + '_item'] = false;

        // TODO: Remove untradeable items from suggestions

        // Clear on emptying the field.
        if (value === '')
          return this[type + '_suggestions'] = [];

        const suggestions = this[type + '_suggestions'];
        const newSuggestions = ITEM_CODES
          .filter(c => c.startsWith(value))
          .filter(c => !suggestions.some(s => s === c));

        // If no suggestions at all, do nothing.
        if (newSuggestions.length === 0 && suggestions.length === 0)
          return;

        // Remove any suggestions that were invalidated.
        const remainingSuggestions = suggestions.filter(c => c.startsWith(value));

        // If the only remaining suggestio is the current value ignore.
        if (newSuggestions.length === 1 && newSuggestions[0] === value)
          return this[type + '_suggestions'] = [];

        if (remainingSuggestions.length === 1 && remainingSuggestions[0] === value)
          return this[type + '_suggestions'] = [];

        this[type + '_suggestions'] = [
          ...remainingSuggestions,
          ...newSuggestions
        ];
      },
      reset() {
        // processing: false,
        this.trade = null;

        this.offer_item = '';
        this.offer_qty = 1;
        this.receive_item = '';
        this.receive_qty = 1;

        this.success = false;
        this.errors = {};
      },
      view() {
        this.$router.push({ path: '/conquest/economy/trade/' + this.trade.id });
      },
      async add() {
        // Disable re-submission whilst processing.
        this.processing = true;

        // Attempt trade order.
        const data = await (await fetch(API.BASE_URL + 'trades/create', {
          method: 'POST',
          body: JSON.stringify({
            offer_item: this.offer_item.toUpperCase(),
            offer_qty: this.offer_qty,
            receive_item: this.receive_item.toUpperCase(),
            receive_qty: this.receive_qty
          }),
          headers: {
            'Content-Type': 'application/json',
            "Authorization": this.$auth.strategy.token.get()
          }
        }))
          .json();

        console.log(data);

        // Handle validation.
        if (data.success) {
          this.success = true;
          this.trade = data.created_trade;

        } else
          this.errors = data.errors;

        // console.log(this.errors);

        // Reallow form interaction.
        this.processing = false;
      }
    }
  }
</script>