<template>
  <div>
    <div class="page home content-container">
      <div class="hero">
        <h1 class="title">WHAT IS THE COOP?</h1>

        <p class="subtitle">
          The primary purpose of The Coop is <strong>the empowerment</strong> of creatives. We move the Earth and Moon for our <strong>free and democratic</strong> system.
        </p>

        <p class="subtitle">
          <br />
          {{ Math.max(0, 1000 - usersTotal) }} <strong>full</strong> membership slots remaining!
        </p>

        <div class="actions">
          <a href="https://fund-the-coop.raisely.com" target="_blank" class="button">Donate</a>
          <a v-show="!$auth.$state.loggedIn" :href="inviteLink" target="_blank" class="button">Join</a>
        </div>
      </div>

      <div class="advertisement" v-if="advert">
        <h2>Community Ad</h2>
        <a :href="advert.target_url">
          <div 
            class="advertisement-image" 
            :style="{ backgroundImage: `url(${advert.image_url})` }">
          </div>
        </a>

      </div>

      <client-only>
        <Worldview :silent="true" :intro="true" :networking="true" />
      </client-only>
    </div>

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

      <NuxtLink to="/blog" class="center-cta">
        ALL POSTS 🗞️
      </NuxtLink>
    </div>

    <div class="content-container">
      <h1 class="title">👷 Projects ({{ projects.length }}/{{ projectsTotal }})</h1>
      <ProjectsList prefix="home-projects" :projects="projects" />

      <NuxtLink to="/projects" class="center-cta">
        ALL PROJECTS 👷
      </NuxtLink>
    </div>

    <div class="content-container">
      <h1 class="title">🔮 Top Members ({{ users.length }}/{{ usersTotal }})</h1>
      <UsersList :users="users" />

      <NuxtLink to="/members" class="center-cta">
        ALL MEMBERS 🔮
      </NuxtLink>
    </div>

    <!-- <div class="content-container">
      <h1 class="title">🏷️ Services</h1>
      <ServicesList />
      <NuxtLink to="/services" class="center-cta">
        ALL SERVICES 🏷️
      </NuxtLink>
    </div> -->

    <div class="content-container">
      <h1 class="title">🗡 Conquest</h1>

      <ConquestMenu />
    </div>

    <div class="content-container" v-show="!$auth.$state.loggedIn">
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
import { inviteLink } from '~/lib/config';

  export default {
    components: {
      'Worldview': () => import('@/components/conquest/Worldview.vue'),
      PostsList,
      ProjectsList,
      UsersList,
      ConquestMenu,
      LoginBlock,
      ServicesList
    },
    data() {
      return { 
        posts: [],
        postsTotal: 0,
        projects: [],
        projectsTotal: 0,
        users: [],
        usersTotal: 0,
        advert: null,

        hasVisited: false,

        inviteLink
      };
    },
    destroyed() {
      // TODO: Reset the dynamic WorldView component to prevent sync errors/dev mostly.
    },
    async mounted() {
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

      // Load the latest advert
      const advertResp = await fetch(API.BASE_URL + 'adverts/latest');
      this.advert = await advertResp.json() || null;
      console.log(this.advert);

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
    }
  }
</script>

<style>
  .home {
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    flex-wrap: wrap;
  }

  .hero {
    flex: calc(59% - 3em) 0 0;
    z-index: 1;
  }

  .hero .subtitle {
    width: auto;
  }

  .advertisement {
    flex: 100% 0 0;
    margin-top: 5rem;
    color: silver;
  }

  .advertisement h2 {
    margin-top: 0;
  }

  .advertisement-image {
    width: 100%;
    height: 30vh;

    background-position: center;
    background-size: cover;
  }

  .actions {
    margin-top: 3rem;
  }

  .actions .button {
    margin-right: 1.5em;
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

  @media screen and (min-width: 850px) {
    .home {
      flex-direction: row;
      justify-content: space-between;
    }

    .home {
      flex-wrap: nowrap;
    }

    .advertisement {
      margin-top: 0;
      flex: 39% 0 0;
    }
  }

  @media screen and (min-width: 1200px) {
    .home {
      flex-wrap: nowrap;
    }

    .advertisement {
      flex: 41% 0 0;
    }
  }
</style>
