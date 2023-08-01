<template>
  <div class="content-container">
    <table class="items">
      <thead>
        <tr>
          <td>
            <h1 class="title">Items</h1>
          </td>
          <td>Total Qty</td>
          <td>Per Beak</td>
        </tr>
      </thead>
      <tbody>
        <tr 
          class="item" 
          v-on:click="() => navigateItem(i.item_code)"
          v-for="i in items" :key="i.item_code">
          <td> 
            <ItemIcon :code="i.item_code" :label="i.item_code" />
          </td>
          <td>
            {{ i.total_qty }}
          </td>
          <td>
            {{ i.share.toFixed(2) }}
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style lang="scss" scoped>
  @use "/assets/style/_colour.scss";
  // @use "/assets/style/_colour.scss";

  .items {
    width: 100%;
  }

  .items thead {
    color: colour.$gray;
  }

  .items tbody td {
    color: rgb(116, 116, 116);
    border-bottom: 0.125em solid rgb(170, 170, 170);
  }

  .items tbody a {
    color: colour.$red;
  }


  .item {
    color: colour.$red;
    cursor: pointer;
    padding-top: .3em;
  }

  .item:hover {
    opacity: .8;
  }
</style>

<script>
  import API from '~/lib/api/api';
  import ItemIcon from '~/components/conquest/ItemIcon.vue';
  
  export default {
    methods: {
      navigateItem(itemCode) {
        this.$router.push({ path: `/conquest/economy/items/${itemCode}` });
      }
    },
    data() {
      return { 
        items: []
      };
    },
    async mounted() {
      this.items = (await API.get('economy/items')).data;
    },
    components: {
      ItemIcon
    }
  }
</script>