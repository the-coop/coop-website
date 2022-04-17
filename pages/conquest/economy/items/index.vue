<template>
  <div class="content-container">
    <h1 class="title">Items</h1>

    <table class="items">
      <thead>
        <tr>
          <td>Item</td>
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
            {{ i.item_code }}
          </td>
          <td>
            {{ i.total_qty }}
          </td>
          <td>
            0
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
  }

  .items tbody a {
    color: colour.$red;
  }


  .item {
    color: colour.$red;
    cursor: pointer;
  }

  .item:hover {
    opacity: .8;
  }
</style>

<script>
  import API from '~/lib/api/api';
  
  export default {
    methods: {
      navigateItem(itemCode) {
        this.$router.push({ path: `/conquest/economy/items/${itemCode}` });
        // console.log(itemCode);
        // :href=""
      }
    },
    data() {
      return { 
        items: [] 
      };
    },
    async mounted() {
      this.items = (await API.get('economy/items')).data;
    }
  }
</script>