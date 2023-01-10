<template>
  <div class="content-container">
    <h1 class="title">📖 Guide</h1>
    <p class="text">Welcome to the guide with all the information you need
      ...<em class="note">
        texts in<span class="var"> red</span> red are variable :)
      </em>
    </p>

    <hr/>

    <ul style="color: white;">
      <div class="topic" @click="viewPage(1)">
        <li><h2 class="subtitle"><strong>Minigames</strong></h2></li>
      </div>
      <div class="topic" @click="viewPage(2)">
        <li><h2 class="subtitle"><strong>WoodCutting</strong></h2></li>
      </div>
      <div class="topic" @click="viewPage(3)">
        <li><h2 class="subtitle"><strong>Mining</strong></h2></li>
      </div>
    </ul>
  </div>
</template>

<style>
  @import "../../assets/style/documentation.scss";

  hr{
    margin: 3rem 0;
  }
</style>

<style scoped>
  li{
    text-decoration: underline;
    cursor: pointer;
  }
</style>

<script>
  export default{
    methods: {
      viewPage(num){
        let page
        switch(num){
          case 1:
            page="minigames"
            break;
          case 2:
            page=""
            break;
          case 3:
            page=""
            break;
        }
        this.$router.push('/guide/' + page)
      },
    }
  }
</script>
