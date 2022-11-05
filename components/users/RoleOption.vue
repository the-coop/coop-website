<template>
  <div>
    ROLE OPTION
  </div>
</template>

<style scoped>

</style>

<script>
import ItemIcon from '../conquest/ItemIcon.vue';
  const filteredRoles = ['MEMBER', 'SUBSCRIBER', 'SOCIAL'];
  const skillLevelRoles = ['BEGINNER', 'INTERMEDIATE', 'MASTER'];
  export default {
    props: ["users"],
    methods: {
        sortRoles(roleList) {
            // Not working atm.
            // roleList.sort((roleA, roleB) => {
            //   if (roleA === 'COMMANDER') return 1;
            //   if (skillLevelRoles.includes(roleA)) return 0;
            //   return 0;
            // });
            return roleList;
        },
        filterRole(role) {
            return !filteredRoles.includes(role);
        }
    },
    components: { ItemIcon }
}
</script>