<template ref="layout">
  <div :class="['default', page].join(' ')">
    <div class="header">

      <nav class="navigation additional-navigation">
        <NuxtLink to="/conquest/world" class="nav-link" @click.native="closeMenu">
          🕹️ Play
        </NuxtLink>

        <NuxtLink to="/guide" class="nav-link" @click.native="closeMenu">
          📖 Guide
        </NuxtLink>

        <a 
          @click="closeMenu"
          v-show="!this.$auth.$state.user" 
          :href="inviteLink" target="_blank" class="nav-link">
          👋 Join
        </a>

        <a 
          @click="closeMenu"
          v-show="this.$auth.$state.user" 
          href="https://fund-the-coop.raisely.com" target="_blank" class="nav-link">
          💸 Donate
        </a>
      </nav>

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
        <div class="dropdown">
          <span class="dropdown-label" @click="toggleDropdown">🥚 Community</span>

          <div class="dropdown-content">
            <!-- <NuxtLink to="/services" class="nav-link" @click.native="closeMenu">
              🏷️ Services
            </NuxtLink> -->

            <NuxtLink to="/" class="nav-link current" @click.native="closeMenu">
              🏠 Home
            </NuxtLink>

            <NuxtLink to="/vision" class="nav-link current" @click.native="closeMenu">
              📄 Vision
            </NuxtLink>

            <NuxtLink to="/members" class="nav-link" @click.native="closeMenu">
              🔮 Members
            </NuxtLink>
            
            <NuxtLink to="/blog" class="nav-link" @click.native="closeMenu">
              🗞️ Blog
            </NuxtLink>

            <NuxtLink to="/roles" class="nav-link" @click.native="closeMenu">
              ⚙️ Roles
            </NuxtLink>

            <NuxtLink to="/projects" class="nav-link" @click.native="closeMenu">
              👷 Projects
            </NuxtLink>
          </div>
        </div>

        <div class="dropdown">
          <span class="dropdown-label" @click="toggleDropdown">🗡 Conquest</span>

          <div class="dropdown-content">
            <NuxtLink to="/conquest" class="nav-link" @click.native="toggleMenu">
              📡 Dashboard
            </NuxtLink>

            <NuxtLink to="/conquest/world" class="nav-link" @click.native="closeMenu">
              🕹️ Play
            </NuxtLink>

            <NuxtLink to="/conquest/economy/items" class="nav-link" @click.native="closeMenu">
              🎁 Items
            </NuxtLink>

            <NuxtLink to="/conquest/economy/trade" class="nav-link" @click.native="closeMenu">
              💰 Trades
            </NuxtLink>

            <NuxtLink to="/shop" class="nav-link" @click.native="closeMenu">
              🛍️ Shop
            </NuxtLink>
          </div>
        </div>

        <NuxtLink v-show="!this.$auth.$state.user" to="/auth/login" class="nav-link" @click.native="closeMenu">
          🔑 Login
        </NuxtLink>

        <div class="dropdown" v-show="this.$auth.$state.user">
          <span class="dropdown-label" @click="toggleDropdown">
            <img 
              v-show="this.$auth.$state.user"
              :class="[
                'profile-image', 
                this.$auth.$state.user ? 'profile-image-loaded' : ''
              ].join(' ')"
              :src="this.$auth.$state.user?.image" />
            {{ this.$auth.$state.user?.username }}
          </span>
          
          <div class="dropdown-content">
            <NuxtLink to="/conquest/economy/items" 
              class="nav-link" @click.native="closeMenu">
              🎁 Items
            </NuxtLink>
            <NuxtLink
              :to="this.$auth.$state.user ? '/members/' + this.$auth.$state.user.discord_id : '/members'"
              class="nav-link"
              @click="closeMenu">👤 Profile
            </NuxtLink>
            <span
              class="nav-link"
              @click="() => { logout(); closeMenu(); }">⏏️ Logout
            </span>
          </div>
        </div>
      </nav>
    </div>

    <!-- 
    <div class="header-socials">
      <a href="https://www.twitch.tv/thecoop_twitch/" target="_blank">
        <Twitch />
      </a>
      <a href="https://www.youtube.com/channel/UCC823jVQUkZtm8bcW-9bEKA" target="_blank">
        <Youtube />
      </a>
      <a href="https://github.com/the-coop/" target="_blank">
        <Github />
      </a>
      TODO: Add Reddit 
      <a href="https://www.instagram.com/thecoop_ig/" target="_blank">
        <Instagram />
      </a>
      <a href="https://twitter.com/thecoopg" target="_blank">
        <Twitter />
      </a> 
    </div>
    -->

    <Nuxt user="this.$auth.$state.user" />

    <div class="footer-socials">
      <h4 class="footer-socials-prompt">Follow?</h4>
      <div class="footer-socials-items">
        <a href="https://www.twitch.tv/thecoop_twitch/" target="_blank">
          <Twitch />
        </a>
        <a href="https://www.youtube.com/channel/UCC823jVQUkZtm8bcW-9bEKA" target="_blank">
          <Youtube />
        </a>
        <a href="https://github.com/the-coop/" target="_blank">
          <Github />
        </a>
      </div>
    </div>
  </div>
