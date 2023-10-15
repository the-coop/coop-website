<template>
  <div class="page-wrapper content-container">
    <h1 class="title">🎮 Minigames</h1>
    <hr/>
    <div class="games">
      <div class="game" @click="() => this.$router.push('/guide/minigames/egghunt')">
        <div class="game-title">
          Egg hunt
        </div>
        <div class="game-img" :style="{ backgroundImage: `url('/mountain-sil.png')` }"></div>
      </div>
      <div class="game" @click="() => this.$router.push('/guide/minigames/morality')">
        <div class="game-title">
          Morality
        </div>
        <div class="game-img" :style="{ backgroundImage: `url('/mountain-sil.png')` }"></div>
      </div>
      <div class="game" @click="() => this.$router.push('/guide/minigames/egghunt')">
        <div class="game-title">
          Game 3
        </div>
        <div class="game-img" :style="{ backgroundImage: `url('/mountain-sil.png')` }"></div>
      </div>
      <div class="game" @click="() => this.$router.push('/guide/minigames/egghunt')">
        <div class="game-title">
          Game 4
        </div>
        <div class="game-img" :style="{ backgroundImage: `url('/mountain-sil.png')` }"></div>
      </div>
      <div class="game" @click="() => this.$router.push('/guide/minigames/egghunt')">
        <div class="game-title">
          Game 5
        </div>
        <div class="game-img" :style="{ backgroundImage: `url('/mountain-sil.png')` }"></div>
      </div>
      <div class="game" @click="() => this.$router.push('/guide/minigames/egghunt')">
        <div class="game-title">
          Game 6
        </div>
        <div class="game-img" :style="{ backgroundImage: `url('/mountain-sil.png')` }"></div>
      </div>
    </div>
  </div>
</template>

<style scoped>
  @import "../../../assets/style/documentation.scss";


  .games {
    display: flex;
    flex-direction: row;
    justify-content: center;
  }

  .game {
    text-transform: capitalize;
    width: 27%;
    border: .05em solid rgb(176, 54, 54);
  }
</style>
