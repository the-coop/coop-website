<template>
  <div class="content-container">
    <h1 class="title">📖 Guide</h1>
    <p class="text">Welcome to the guide with all the information you need
      ...<em class="note">
        texts in<span class="var"> red</span> red are variable :)
      </em>
    </p>

    <hr/>

    <ul>
      <div class="topic">
        <li><h2 class="subtitle"><strong>Minigames</strong></h2></li>
      </div>
      <div class="topic">
        <li><h2 class="subtitle"><strong>Community</strong></h2></li>
      </div>
      <div class="topic">
        <li><h2 class="subtitle"><strong>Conquest</strong></h2></li>
      </div>
    </ul>

    <NuxtLink class="topic" to="/guide/minigames">
      Minigames
    </NuxtLink>
    <NuxtLink class="topic" to="/guide/conquest">
      Conquest
    </NuxtLink>
    <NuxtLink class="topic" to="/guide/community">
      Community
    </NuxtLink>
  </div>
</template>

<style scoped>
  @import "../../assets/style/documentation.scss";

  hr {
    margin: 3rem 0;
  }

  li {
    text-decoration: underline;
    cursor: pointer;
  }
</style>