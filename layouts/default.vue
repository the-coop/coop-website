<template>
  <div class="default">
    <div class="header">
      <div class="brand">
        <NuxtLink to="/">
          <Logo />
        </NuxtLink>
      </div>
      <svg @click="openMenu" class="mobile-nav-trigger" viewBox="0 0 100 80">
        <rect width="100" height="20"></rect>
        <rect y="30" width="100" height="20"></rect>
        <rect y="60" width="100" height="20"></rect>
      </svg>
      <nav class="navigation">
        <NuxtLink to="/" class="nav-link current">🏠 Home</NuxtLink>
        <NuxtLink to="/conquest" class="nav-link">🗞️ Propaganda</NuxtLink>
        <NuxtLink to="/conquest" class="nav-link">🗡 Conquest</NuxtLink>
        
        <!-- Actions for guests/non-users/logged out users -->
        <NuxtLink v-if="!loggedIn" to="/auth/login" class="nav-link">🔒 Login</NuxtLink>
        <a v-if="!loggedIn" href="https://discord.gg/2gTTUZbRVD" target="_blank" class="nav-link">📝 Apply</a>

        <!-- Actions for logged un users -->
        <NuxtLink v-if="loggedIn" to="/profile" class="nav-link">👤 Profile</NuxtLink>
        <button v-if="loggedIn" 
          class="nav-link"
          v-on:click="logout">Logout</button>

      </nav>
    </div>
    <Nuxt />
  </div>
</template>

<script>
  import anime from 'animejs/lib/anime.es';
  import Auth from '~/lib/auth/auth';

  export default {
    async mounted() {
      if (Auth._isLoggedIn()) this.loggedIn = true;
    },
    data() {
      return {
        loggedIn: false
      }
    },
    methods: {
      logout() {
        Auth.logout();
        this.loggedIn = false;

        // Redirect to logged out page.
        this.$router.push({
            path: '/auth/loggedout'
        });
      },
      openMenu() {
        const menu = document.querySelector('.navigation');
        const targetBottom = menu.style.bottom === '3vh' ? '-15vh' : '3vh';
        anime({
          targets: '.navigation',
          bottom: targetBottom,
          duration: 250
        });
      }
    }
  }
</script>

<style>
  .default {
    padding: 0 1.5em;

    position: relative;
    overflow: hidden;
    width: 100vw;
    box-sizing: border-box;
    height: 100vh;
  }

  .header {
    display: flex;
    justify-content: center;
    align-items: center;
    padding: 2.5em 0;
  }

  /* Temporary until someone can do better. */
  .footer {
    padding: 2.5rem 0rem;
  }

    .footer a {
      text-decoration: none;
      font-size: 1.25em;
      color: silver;
    }
      .footer a:hover {
        color: white;
      }

      .brand svg {
        height: 9em;
        width: 9em;
      }

    .navigation {
      display: none;
    }

      .nav-link {
        color: #4a4a4a;
        margin-left: 3.5em;
        text-decoration: none;
      }

      button.nav-link {
        background: none;
        outline: none;
        border: none;
        color: #ff6565;
      }

      .nav-link:hover {
        color: white;
      }

      .nav-link.current {
        color: white;
      }


  /* Convert to SVG animation for more krisp' */

  .brand:hover .beak {
    animation-duration: 3s;
    animation-name: moveMouth;
    animation-direction: alternate;
    animation-iteration-count: infinite;
  }

  .brand:hover .beard {
    animation-duration: 3s;
    animation-name: moveWeirdChickenBeard;
    animation-direction: alternate;
    animation-iteration-count: infinite;
  }

  @keyframes moveMouth {
    from { transform: translateX(0); }
    to { transform: translateX(5px); }
  }

  @keyframes moveWeirdChickenBeard {
    from { transform: translateY(0); }
    to { transform: translateY(5px); }
  }

  @media screen and (min-width: 666px) {
    .default {
      padding: 0 5em 7.5em;
    }

    .header {
      justify-content: space-between;
    }

      .navigation {
        display: block;
      }

        .brand svg {
          height: 4em;
          width: 4em;
        }


    .mobile-nav-trigger {
      display: none;
    }
  }

  @media screen and (max-width: 665px) {
    .nav-link {
      text-align: right;
      font-size: 1.3em;
    }
    .mobile-nav-trigger {
      display: block;

      margin-left: 1rem;
      width: 3rem;  
      height: 3rem;
      fill: #ff6565;
    }
    .navigation {
      display: flex;
      position: fixed;
      bottom: -35vh;
      right: 1.75rem;
      flex-direction: column;
      transition: bottom .3s ease;
    }
  }
</style>
