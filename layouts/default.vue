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
        <NuxtLink to="/" class="nav-link current" @click.native="closeMenu">
          🏠 Home
        </NuxtLink>

        <div class="dropdown">
          <span class="dropdown-label" @click="toggleDropdown">🥚 Community</span>

          <div class="dropdown-content">
            <NuxtLink to="/blog" class="nav-link" @click.native="closeMenu">
              🗞️ Blog
            </NuxtLink>
            <NuxtLink to="/projects" class="nav-link" @click.native="closeMenu">
              👷 Projects
            </NuxtLink>
            <NuxtLink to="/members" class="nav-link" @click.native="closeMenu">
              🔮 Members
            </NuxtLink>

            <!-- Actions for guests/non-users/logged out users -->
            <NuxtLink v-show="!$auth.$state.loggedIn" to="/auth/login" class="nav-link" @click.native="closeMenu">
              🔑 Login
            </NuxtLink>

            <a 
              @click="closeMenu"
              v-show="!$auth.$state.loggedIn" 
              href="https://discord.gg/dgexRwFCkc" target="_blank" class="nav-link">
              🚪 Join
            </a>

            <!-- Actions for logged in users -->
            <NuxtLink v-show="$auth.$state.loggedIn" to="/profile" class="nav-link" @click.native="closeMenu">
              👤 Profile
            </NuxtLink>

            <button v-show="$auth.$state.loggedIn" 
              class="nav-link"
              @click="() => { logout(); closeMenu(); }">⏏️ Logout</button>
          </div>
        </div>


        <NuxtLink to="/conquest" class="nav-link" @click.native="toggleMenu">
          🗡 Conquest
        </NuxtLink>
      </nav>
    </div>
    <Nuxt />
  </div>
</template>

<script>
  import anime from 'animejs/lib/anime.es';


  const closedBottom = '-50vh';

  export default {
    methods: {
      async logout() {
        await this.$auth.logout();
      },
      toggleDropdown(ev) {
        if (this.isMobileSize()) ev.target.parentElement.classList.toggle('open');
      },
      isMobileSize() {
        return window.matchMedia("(max-width: 665px)")?.matches;
      },
      closeMenu(ev = null)  {
        anime({
          targets: '.navigation',
          bottom: closedBottom,
          duration: 250
        });

        // If mobile, attempt to toggle containing dropdown. :)
        if (ev && this.isMobileSize())
          ev.target.parentElement.parentElement.classList.remove('open');
      },
      toggleMenu(ev) {
        const menu = document.querySelector('.navigation');
        const targetBottom = menu.style.bottom === '0vh' ? closedBottom : '0vh';
        anime({
          targets: '.navigation',
          bottom: targetBottom,
          duration: 250
        });

        // If mobile, attempt to toggle containing dropdown. :)
        if (window.matchMedia("(max-width: 665px)"))
          ev.target.parentElement.parentElement.classList.toggle('open');
      }
    }
  }
</script>

<style>
  .default {
    padding: 0 1.5em;

    position: relative;
    width: 100%;
    box-sizing: border-box;
  }

  .header {
    display: flex;
    justify-content: center;
    align-items: center;

    padding: 1.5em 0;
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

      .dropdown {
        display: inline-block;
        position: relative;
        margin-left: 3.5em;
      }

      .dropdown:hover .dropdown-content {
        top: 100%;
        opacity: 1;
      }

      .dropdown-label {
        color: #4a4a4a;
        cursor: pointer;
      }

      .dropdown-label:hover {
        color: white;
      }

      .dropdown-content {
        position: absolute;
        top: -100vh;
        opacity: 0;
        transition: 
          top .3s ease,
          opacity .3s ease;

        min-width: 8rem;
        display: flex;
        flex-direction: column;

        padding: 2rem;
        background: #111111;

        z-index: 1;
      }

      .dropdown-content .nav-link {
        margin-left: 0;
      }

      .dropdown.open .dropdown-content {
        top: 100%;
        opacity: 1;
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

        cursor: pointer;
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
    .dropdown-label {
      font-size: 1.3em;
    }
    .dropdown {
      margin-bottom: 1rem;
      text-align: right;
    }
    .dropdown-content {
      display: none;

      margin-top: 1rem;
      
      background: #ffffff;
      border-radius: 1rem;

      padding: 1rem 2rem 0;
    }
    .dropdown-content .nav-link:hover {
      color: #f76465;
    }
    .dropdown.open .dropdown-content {
      display: flex;
      position: static;
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
