<template>
  <div>
    <div class="members-header">
      <h1 class="title">🔮 Members ({{ users.length }} / {{ total }})</h1>
      <input class="search" ref="searchquery" 
        :disabled="searching"
        placeholder="Search for member" />
      <button :disabled="searching" v-on:click="search" class="search-button">🔎</button>
    </div>
    <div>
      <UsersList :users="users" />

      <button class="center-cta" v-if="loaded < total" v-on:click="load">
        LOAD MORE
      </button>
    </div>
  </div>
</template>


<script>
  import API from '~/lib/api/api';
  import MembersUIHelper from '~/lib/members/membersUIHelper';
  import UsersList from '~/components/users/UsersList.vue';

  export default {
    components: {
      UsersList
    },
    data() {
      return {
        users: [],
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
        const users = (await result.json()) || [];

        this.total = users.length;
        this.users = users;
        this.loaded = users.length;

        // Unlock the search.
        setTimeout(() => {
          this.searching = false;
        }, 3000);
      },
      async load() {
        const membersResp = await fetch(API.BASE_URL + 'members/build');
        const users = (await membersResp.json()) || [];

        // Limit to first 24 for pagination purposes.
        this.total = users.length;

        const additions = 
          users.slice(this.loaded, Math.min(this.loaded + 24, this.total))
            .map(member => {
              member.role_list = MembersUIHelper.filter(member.role_list).slice(0, 3);
              member.role_list = member.role_list.map(MembersUIHelper.decorate);

              if (member.intro_content && member.intro_content.length > 150)
                member.intro_content = member.intro_content.slice(0, 150) + '...';

              return member;
            });

        this.users = [...this.users, ...additions];
        this.loaded += additions.length;
      }
    },
    async fetch() {
      await this.load();
    }
  }
</script>



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
</style>