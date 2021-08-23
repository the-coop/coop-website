<template>
  <div class="content-container">
    <h1 class="title">🔮 Members</h1>
    <div>
      <h1>👑 Commander</h1>
      <div v-if="hierarchy.commander" class="commander">
          <img :src="hierarchy.commander.image" />
          {{ hierarchy.commander.username }}
      </div>

      <h2>⚔️ Leaders</h2>
      <div class="leaders">
        <div class="leader" v-for="leader in hierarchy.leaders" :key="leader.discord_id">
          <img :src="leader.image" />
          {{ leader.username }}
        </div>
      </div>

      <h3>Member of the week</h3>
      <div v-if="hierarchy.motw" class="motw">
          <img :src="hierarchy.motw.image" />
          {{ hierarchy.motw.username }}
      </div>

      <!-- <h4>Richest user</h4> -->
      <!-- <h6>Boosters</h6> -->
      <!-- <p>Search for member</p>   -->

      <h6>Users</h6>
      <div class="users">
        <div class="user" v-for="user in hierarchy.other_users" :key="user.discord_id">
          <img :src="user.image" />
          {{ user.username }}
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import API from '~/lib/api/api';
  export default {
    data() {
      return {
        hierarchy: {}
      }
    },
    async fetch() {
      const hierarchyResp = await fetch(API.BASE_URL + 'members/hierarchy');
      const hierarchy = await hierarchyResp.json();
      this.hierarchy = hierarchy;

      console.log(hierarchy);
    }
  }
</script>

<style scoped>
  h1, h2, h3, h4, h6, p {
    margin: 0;
  }

  .users {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-evenly;
    align-items: center;
  }
</style>