<template>
  <div class="content-container">
    <h1 class="title">📖 Guide</h1>
    <p class="text">Welcome to the guide with all the information you need
      ...<em class="note">
        texts in<span class="var"> red</span> red are variable :)
      </em>
    </p>
    <hr/>

    <h2 class="subtitle"><strong>Minigames</strong></h2>
    <div class="content-container">
      <h2 class="subtitle">• Egg Hunt </h2>
      <div class="inner-container">
        <p class="text">
          The egg hunt minigame is a fun and fairly simple one. At random times, <em>Cooper</em>
          sends a message in a random channel in the Coop server. The message is as follows:
        </p>
        <p class="quote-text">Cooper message</p>
        <p class="text">
          Cooper also reacts to the message with a basket(🧺) and hammer(🔨). Clicking on the
          basket will catch the egg, which adds the egg to your inventory and gives you points
          <span class="note">
            (... <span class="quote-text">/items</span> )
          </span>
          that positively affects your ranking on the leaderboard
          <span class="note">
            (... <span class="quote-text">/shares COOP_POINT </span> )
          </span>
          . Upon catching an egg, Cooper
          edits the previous message into the following
        </p>
        <p class="quote-text">
          <em class="var">'🥚'</em>🧺💨Egg Hunt! <em class="var">user</em>
          + <em class="var">3 </em>points!( <em class="var">points</em> )
        </p>
        <p class="text">
          But upon breaking an egg, you lose points and Cooper edits the previous message into
          this instead:
        </p>
        <p class="quote-text">
          <em class="var">'🥚'</em>🔨 <em class="var">user</em> intentionally broke the egg...
          <em class="var">points</em> points!
        </p>
        <p class="text">Or this:</p>
        <p class="quote-text">
          <em class="var">'🥚'</em>🔨 <em class="var">user</em> clumsily broke the egg...
        </p>
        <p class="text">
          Act quick 👀 and collect as many eggs and points as you can to get to the top 🥇
        </p>
      </div>
    </div>
  </div>
</template>

<script>
  import API from '~/lib/api/api';
  export default {
  }
</script>
