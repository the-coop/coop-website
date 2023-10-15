<template>
  <div class="content-container">
    <h1 class="title">🔪Sacrifice</h1>
    <hr />

    <div class="inner-container">
      <p class="text">
        TheCoop sacrifice ritual is an event that occurs when a condition is fulfilled. The condition
        being that at least <span class="var">5%</span> of the entire server reacts to a user's message with the
        dagger emoji <img :src="twemote('dagger')" alt="dagger" class="emoji">
      </p>
      <p class="text">
        When this happens, cooper sends a message in chat which begins the sacrifice of the player
      </p>
      <p class="quote-text">Cooper message</p>
      <p class="text">
        Cooper then reacts to this message with a shield(<img :src="twemote('shield')" alt="shield" class="emoji">) and a dagger(<img :src="twemote('dagger')" alt="dagger" class="emoji">). This acts as a voting poll
        on wether to sacrifice the member or not. Clicking on the dagger is a vote to sacrifice, whereas clicking on the
        shield is a vote to spare the member
      </p>
      <p class="text">
        There are a few things you should note about <span class="quote-text">sacrifice</span>
        <ul>
          <li class="unordered-list">
            You cannot vote for/against yourself. Upon attempting to do this,
            <span class="quote-text">Cooper</span> will send the following message in chat:

            <p class="quote-text">
              <span class="var">User</span> you cannot vote for/against yourself. <img :src="twemote('dagger')" alt="dagger" class="emoji">
            </p>
          </li>
          <li class="unordered-list">
            You cannot vote if you're a prospect. Upon attempting to do this,
            <span class="quote-text">Cooper</span> will send the following message in chat:

            <p class="quote-text">
              <span class="var">User</span> you cannot vote as a PROSPECT. <img :src="twemote('dagger')" alt="dagger" class="emoji">
            </p>
          </li>
        </ul>
      </p>
      <p class="text">
        When a member is sacrificed, the person is banned from <span class="var">THECOOP™</span>, this is especially
        useful because spammers can be banned without admin intervention and instead
        via sweet, sweet democracy ... <img :src="twemote('tea')" alt="tea" class="emoji"><img :src="twemote('spockle')" alt="spockle" class="emoji">
      </p>
      <p id="emojis">
        🥚🧺🐰
      </p>
    </div>
  </div>
</template>

<script>
  import API from '~/lib/api/api';
  import twemoji from 'twemoji'
  export default {
    components: {
      twemoji
    },

    async mounted(){
      const span = document.getElementById('emojis')
      twemoji.parse(span, {
        callback: (icon) => {
          console.log(icon)
        }
      })
    },
    methods: {
      twemote: (emoji) => {
        return require(`../../../assets/twemojis/${emoji}.svg`)
      }
    }
  }
</script>

<style scoped>
  .content-container > hr{
    margin: 3rem 0;
  }

  .unordered-list{
    text-decoration: none !important;
  }

</style>
