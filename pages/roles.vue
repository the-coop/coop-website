<template>
  <div>
    <h1 class="title">⚙️ Roles</h1>

    <div v-show="!$auth.$state.loggedIn">
      <h2 class="subtitle">
        Not authenticated, login to modify roles.
      </h2>
      <LoginBlock />
    </div>

    <div class="roles-interface">
      <div class="category">
        <h2>Interest</h2>
        <div class="options">
          <div v-for="role in roles.filter(r => r.category === 'INTEREST')" :key="role.id">
            {{ role.id }}
          </div>
        </div>
      </div>

      <div class="category">
        <h2>Notirifcations</h2>
        <div class="options">
          <div v-for="role in roles.filter(r => r.category === 'INTEREST')" :key="role.id">
            {{ role.id }}
          </div>
        </div>
      </div>

      <!-- <p>---- SPECIALIZATIONS ----</p>
      <p>---- OTHER ----</p>
      <p>---- SKILL LEVELS ----</p> -->

      <p>---- REWARD ----</p>

      <!-- 
      Leader 723676356818239773
      Supporter 904477558928715776
      Former Commander 799113973282111541
      Richest 821922924138463232
      Tech Event 916478331908669440
      Logs 📉 796495195930886155
  
      Stocks Early Bird ⏰ 1004584945202765844
      
      Announcement 📢 726835640804704267
      Stocks Spam Victims 1004588123877023755
      Art 🖌️ 727513157374967879
      Business Event 916478284437520434
      Gaming  🎮 811317877151760384
      Social 💬 799419324485599242
      Minigame Ping 📦 916135701488209940
  
      Democracy Ping ?
      Intro Posted Ping 👋 916116514401316904
      
      Tech 727512898741600358
      MOST Points 780116637197926420
      Conquest 🗡️ 799318574077444107
  
      Prospect 811689644131483648
      Money 💰 725531758744961114
      Tech Spam Victims 1020747862960775188
      Member 724394130465357915
      Commander 👑 727311131705868299
      Academy 733739784643674253
      Art Event 916478169949818941
      
      New Coop Day 1029396511789953075
      Beginner 725531274973937664
      Projects👷 799318707246727188
      Member OF WEEK 725406725615779922
      
      Intermediate 726394740412776450
      
      Art Spam Victims 1020749616196616273
      MOST Items 821922830613479424
      Master 725531525398921335
   -->
      <!-- Cooper 799699580228861962 -->
      <!-- Agency 733739458855174265 -->
    </div>
  </div>
</template>

<script>
  import LoginBlock from '~/components/users/LoginBlock.vue';
  // import { inviteLink } from '~/lib/config';
  import ROLES from "coop-shared/config/roles.mjs";

  export default {
    components: { LoginBlock },
    mounted() {
      this.roles = Object.keys(ROLES).map(r => ROLES[r]);
      // console.log(ROLES);
    },
    data() {
      return {
        roles: []
      };
    }
};
</script>


<style scoped>
  .roles-interface {
    color: white;
  }
</style>