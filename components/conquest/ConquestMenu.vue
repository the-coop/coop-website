<template>
  <div class="conquest-menu">
    <!-- 
      <NuxtLink to="/conquest/fight" class="conquest-menu-item">
        <img 
          class="conquest-menu-image"
          src="/conquest/fight.jpeg" alt="Conquest fight level thumbnail">
        <span class="conquest-menu-item-link-label">
          Fight
        </span>
      </NuxtLink>
    -->
    <NuxtLink to="/conquest/world" class="conquest-menu-item">
      <img 
        class="conquest-menu-image"
        src="/conquest/world.png" alt="Conquest world level thumbnail" />

      <span class="conquest-menu-item-link-label">
        Coopverse
      </span>
    </NuxtLink>

    <NuxtLink 
      to="/conquest/leaderboard"
      class="conquest-menu-item">
      <span class="conquest-menu-item-link-label">
        Leaderboard
      </span>
    </NuxtLink>

    <NuxtLink 
      to="/conquest/economy/trade"
      class="conquest-menu-item">
      <span class="conquest-menu-item-link-label">
        Trade
      </span>
    </NuxtLink>
    
    <div class="conquest-menu-item disabled">
      <span 
        class="conquest-menu-item-link-label"
        to="/conquest/leaderboard">Info: Economy</span>
    </div>


    <div class="conquest-menu-item disabled">
      <span 
        class="conquest-menu-item-link-label"
        to="/conquest/leaderboard">Info: Conflict</span>
    </div>
  </div>
</template>

<style scoped>
  .conquest-menu {
    display: flex;
    flex-wrap: wrap;
    
    margin-top: 2.5rem;
  }

  .conquest-menu-item {
    height: 11em;
    flex: 100% 0 0;

    font-size: 1.35em;
    
    position: relative;
  }

  @media (min-width: 1200px) {
    .conquest-menu-item {
      flex: calc(50% - .45rem) 0 0;
    }
  }

  .conquest-menu-image {
    position: absolute;
    left: 0;
    top: 0;

    max-width: 100%;
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .conquest-menu-item-link-label {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);

    color: #ff6565;
  }
  .conquest-menu-item:hover .conquest-menu-item-link-label, .conquest-menu-item:focus .conquest-menu-item-link-label {
    color: white;
  }
  .conquest-menu-item:hover .conquest-menu-image, .conquest-menu-item:focus .conquest-menu-image {
    opacity: .25;
  }
  .conquest-menu-item:visited .conquest-menu-item-link-label {
    text-decoration: none;
  }
  .conquest-menu-item.disabled {
    cursor: not-allowed;
  }
</style>