<template>
  <div>
    <h1 class="title">⚙️ Roles</h1>

    <div v-show="!$auth.$state.loggedIn">
      <h2 class="subtitle">
        Not authenticated, login to modify roles.
      </h2>
      <LoginBlock intent="roles" extraClass="roles-login" />
    </div>

    <div class="roles-interface">


      <div class="category" v-for="category in categories" :key="category">
        <h2>{{ category }}</h2>
        <div class="options">
          <div class="option" v-for="role in roles.filter(r => r.category === category)" :key="role.id">
            <Toggle :label="role.name" />
          </div>
        </div>
      </div>

    </div>
  </div>
</template>

<script>
  import LoginBlock from '~/components/users/LoginBlock.vue';
  import Toggle from '~/components/Toggle.vue';
  import ROLES from "coop-shared/config/roles.mjs";

  export default {
    components: { LoginBlock, Toggle },
    mounted() {
      this.roles = Object.keys(ROLES).map(r => ROLES[r]);
    },
    data() {
      return {
        roles: [],
        categories: [
          'INTEREST',
          'ACCESS',
          'NOTIFICATION',
          'REWARD',
          'DEMOCRACY'
        ]
      };
    }
};
</script>


<style>
  .roles-interface {
    display: flex;
    justify-content: space-between;
    color: white;
  }
  .roles-login {
    position: fixed;
    flex: 100%;
    top: 50%;
    left: 50%;

    transform: translate(-50%, -50%);
    padding: 2em;

    z-index: 1;

    background-color: rgba(22, 22, 22, 0.75);
    border-radius: 2em;
  }

  .option svg {
    width: 5em;
  }
</style>