</template>

<script>
  import anime from 'animejs/lib/anime.es';

  import Twitch from '../components/socials/Twitch.vue';
  import Youtube from '../components/socials/Youtube.vue';
  import Github from '../components/socials/Github.vue';
  import Twitter from '../components/socials/Twitter.vue';
  import Instagram from '../components/socials/Instagram.vue';
  import { inviteLink } from '~/lib/config';
  
  const closedBottom = '-100%';

  export default {
    components: {
      Twitch,
      Youtube,
      Github,
      Instagram,
      Twitter
    },
    async mounted() {
      // When the dropdown menu is hovered...
      // Should trigger an event which blocks the now upwards moving box re-triggering CSS hover.
      const dropdowns = Array.from(document.querySelectorAll('.dropdown'));
      dropdowns.map(dropdown => {
        dropdown.addEventListener('mouseleave', ev => {
          const content = ev.target.querySelector('.dropdown-content');
          if (content) {
            // 1. Turn off pointer-events for the duration of the hiding animation.
            content.style.pointerEvents = "none";

            // 2. Then re-enable.
            setTimeout(() => content.removeAttribute('style'), 333);
          }
          // 3. [Investigate if problems] - Make sure these are accessible for cleanup.
        });
      });
    },
    methods: {
      async logout() {
        this.user = null;
        await this.$auth.logout();
      },
      toggleDropdown(ev) {
        // Hide all other dropdowns.
        Array.from(document.querySelectorAll('.dropdown.open'))
          .map(d => d.classList.remove('open'));

        // Toggle the visibility for mobile.
        if (this.isMobileSize()) 
          ev.target.parentElement.classList.toggle('open');
      },
      isMobileSize() {
        return window.matchMedia("(max-width: 850px)")?.matches;
      },
      closeMenu(ev = null)  {
        anime({
          targets: '.navigation',
          bottom: closedBottom,
          duration: 125
        });

        // If mobile, attempt to toggle containing dropdown. :)
        if (ev && this.isMobileSize())
          ev.target.parentElement.parentElement.classList.remove('open');
      },
      toggleMenu(ev) {
        const menu = document.querySelector('.navigation');
        const isOpen = menu.style.bottom === '0vh';
        const targetBottom = isOpen ? closedBottom : '0vh';
        anime({
          targets: '.navigation',
          bottom: targetBottom,
          duration: 250
        });

        // If mobile, attempt to toggle containing dropdown. :)
        if (this.isMobileSize()) {
          // Make sure the desktop menu stays open.
          ev.target.parentElement.parentElement.classList.toggle('open');

          // Attach mobile menu self-hiding.
          const menuCloser = this.closeMenu;
          function blurHandler(ev) {
            ev.preventDefault();

            ev.composedPath().map(elem => {
              console.log(elem);
              console.log(elem.classList);
              console.log(elem.classList.contains('navigation'));
            });

            let clickOnMenu = false;
            if (!clickOnMenu) {
              document.removeEventListener('click', this);
              menuCloser();
            }
          }

          if (!isOpen)
            document.addEventListener('click', blurHandler);
        }
      }
    },
    data() {
      return { 
        page: this.$route.name,
        inviteLink
      };
    },
    watch: {
      $route(value) {
        this.page = value.name;
      }
    }
  };
</script>

