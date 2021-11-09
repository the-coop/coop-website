<template>
  <div class="users">
    <NuxtLink class="user" v-for="user in users" :to="'/members/' + user.discord_id" :key="user.discord_id">
      <img :src="user.image ? user.image : '/favicon.svg'" class="pfp" />
      <div class="user-info">
        <div class="user-info-header">
          <span class="user-title">{{ user.username }}</span>
          <div class="user-tags">
            <!-- TODO: Add hover tooltip to this? -->
            <!-- <span>MOTW</span> -->
            <span 
              class="user-tags-role" 
              v-for="
                role in sortRoles(user.role_list)
                  .filter(filterRole)
                  .slice(0, 3)
              "
              :key="'users' + role">
              {{ role }}
            </span>
          </div>
        </div>

        <div class="user-intro">
          {{ user.intro_content }}
        </div>

        {{ user.historical_points ? `${user.historical_points}P` : null }}
      </div>
    </NuxtLink>
  </div>
</template>

<style scoped>
  .users {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    margin-top: 2rem;

    justify-content: space-between;
  }

  .user {
    display: flex;
    flex-direction: column;
    flex: 100% 0 0;
    text-decoration: none;
    color: indianred;
    min-height: 10em;

    margin-bottom: 2em;

    align-items: flex-start;
  }

  .user:hover .pfp {
    border-color: indianred;
  }
  .user:hover .user-title {
    color: indianred;
  }
  .user:hover .user-intro {
    color: white;
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
    align-items: flex-start;
    flex-direction: column;
  }
  .user-title {
    margin-right: 1rem;
    font-size: 1.5em;
    color: #e6e6e6;
    flex-shrink: 0;
  }
  .user-tags {
    display: none;
  }
  .user-tags-role {
    padding: .25em .5em;
    background: #1a1a1a;
    border-radius: .25rem;
    margin: .15em;
    margin-bottom: 3em;
    color: #898989;
  }

  @media (min-width: 800px) {
    .user {
      flex: calc(50% - .45rem) 0 0;
      flex-direction: row;
    }
    .user-info-header {
      /* flex-direction: row; */
    }
    .user-tags {
      display: inline-block;
    }
  }
</style>

<script>
  const filteredRoles = ['MEMBER', 'SUBSCRIBER', 'SOCIAL'];
  const skillLevelRoles = ['BEGINNER', 'INTERMEDIATE', 'MASTER'];
  export default {
    props: ['users'],
    methods: {
      sortRoles(roleList) {
        // Not working atm.
        // roleList.sort((roleA, roleB) => {
        //   if (roleA === 'COMMANDER') return 1;
        //   if (skillLevelRoles.includes(roleA)) return 0;
  
        //   return 0;
        // });
        return roleList;
      },
      filterRole(role) {
        return !filteredRoles.includes(role);
      }
    }
  }
</script>