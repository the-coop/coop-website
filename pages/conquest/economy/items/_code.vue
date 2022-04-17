<template>
  <div class="content-container">
    <h1 class="title">
      Item Overview
      ({{ this.$route.params.code }})
    </h1>

    <h2 class="subtitle">Top Owners</h2>
    <table class="items">
      <thead>
        <tr>
          <td>Owner</td>
          <td>Qty</td>
        </tr>
      </thead>
      <tbody>
        <tr 
          class="item" 
          v-on:click="() => navigateUser(i.owner_id)"
          v-for="i in item" :key="i.username">
          <td> 
            {{ i.username }}
          </td>
          <td>
            {{ i.quantity }}
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style lang="scss" scoped>
  @use "/assets/style/_colour.scss";

  .ownership-item {
    padding: .75em;
    color: colour.$red;
  }

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
    data() {
      return { 
        item: null
      };
    },
    methods: {
      navigateUser(userID) {
        console.log(userID);
        this.$router.push({ path: `/members/${userID}` });
      }
    },
    async mounted() {
      this.item = (await API.get('economy/items/' + this.$route.params.code)).data;
      console.log(this.item);
    }
  }
</script>