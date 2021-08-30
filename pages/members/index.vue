<template>
  <!-- <div class="content-container"> -->
  <!-- <p>Search for member</p>   -->
  <div>
    <h1 class="title">🔮 Members</h1>
    <div>
      <div class="users">
        <NuxtLink v-if="hierarchy.commander" :to="'/members/' + hierarchy.commander.discord_id" class="user commander">
          <img :src="hierarchy.commander.image" class="pfp" />
          <div class="user-info">
            <div class="user-info-header">
              <span class="user-title">{{ hierarchy.commander.username }}</span>
              <div class="user-tags">
                <span>👑 Commander</span>
              </div>
              {{ hierarchy.commander.intro_content }}
            </div>
          </div>
        </NuxtLink>

        <NuxtLink class="user leader" v-for="leader in hierarchy.leaders" :to="'/members/' + leader.discord_id" :key="leader.discord_id">
          <img :src="leader.image" class="pfp" />
          <div class="user-info">
            <div class="user-info-header">
              <span class="user-title">{{ leader.username }}</span>
              <div class="user-tags">
                <span>⚔️ Leaders</span>
              </div>
              {{ hierarchy.leader.intro_content }}
            </div>
          </div>
        </NuxtLink>

        <NuxtLink v-if="hierarchy.motw" :to="'/members/' + hierarchy.motw.discord_id" class="user motw">
          <img :src="hierarchy.motw.image" class="pfp" />
          <div class="user-info">
            <div class="user-info-header">
              <span class="user-title">{{ hierarchy.motw.username }}</span>
              <div class="user-tags">
                <!-- TODO: Add hover tooltip to this? -->
                <span>MOTW</span>
              </div>
              {{ hierarchy.motw.intro_content }}
            </div>
          </div>
        </NuxtLink>
        <NuxtLink class="user" v-for="user in hierarchy.other_users" :to="'/members/' + user.discord_id" :key="user.discord_id">
          <img :src="user.image ? user.image : '/favicon.svg'" class="pfp" />
          <div class="user-info">
            <div class="user-info-header">
              <span class="user-title">{{ user.username }}</span>
              <div class="user-tags">
                <span>MEMBER</span>
              </div>
            </div>
            {{ user.intro_content }}
          </div>
          <!-- Identify prospects too! -->
        </NuxtLink>
      </div>
    </div>
  </div>
</template>


<style scoped>
  .title {
    text-align: center;
  }

  .users {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    margin-top: 2rem;
  }

  .user {
    display: flex;
    flex: 100% 0 0;
  }

  @media (min-width: 1200px) {
    .user {
      flex: 50% 0 0;
    }
  }

  .pfp {
    flex: 22% 0 0;
    margin: 1rem;
    margin-left: 0;
    margin-top: 0;
    
    border-radius: 1rem;
    border: .165rem solid silver;
  }

  .user-info {
    
  }
  .user-info-header {
    display: flex;
    align-items: center;
  }
  .user-title {
    margin-right: 1rem;
    font-size: 1.5em;
    color: #e6e6e6;
  }

</style>

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
    }
  }
</script>