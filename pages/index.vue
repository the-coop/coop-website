<template>
  <div class="home-wrapper">
    <div class="page home hero-container content-container">

      <div class="hero" v-show="!$auth.$state.loggedIn">
        <h1 class="title">Join our community!</h1>

        <p class="subtitle">
          Democratic, free chicken themed, multiplayer universe enabled, 
          gravity simulating, economy having, 
          advice giving, learning community collaboration server 
          with {{ usersTotal }} members and growing!

          <!-- TODO: Latest member -->
        </p>

        <div class="actions">
          <a href="https://fund-the-coop.raisely.com" target="_blank" class="button secondary">💸 Donate</a>
          <a v-show="!$auth.$state.loggedIn" :href="inviteLink" target="_blank" class="button">👋 Join</a>
        </div>
      </div>
      
      <div class="hero" v-if="this.$auth.user">
        <img :src="this.$auth.user.image" />
        
        <h1 class="title">Welcome back, comrade {{ this.$auth.user.username }}!</h1>
        WIP: Adding more info to make more useful
        <!-- 
          blog_posts: 

          health: 

          intro_time: 
          item_list: 
          join_date: 
          last_sacrificed_secs: 
          project_list: 
          role_list: 
        -->

        <ItemIcon code="COOP_POINT" :label="this.$auth.user?.historical_points" />

        <!-- {{ user?.id }} -->
        <!-- Actions related to user -->
        <!-- Create notifications/inbox -->
        <div class="actions">
          <a href="https://fund-the-coop.raisely.com" target="_blank" class="button secondary">💸 Donate</a>
          <NuxtLink class="button" to="/conquest/world">🕹️ Play</NuxtLink>
        </div>
      </div>

      <div class="prompt" v-if="advert">
        <h2>Advertisement</h2>
        <a :href="advert.target_url">
          <div 
            class="prompt-image" 
            :style="{ backgroundImage: `url(${advert.image_url})` }">
          </div>
        </a>
      </div>
    </div>

    <client-only>
      <Worldview :silent="true" :intro="true" :networking="true" :controls="false" />
    </client-only>

    <div class="content-container">
      <h1 class="title">🗞️ Posts ({{ posts.length }}/{{ postsTotal }})</h1>

      <p class="note">
        Thanks for checking out our blog, you'll find out <NuxtLink class="link" to="/blog/subscribe">subscribe-worthy</NuxtLink> latest headlines below! 🤓
      </p>

      <PostsList :posts="posts" />

      <p class="note">
        If you would like an email when a post is added, 
        <NuxtLink class="link" to="/blog/subscribe">please subscribe.</NuxtLink>
      </p>

      <NuxtLink to="/blog" class="button">
        View all
      </NuxtLink>
    </div>

    <div class="content-container">
      <h1 class="title">👷 Projects ({{ projects.length }}/{{ projectsTotal }})</h1>
      <ProjectsList prefix="home-projects" :projects="projects" />

      <NuxtLink to="/projects" class="button">
        View all
      </NuxtLink>
    </div>

    <div class="content-container">
      <h1 class="title">🔮 Top Members ({{ users.length }}/{{ usersTotal }})</h1>
      <UsersList :users="users" />

      <NuxtLink to="/members" class="button">
        ALL MEMBERS 🔮
      </NuxtLink>
    </div>

    <!-- <div class="content-container">
      <h1 class="title">🏷️ Services</h1>
      <ServicesList />
      <NuxtLink to="/services" class="button">
        ALL SERVICES 🏷️
      </NuxtLink>
    </div> -->

    <div class="content-container conquest-menu-container">
      <h1 class="title">🗡 Conquest</h1>

      <ConquestMenu />
    </div>

    <div class="content-container login-prompt-container" v-show="!$auth.$state.loggedIn">
      <h1 class="title">🔑 Login</h1>

      <LoginBlock />
    </div>

  </div>
</template>

