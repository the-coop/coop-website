<template>
  <div :class="`toggle ${locked ? 'locked' : ''}`" v-on:click="toggle">
    <svg viewBox="0 0 351 147">
      <rect class="holder" x="2" y="2" width="347" height="147" rx="65" :fill="!toggled ? '#D9D9D9' : '#38CE5B'" stroke="#818181" strokeWidth="4" />
      <rect class="handle" :x="!toggled ? 21 : 210" y="17" width="121" height="117" rx="58.5" fill="#F8F4F1" />
    </svg>
    {{ label }}
  </div>
</template>

<style scoped>
  .toggle {
    display: flex;
    align-items: center;
    user-select: none;
    cursor: pointer;
  }
  
  svg {
    margin-right: .5em;
  }

  rect {
    transition: x .5s, fill .5s;
  }

  .locked .holder {
    fill: rgb(187, 0, 0);
  }
  .locked .handle {
    fill: rgb(229, 11, 11);
  }
</style>

<script>
  import API from "~/lib/api/api";

  export default {
    props: ['label', 'roleID', 'owned', 'locked'],
    methods: {
      async toggle() {
        // Visually change role first or user may double click impatiently.
        this.toggled = !this.toggled;

        try {
          const payload = { role: this.roleID, preference: this.toggled };
          const roleResp = (await API.postAuthed("members/roles/toggle", payload, this.$auth)).data;

          if (!roleResp.success)
            this.toggled = !this.toggled;

        } catch(e) {
          // Revert due to failure.
          this.toggled = !this.toggled;
        }
      }
    },
    data() { 
      return { toggled: false };
    },
    watch: { 
      owned(toggled) {
        this.toggled = toggled;
      }
    }
};
</script>
