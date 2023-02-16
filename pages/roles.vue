<template>
  <div>
    <h1 class="title">⚙️ Roles</h1>

    <div v-show="$auth.$state.loggedIn">
      <h2 class="subtitle">
        Not authenticated, login to modify roles.
      </h2>
      <LoginBlock intent="roles" extraClass="roles-login" />
    </div>

    <div class="roles-interface">

      <div :v-if="roles" class="category" v-for="category in categories" :key="category">
        <h2>{{ category }}</h2>
        <div class="options">
          <div class="option" v-for="role in options.filter(r => r.category === category)" :key="role.id">
            <Toggle
              :label="role.name"
              :roleID="role.id"
              :owned="roles.some(r => r.role_id === role.id)"
              :locked="role.locked"
            />

          <div class="option-description">{{ role.description }}</div>
          </div>
        </div>
      </div>

    </div>
  </div>
</template>

<script>
  import ROLES from "coop-shared/config/roles.mjs";
  import API from "~/lib/api/api";
  import LoginBlock from '~/components/users/LoginBlock.vue';
  import Toggle from '~/components/Toggle.vue';

  export default {
    components: { LoginBlock, Toggle },
    async mounted() {
      this.options = Object.keys(ROLES).map(r => ROLES[r]);

      // TODO:
      // alert('ADD CATEGORY EMOJIS');
      // alert('ADD DISABLED OPTIONS / LOCKED (REWARDS)');

      if (this.$auth.loggedIn)
        this.roles = (await API.getAuthed('members/roles', this.$auth)).data;
    },
    data() {
      return {
        options: [],
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
  .roles-interface{
    display: flex;
    color: white;
    flex-direction: column;
    text-align: left;
  }

  .roles-login{
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

  .category{
    border-right: 0.1em solid #ff656559;
    padding: 0.2em;
  }

  .option{
    margin: 0.5em 0 0.5em;
  }

  .option-description{
    font-weight: 200;
    color: rgb(147, 147, 147)
  }

  .option svg {
    width: 5em;
  }


/* The below designs are planned to be used for 'Tablet' devices */
/*
  .roles-interface {
    display: flex;
    color: white;
    flex-direction: column;
    text-align: center;
    gap: 1em;
  }

  .category{
    border: 0.1em solid #ff656559;
    border-radius: 1em;
    padding: 0 0.5em 0.5em;
    width: 100%;
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

  .options{
    display: flex;
    flex-direction: row;
    flex-wrap: wrap;
    gap:1.5em;
  }

  .option{
    flex: 1 0 23%;
    text-align: center;
    max-width: 23%;
  }

  .option svg {
    width: 5em;
  } */

  @media (min-width: 800px) {
    .roles-interface {
      justify-content: space-evenly;
      flex-wrap: wrap;
      flex-direction: row;
    }
  }


</style>
