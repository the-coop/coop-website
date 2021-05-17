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
      <NuxtLink to="/conquest">
        Conquest
      </NuxtLink>
    </footer>
  </div>
</template>

<style>
  body, html {
    font-family: Poppins, sans-serif;
    background-color: #111;
  }

  .default {
    padding: 0 5em;
  }

  .header {
    display: flex;
    flex-direction: row;
    justify-content: space-between;
    align-items: center;
    padding: 2.5em 0;
  }

  /* Temporary until someone can do better. */
  .footer {
    display: inline-block;
    position: absolute;

    right: 5rem;
    bottom: 1.25rem;
  }

  .footer a {
    text-decoration: none;
    font-size: 1.25em;
    color: silver;
  }

  .navigation {
    
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
</style>
