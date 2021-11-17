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
          <a v-show="!$auth.$state.loggedIn" href="https://discord.gg/dgexRwFCkc" target="_blank" class="button">Join</a>
        </div>
      </div>

      <div class="advertisement">
        <h2>Do you want to advertise here?</h2>
        <p>We hope not, it isn't supported yet!</p>
      </div>

      <client-only>
        <!-- TODO: Append after timeout. -->
        <Worldview :silent="true" />
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
      <ProjectsList :projects="projects" />

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

    <div class="content-container">
      <h1 class="title">🏷️ Services</h1>
      <ServicesList />
      <NuxtLink to="/services" class="center-cta">
        ALL SERVICES 🏷️
      </NuxtLink>
    </div>

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
    data({ posts, projects }) {
      return { posts, projects }
    },
    async asyncData() {
      // Load the necessary posts.
      const blogResp = await fetch(API.BASE_URL + 'blog');
      let posts = await blogResp.json();

      const postsTotal = posts.length;

      // Cap to the first two items.
      posts = posts.slice(0, 2);

      // Load the necessary projects.
      const projectsResp = await fetch(API.BASE_URL + 'projects');
      let projects = await projectsResp.json();

      // Cap to the first six items.
      projects = projects.slice(0, 4);

      const projectsTotal = projects.length;

      // Load the necessary users.
      const membersResp = await fetch(API.BASE_URL + 'members/build');
      let users = (await membersResp.json()) || [];

      const usersTotal = users.length;
    
      // Cap to the first six items.
      users = users.slice(0, 6);

      return { 
        posts, postsTotal,
        projects, projectsTotal,
        users, usersTotal 
      };
    }
  }
</script>

<style>
  .home {
    display: flex;
    flex-direction: column;
    justify-content: space-between;
  }

  .hero {
    z-index: 1;
  }

  .advertisement {
    margin-top: 2rem;
    color: silver;
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
  }
</style>
