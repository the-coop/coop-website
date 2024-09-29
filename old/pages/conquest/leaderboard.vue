<template>
  <div class="content-container">
    <h1 class="title">Leaderboard</h1>
    <div class="rows">
      <div v-for="(r, index) in rankings" :key="r.owner_id" class="rows">
        {{ index + 1 }}
        {{ r.quantity }}
        {{ r.username }}
        <!-- {{ r.owner_id }} -->
      </div>
    </div>

    <button v-on:click="showWIP">Load more</button>
    <button v-on:click="showWIP">Me</button>

    <form v-on:submit="showWIP">
      <input type="integer" placeholder="# Rank" />
      <button type="submit">Go</button>
    </form>
  </div>
</template>

<script>
  import API from '~/lib/api/api';

  export default {
    data() {
      return { 
        rankings: [] 
      };
    },
    methods: {
      showWIP() {
        alert('WIP...');
      }
    },
    async mounted() {
      const rankingsResp = await API.get('economy/leaderboard');
      const rankings = rankingsResp.data;
      this.rankings = rankings;
    }
  }
</script>