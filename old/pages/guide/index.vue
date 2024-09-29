<template>
  <div class="page-wrapper content-container">
    <h1 class="title">📖 Guide</h1>
    <p class="text">Welcome to the guide with all the information you need
      ...<em class="note">
        texts in<span class="var"> red</span> red are variable :)
      </em>
    </p>

    <hr/>

    <div class="flexbox">
      <NuxtLink class="topic" to="/guide/minigames">Minigames</NuxtLink>

      <NuxtLink class="topic" to="/guide/conquest">Conquest</NuxtLink>

      <NuxtLink class="topic" to="/guide/community">Community</NuxtLink>

      <!-- <NuxtLink class="topic" to="/guide/sacrifice">Sacrifice</NuxtLink> -->
    </div>
  </div>
</template>

<style scoped>
  @import "../../assets/style/documentation.scss";

  hr {
    margin: 3em 0;
  }

  li {
    text-decoration: underline;
    cursor: pointer;
  }
</style>
