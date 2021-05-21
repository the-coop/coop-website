<template>
  <div class="default">
    <div class="header">
      <div class="brand">
        <Logo />
      </div>
      <nav class="navigation">
        <NuxtLink to="/" class="nav-link current">
          Home
        </NuxtLink>
        <a href="https://discord.gg/2gTTUZbRVD" target="_blank" class="nav-link">Apply</a>
      </nav>
    </div>
    <Nuxt />

    <footer class="footer">
      <h2 class="subtitle">
        Other Links
      </h2>
      <NuxtLink to="/conquest">
        Conquest
      </NuxtLink>
    </footer>
  </div>
</template>

<style>
  .default {
    padding: 0 1.5em 7.5em;

    position: relative;
    overflow: hidden;
    width: 100vw;
    box-sizing: border-box;
    min-height: 100vh;
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
    from {
      transform: translateX(0);
    }

    to {
      transform: translateX(5px);
    }
  }

  @keyframes moveWeirdChickenBeard {
    from {
      transform: translateY(0);
    }

    to {
      transform: translateY(5px);
    }
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
  }
</style>