<style>
  .default {
    padding: 0 1.5em;

    position: relative;
    width: 100%;
    box-sizing: border-box;

    overflow-x: hidden;
  }

  .header {
    display: flex;
    justify-content: center;
    align-items: center;
    flex-wrap: wrap;
    padding: 1.5em 0;
  }

  .header-socials {
    flex: 100%;
    text-align: center;
  }

  .header-socials img {
    width: 2em;
  }

  /* Temporary until someone can do better. */
  .footer {
    padding: 2.5rem 0rem;
  }
    .footer-socials {
      margin-top: 12rem;
      text-align: right;
    }
    .footer-socials-prompt {
      font-size: 1.15em;
      color: silver;
      margin: 0;
    }
    .footer-socials svg {
      width: 2em;
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


    .mobile-nav-trigger {
      display: block;

      cursor: pointer;

      margin-left: 1rem;
      width: 3rem;  
      height: 3rem;
      fill: #ff6565;
    }

    .mobile-nav-trigger:hover {
      fill: white;
    }

      .dropdown {
        display: inline-flex;
        position: relative;
        /* margin-left: 3.5em; */
        flex-direction: column;
      }

      .dropdown:hover .dropdown-content {
        top: 100%;
        opacity: 1;
        pointer-events: all;
      }

      .dropdown-label {
        display: inline-flex;
        color: #616060;
        cursor: pointer;
        align-items: center;
      }

      .dropdown-label:hover {
        color: white;
      }

      .dropdown-content {
        position: absolute;
        top: 50%;
        opacity: 0;
        transition: 
          top .25s ease,
          opacity .125s ease,
          background-color .25s ease-in;

        min-width: 9em;
        display: flex;
        flex-direction: column;
        
        background-color: transparent;

        pointer-events: none;

        z-index: 1;
      }

      .dropdown-content .nav-link {
        border: .125em solid rgb(117, 117, 117);
        border-radius: .25em;
        margin-bottom: .25em;
        padding: .25em .5em;
        margin-left: 0;

        transition: border-color .2s, border-radius .2s;
      }

      .dropdown-content .nav-link:hover {
        border-color: #ff6565;
        border-radius: 0;
      }

      .dropdown.open .dropdown-content {
        top: 100%;
        opacity: 1;
        pointer-events: all;
      }

      .nav-link {
        color: #616060;
        
        text-decoration: none;
        cursor: pointer;

        display: inline-flex;
        align-items: center;
      }

      .nav-link:first-child {
        margin-left: 0;
      }

      .profile-image {
        height: 2em;
        width: 2em;
        border-radius: 100%;
        border: .1em solid #ff6565;
        margin-right: .75em;

        opacity: 0;
        transition: opacity .4s;
        transition-delay: 250ms;
      }

      .profile-image-loaded {
        transition-delay: 250ms;
        opacity: 1;
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

  .brand .logo * {
    fill: #ff6565;
  }
  .brand:hover .logo * {
    fill: white;
  }

  @media screen and (min-width: 850px) {
    .navigation {
      display: flex;
      align-items: center;
    }
    .mobile-nav-trigger {
      display: none;
    }

    .dropdown.open .dropdown-content, .dropdown:hover .dropdown-content {
      background-color: #111111;
    }
  }

  @media screen and (min-width: 850px) {
    .default {
      padding: 0 5em 7.5em;
    }

    .header {
      justify-content: space-between;
    }

        .brand svg {
          height: 4em;
          width: 4em;
        }

        .header-socials {
          text-align: left;
        }

        .dropdown {
          margin-left: 3.5em;
          flex-direction: row;
        }

        .nav-link {
          margin-left: 3.5em;
        }

        .dropdown .nav-link {
          transition: transform .2s, opacity .2s;
          opacity: 0;
          transform: translateY(2em);
        }

        .dropdown .nav-link:nth-child(1) { transition-delay: .1s }
        .dropdown .nav-link:nth-child(2) { transition-delay: .2s }
        .dropdown .nav-link:nth-child(3) { transition-delay: .3s }
        .dropdown .nav-link:nth-child(4) { transition-delay: .4s }
        .dropdown .nav-link:nth-child(5) { transition-delay: .5s }
        .dropdown .nav-link:nth-child(6) { transition-delay: .6s }

        .dropdown:hover .nav-link {
          opacity: 1;
          transform: translateY(0);
        }
  }

  @media screen and (max-width: 850px) {
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
      
      border-radius: 1rem;
    }
    .dropdown-content .nav-link:hover {
      color: #f76465;
    }
    .dropdown.open .dropdown-content {
      display: flex;
      position: static;
    }

    .navigation {
      display: flex;
      position: fixed;
      bottom: -50vh;
      right: 0;
      flex-direction: column;
      transition: bottom .3s ease;
      padding: 2rem;

      z-index: 3;

      background: rgba(17, 17, 17, 0.9);
      border-radius: 1rem 0;
    }


  }

  .additional-navigation { 
    display: none; 
  }

  @media screen and (min-width: 1200px) {
    .header {
      display: flex;
      justify-content: space-evenly;
      flex-wrap: nowrap;
    }

    .navigation {
      flex: calc(50% - 2em) 0;
      text-align: left;
    }

    .additional-navigation {
      display: flex;
      justify-content: flex-end;
    }

    .navigation .dropdown:first-child {
      margin-left: 0;
    }

    .brand {
      flex: 5em 0 0;
      text-align: center;
      padding: 1.5em 2.5em .25em;
    }

    .header-socials {
      text-align: center;
      display: none;
    }
  }
</style>
