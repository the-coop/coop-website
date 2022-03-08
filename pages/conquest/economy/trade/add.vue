<template>
  <!-- TODO: -->
  <!-- Add form validation -->
  <!-- Make form item code fields upper case only -->
  <!-- Clear/empty values for retry -->

  <div class="content-container">
    <h1 v-if="!processing && !success" class="title">Create a trade</h1>
    <h1 v-if="processing" class="title">Submitting your trade</h1>
    <h1 v-if="success" class="title">Trade submitted</h1>
 
    <div v-if="$auth.$state.loggedIn">
      <form v-if="!success" :class="`form ${processing ? 'disabled' : ''}`">
        <div class="fieldset">
          <span class="fieldset-title">Offering</span>

          <div class="input">
            <span class="input-label">Offering Item</span>
            <input required v-model="offer_item" :disabled="processing" 
              :class="`input-target ${errors.invalid_offer_item ? 'errored' : ''}`"
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
            <input required v-model="receive_item" :disabled="processing" 
              :class="`input-target ${errors.invalid_receive_item ? 'errored' : ''}`" 
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

      <h2 class="subtitle" v-if="success">
        Your trade was successfully submit, use the buttons below to return to listings or place another trade.
      </h2>

      <NuxtLink to="/conquest/economy/trade">
        <button class="button secondary">Listings</button>
      </NuxtLink>
      <button v-if="!success" class="button" v-on:click="add">Confirm</button>
      <button v-if="success" class="button" v-on:click="reset">Reset</button>
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

  .errored {
    background-color: #5b0000;
  }
</style>

<script>
  import API from '~/lib/api/api';
  import PopupWrapper from '~/components/features/popup/PopupWrapper';

  export default {
    data() {
      return { 
        processing: false,

        offer_item: null,
        offer_qty: 1,
        receive_item: null,
        receive_qty: 1,

        success: false,
        errors: {}
      };
    },
    components: { PopupWrapper },
    methods: {
      reset() {
        // processing: false,

        this.offer_item = null;
        this.offer_qty = 1;
        this.receive_item = null;
        this.receive_qty = 1;

        this.success = false;
        this.errors = {};
      },
      async add() {
        // Disable re-submission whilst processing.
        this.processing = true;

        // Attempt trade order.
        const response = await fetch(API.BASE_URL + 'trades/create', {
          method: 'POST',
          body: JSON.stringify({
            offer_item: this.offer_item,
            offer_qty: this.offer_qty,
            receive_item: this.receive_item,
            receive_qty: this.receive_qty
          }),
          headers: {
            'Content-Type': 'application/json',
            "Authorization": this.$auth.strategy.token.get()
          }
        });
        const data = await response.json();
        console.log(data);

        // Handle validation.
        if (data.success)
          this.success = true;
        else
          this.errors = data.errors;

        // console.log(this.errors);

        // Reallow form interaction.
        this.processing = false;
      }
    }
  }
</script>