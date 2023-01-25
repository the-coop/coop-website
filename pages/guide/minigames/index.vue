<template>
  <div class="content-container">
    <h1 class="title">Minigames</h1>
    <hr/>
    <div class="inner-container games">
      <div class="game" @click="viewGame(1)">
        <div class="game-title">
          Egg hunt
        </div>
        <div class="game-img">
          <img src="../../../assets/images/mountain-sil.png" alt="">
        </div>
      </div>
      <div class="game" @click="viewGame(2)">
        <div class="game-title">
          Game 2
        </div>
        <div class="game-img">
          <img src="../../../assets/images/mountain-sil.png" alt="">
        </div>
      </div>
      <div class="game" @click="viewGame(3)">
        <div class="game-title">
          Game 3
        </div>
        <div class="game-img">
          <img src="../../../assets/images/mountain-sil.png" alt="">
        </div>
      </div>
      <div class="game" @click="viewGame(4)">
        <div class="game-title">
          Game 4
        </div>
        <div class="game-img">
          <img src="../../../assets/images/mountain-sil.png" alt="">
        </div>
      </div>
      <div class="game" @click="viewGame(5)">
        <div class="game-title">
          Game 5
        </div>
        <div class="game-img">
          <img src="../../../assets/images/mountain-sil.png" alt="">
        </div>
      </div>
      <div class="game" @click="viewGame(6)">
        <div class="game-title">
          Game 6
        </div>
        <div class="game-img">
          <img src="../../../assets/images/mountain-sil.png" alt="">
        </div>
      </div>
    </div>
  </div>
</template>

<script>
  export default {

    methods: {

      viewGame(num){
        let page
        switch( num){
          case 1:
            page="egg-hunt";
            break;
          case 2:
            page="";
            break;
          case 3:
            page="";
            break;
          case 4:
            page="";
            break;
          case 5:
            page="";
            break;
          case 6:
            page="";
            break;
        }
        this.$router.push('/guide/minigames/'+page);
      },

    },
  }
</script>

<style scoped>
  hr {
    margin: 3rem 0;
  }

  .games {
    display: flex;
    flex-direction: row;
    justify-content: center;
  }

  .game {
    text-transform: capitalize;
    width: 27%;
    border: 1px solid red 3px
  }
</style>
