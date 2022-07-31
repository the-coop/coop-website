<template>
  <div class="content-container">
    <div v-if="!user">Loading!</div>
    <div class="user-profile" v-if="user">
      <img :src="user.image ? user.image : '/favicon.svg'" class="pfp" />

      <div class="user-info">
        <div class="user-info-header">
          <span class="user-title">🔮 {{ user.username }}</span>
        </div>

        <h3>Roles</h3>
        <div class="roles-wrapper">
          <span v-for="role in user.role_list" :key="role" class="role">
            {{ role }}
          </span>
        </div>

        <h3>About</h3>
        <p>
          {{ user.intro_content }}
        </p>

        <!-- <h3>Contact/Socials</h3> -->

        <div v-if="user.project_list">
          <h3>Projects</h3>

          <NuxtLink class="meta-link" :to="`/projects/${project.slug}`" v-for="project in user.project_list" :key="project.slug">
            {{ project.slug }}
          </NuxtLink>
        </div>

        <div v-if="user.blog_posts">
          <h3>Posts</h3>

          <NuxtLink class="meta-link" :to="`/blog/${post.slug}`" v-for="post in user.blog_posts" :key="post.slug">
            {{ post.slug }}
          </NuxtLink>
        </div>

        <h3>Economy</h3>

        <div v-if="user.item_list">
          <h4>Items</h4>
          <div class="items">
            <a 
              v-for="i in user.item_list" 
              :href="`/conquest/economy/items/${i.item_code}`"
              :key="`items-list-${i.item_code}`">

              <ItemIcon 
                :code="i.item_code"
                :label="`${i.item_code} x ${i.quantity.toFixed(2)}`"
              />
            </a>
          </div>
        </div>

        <h4>Trades</h4>
        <span>coming soon</span>

        <h3>Conquest</h3>
        
        <div>
          Location: {{ user.tile }}
        </div>

        <h4>Bases:</h4>
        <div>
          <a target="_blank" 
            :href="`/conquest/world?tile=${b.tile}`"
            v-for="b in user.base_list" :key="`base-list-${b.tile}`">
            {{ b.tile }}
          </a>
        </div>

      </div>
    </div>
  </div>
</template>


<style scoped>
  .user-profile {
    color: #ff6565;
  }
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

  .items {
    /* width: 50%; */
    display: flex;
    flex-wrap: wrap;
  }

  .items a {
    margin: 0 .75em .35em 0;
    color: rgb(172, 172, 213);
  }

  .items span {
    margin-right: .3em;
    margin-bottom: .3em;
  }

  .meta-link {
    display: block;
    margin-bottom: 1em;
    color: white;
  }
  .meta-link:hover {
    color: #ff6565;
  }

  .role {
    display: inline-block;

    border-radius: 8px;
    background-color: #444;

    padding: .125em .5em;
    margin: .125em;
  }

</style>

<script>
  import API from '~/lib/api/api';
  import MembersUIHelper from '~/lib/members/membersUIHelper';
  import ItemIcon from '~/components/conquest/ItemIcon';

  export default {
    components: {
      ItemIcon
    },
    data() {
      return {
        user: null
      }
    },
    async mounted() {
      const id = this.$route.params.id;

      const userResp = await fetch(API.BASE_URL + 'members/build-single/' + id);
      const user = await userResp.json();

      if (user && user.role_list)
        user.role_list = MembersUIHelper
          .filter(user.role_list)
          .map(MembersUIHelper.decorate);

      this.user = user;
    }
  }
</script>
