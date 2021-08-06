<template>
  <div class="default">
    <div class="header">
      <div class="brand">
        <NuxtLink to="/">
          <Logo />
        </NuxtLink>
      </div>
      <svg @click="toggleMenu" class="mobile-nav-trigger" viewBox="0 0 100 80">
        <rect width="100" height="20"></rect>
        <rect y="30" width="100" height="20"></rect>
        <rect y="60" width="100" height="20"></rect>
      </svg>
      <nav class="navigation">
        <NuxtLink to="/" class="nav-link current" @click.native="toggleMenu">
          Home
        </NuxtLink>

        <NuxtLink to="/blog" class="nav-link" @click.native="toggleMenu">
          Blog
        </NuxtLink>

        <NuxtLink to="/conquest" class="nav-link" @click.native="toggleMenu">
          Conquest
        </NuxtLink>
        
        <!-- Actions for guests/non-users/logged out users -->
        <NuxtLink v-show="!$auth.$state.loggedIn" to="/auth/login" class="nav-link" @click.native="toggleMenu">
          Login
        </NuxtLink>

        <a 
          @click="toggleMenu"
          v-show="!$auth.$state.loggedIn" 
          href="https://discord.gg/2gTTUZbRVD" target="_blank" class="nav-link">
          Apply
        </a>

        <!-- Actions for logged un users -->
        <NuxtLink v-show="$auth.$state.loggedIn" to="/profile" class="nav-link" @click.native="toggleMenu">
          Profile
        </NuxtLink>

        <button v-show="$auth.$state.loggedIn" 
          class="nav-link"
          @click="() => { logout(); toggleMenu(); }">Logout</button>

      </nav>
    </div>
    <Nuxt />
  </div>
</template>

<script>
  import anime from 'animejs/lib/anime.es';

  export default {
    methods: {
      async logout() {
        await this.$auth.logout();
      },
      toggleMenu() {
        const menu = document.querySelector('.navigation');
        const targetBottom = menu.style.bottom === '0vh' ? '-50vh' : '0vh';
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
    width: 100vw;
    box-sizing: border-box;
  }

  .header {
    display: flex;
    justify-content: center;
    align-items: center;

    padding: 1.5em 0;

    /* padding: 2.5em 0; */
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
        height: 7em;
        width: 7em;
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
      margin-bottom: 1rem;
    }
    .mobile-nav-trigger {
      display: block;

      cursor: pointer;

      margin-left: 1rem;
      width: 3rem;  
      height: 3rem;
      fill: #ff6565;
    }

    .navigation {
      display: flex;
      position: fixed;
      bottom: -50vh;
      right: 0;
      flex-direction: column;
      transition: bottom .3s ease;
      padding: 2rem;

      background: #111111;
      border-radius: 1rem;
    }
  }
</style>
