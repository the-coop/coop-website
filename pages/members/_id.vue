<template>
  <div>
    <h1 class="title">🔮 {{ user.username }}</h1>

    <img :src="user.image ? user.image : '/favicon.svg'" class="pfp" />

    <div class="user-info">
      <div class="user-info-header">
        <span class="user-title">{{ user.username }}</span>
        <div class="user-tags">
          <span>MEMBER</span>
        </div>
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
    data({ user }) {
      return { user }
    },
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