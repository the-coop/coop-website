<template>
  <div>
    <div v-if="!user">Loading!</div>
    <div v-if="user">
      <img :src="user.image ? user.image : '/favicon.svg'" class="pfp" />

      <div class="user-info">
        <div class="user-info-header">
          <span class="user-title">🔮 {{ user.username }}</span>
          <div class="user-tags">
            <span>MEMBER</span>
          </div>
        </div>

        <h3>About</h3>
        {{ user.intro_content }}

        <h3>Projects</h3>

        <h3>Posts</h3>

        <h3>Economy</h3>
        <h3>Conquest</h3>

        <h3>Contact/Socials</h3>
      </div>
    </div>
  </div>
</template>


<style scoped>
  .pfp {
    flex: 22% 0 0;
    margin: 1rem;
    margin-left: 0;
    margin-top: 0;
    
    border-radius: 1rem;
    border: .165rem solid silver;
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
    async asyncData({ params, error, payload }) {
      let user = null;

      if (payload) user = payload;
      else {        
        const id = params.id || null;

        const userResp = await fetch(API.BASE_URL + 'members/' + id);
        user = await userResp.json();
      }

      return { user };
    }
  }
</script>