<script>
  import API from '~/lib/api/api';
  
  import PostsList from '~/components/blog/PostsList.vue';
  import ProjectsList from '~/components/projects/ProjectsList.vue';
  import UsersList from '~/components/users/UsersList.vue';
  import ConquestMenu from '~/components/conquest/ConquestMenu.vue';
  import LoginBlock from '~/components/users/LoginBlock.vue';
  import ServicesList from '~/components/users/services/ServicesList.vue';
  import ItemIcon from '~/components/conquest/ItemIcon.vue';

  import { inviteLink } from '~/lib/config';

  export default {
    components: {
      'Worldview': () => import('@/components/conquest/Worldview.vue'),
      PostsList,
      ProjectsList,
      UsersList,
      ConquestMenu,
      LoginBlock,
      ServicesList,
      ItemIcon
    },
    data() {
      return { 
        posts: [],
        postsTotal: 0,
        projects: [],
        projectsTotal: 0,
        users: [],
        usersTotal: 'many',
        advert: null,

        hasVisited: false,

        inviteLink
      };
    },
    destroyed() {
      // TODO: Reset the dynamic WorldView component to prevent sync errors/dev mostly.
    },
    async mounted() {
      try {
        // Load the necessary posts.
        const blogResp = await fetch(API.BASE_URL + 'blog');
        let posts = await blogResp.json();

        this.postsTotal = posts.length;

        // Cap to the first two items.
        this.posts = posts.slice(0, 2);

        // Load the necessary projects.
        const projectsResp = await fetch(API.BASE_URL + 'projects');
        let projects = await projectsResp.json();

        // Cap to the first six items.
        this.projects = projects.slice(0, 4);

        this.projectsTotal = projects.length;

        // Load the necessary users.
        const membersResp = await fetch(API.BASE_URL + 'members/build');
        let users = (await membersResp.json()) || [];
        console.log(users);

        // Load the latest advert
        const advertResp = await fetch(API.BASE_URL + 'prompts/latest');
        this.advert = await advertResp.json() || null;

        // TODO: Replace this with chunked server side pagination, more performant.
        // Needs sorting on the server side or it won't work
        users.sort((a, b) => {
          return (
            (a.item_list || []).find(i => i.item_code === 'COOP_POINT') || 0
            <
            (b.item_list || []).find(i => i.item_code === 'COOP_POINT') || 0
          );
        });

        this.usersTotal = users.length;
      
        // Cap to the first six items.
        this.users = users.slice(0, 6);
      } catch (e) {
        console.log('Home loading error')
        console.error(e);
      }
    }
  }
</script>

<style>
  .home-wrapper {
    display: flex;
    flex-wrap: wrap;
    margin-top: 1.5em;
    justify-content: center;
  }

  .home {
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    flex-wrap: wrap;
  }

  .hero-container {
    flex-wrap: wrap;
    flex-direction: column;
  }

  .login-prompt-container {
    background-color: rgb(23, 23, 23);
    justify-content: center;
    align-items: center;
    border-radius: 4em;
    padding: 3em;
  }


  .hero {
    z-index: 1;
    color: silver;
  }

  .hero .subtitle {
    width: auto;
  }

  .prompt {
    margin-top: 5rem;
    color: silver;
  }

  .prompt h2 {
    margin-top: 0;
  }

  .prompt-image {
    width: 100%;
    height: 30vh;

    background-position: center;
    background-size: contain;
    background-repeat: no-repeat;
  }

  .actions {
    display: flex;
    margin-top: 3rem;
    justify-content: space-between;
  }

  .actions .button {
    display: inline-flex;
    flex: calc(50% - .5em) 0 0;
    box-sizing: border-box;
  }

  .actions .button:last-child {
    margin-right: 0;
  }

  .page.home .worldview {
    position: fixed;
    top: 0;
    left: 0;

    z-index: -1;

    opacity: .125;
  }

  .conquest-menu-container {
    flex: 100%;
  }

  @media screen and (min-width: 850px) {
    .home {
      flex-direction: row;
      justify-content: space-between;
      flex-wrap: nowrap;
    }

    .hero {
      /* flex: calc(59% - 3em) 0 0; */
      
    }

    .prompt {
      flex: 100% 0 0;
      margin-top: 0;
      flex: 39% 0 0;
    }

    .actions {
      display: block;
    }

    .actions .button {
      margin-right: .35em;
    }

  }

  @media screen and (min-width: 1200px) {
    .home {
      flex-wrap: nowrap;
    }

    .prompt {
      flex: 41% 0 0;
    }
  }
</style>
