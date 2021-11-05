<template>
  <div>
    <div class="members-header">
      <h1 class="title">🔮 Members ({{ members.length }} / {{ total }})</h1>
      <input class="search" ref="searchquery" 
        :disabled="searching"
        placeholder="Search for member" />
      <button :disabled="searching" v-on:click="search" class="search-button">🔎</button>
    </div>
    <div>
      <div class="users">
        <NuxtLink class="user" v-for="user in members" :to="'/members/' + user.discord_id" :key="user.discord_id">
          <img :src="user.image ? user.image : '/favicon.svg'" class="pfp" />
          <div class="user-info">
            <div class="user-info-header">
              <span class="user-title">{{ user.username }}</span>
              <div class="user-tags">
                <!-- TODO: Add hover tooltip to this? -->
                <!-- <span>MOTW</span> -->
                <span class="user-tags-role" v-for="role in user.role_list" :key="'members' + role">
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

      <button class="load" v-if="loaded < total" v-on:click="load">
        LOAD MORE
      </button>
    </div>
  </div>
</template>


<style scoped>
  .members-header {
    display: flex;
  }
  .members-header .search {
    padding: .5em 1em;
    margin-left: auto;
    border-radius: .3em;
    background-color: transparent;
    font-size: 1.25em;
    color: #898989;
  }
  .search-button {
    border-radius: .3em;
    background-color: transparent;
    font-size: 1.25em;
    cursor: pointer;
  }
  .title {
    text-align: center;
    margin: auto;
  }

  .users {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    margin-top: 2rem;

    justify-content: space-between;
  }

  .user {
    display: flex;
    flex: 100% 0 0;
    text-decoration: none;
    color: indianred;
    min-height: 10em;
  }

  @media (min-width: 1200px) {
    .user {
      flex: calc(50% - .45rem) 0 0;
    }
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
  }
  .user-title {
    margin-right: 1rem;
    font-size: 1.5em;
    color: #e6e6e6;
    flex-shrink: 0;
  }
  .user-tags {
    /* flex: 50% 0 0; */
  }
  .user-tags-role {
    padding: .25em .5em;
    background: #1a1a1a;
    border-radius: .25rem;
    margin: .15em;
    margin-bottom: 3em;
    color: #898989;
  }


  .load {
    display: block;
    margin: auto;
    margin-top: 2rem;
    padding: 1.8rem 3rem;
    background-color: indianred;

    font-size: 1.25em;
    font-weight: bold;
    color: #dadada;

    border-radius: 1rem;
    border: none;

    cursor: pointer;
  }
</style>

<script>
  import API from '~/lib/api/api';
  import MembersUIHelper from '~/lib/members/membersUIHelper';

  export default {
    data() {
      return {
        members: [],
        total: 0,
        loaded: 0,

        // Used as a simple UI block to prevent search spam (DDOS).
        searching: false
      }
    },
    methods: {
      async search() {
        this.searching = true;

        const query = this.$refs.searchquery.value;
        const result = await fetch(API.BASE_URL + 'members/search/' + query);
        const members = (await result.json()) || [];

        this.total = members.length;
        this.members = members;
        this.loaded = members.length;

        // Unlock the search.
        setTimeout(() => {
          this.searching = false;
        }, 3000);
      },
      async load() {
        const membersResp = await fetch(API.BASE_URL + 'members/build');
        const members = (await membersResp.json()) || [];

        // Limit to first 24 for pagination purposes.
        this.total = members.length;

        const additions = 
          members.slice(this.loaded, Math.min(this.loaded + 24, this.total))
            .map(member => {
              member.role_list = MembersUIHelper.filter(member.role_list).slice(0, 3);
              member.role_list = member.role_list.map(MembersUIHelper.decorate);

              if (member.intro_content && member.intro_content.length > 150)
                member.intro_content = member.intro_content.slice(0, 150) + '...';

              return member;
            });

        this.members = [...this.members, ...additions];
        this.loaded += additions.length;
      }
    },
    async fetch() {
      await this.load();
    }
  }
</script>