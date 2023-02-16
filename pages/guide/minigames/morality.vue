<template>
  <div class="content-container">
    <h1 class="title">👨‍⚖️ Morality </h1>
    <hr />

    <div class="inner-container">
      <p class="text">
        The morality minigame is one that has a chance to give you buffs or de-buffs depending
        on your "morality" or "alignment". It occurs very rarely
      </p>
      <p class="text">
        With your <span class="quote-text">coop_points</span>
        less than <span class="var">0</span>, you have a morality of <span class="var">EVIL</span>
        , with your morality equal to <span class="var">0</span>, you have a morality of <span class="var">NEUTRAL</span>
        , and lastly, with your morality greater than <span class="var">0</span>,  you have a morality of
        <span class="var">GOOD</span>.
      </p>
      <p class="text">
        When your morality changes, <span class="quote-text">COOPER</span> sends the following message in chat:
      </p>
      <p class="quote-text">
        I am feeling... <em class="var">NEUTRAL</em>!
      </p>
      <p class="text">
        With a <span class="var">GOOD</span> morality, you have a 50% chance to activate a giveaway
        but with an <span class="var">EVIL</span> morality, you have a 50% chance to activate a takeaway.
      </p>
      <p class="text">
        There are things planned for <span class="var">NEUTRAL</span> morality because according to the boss:
      </p>
      <div class="teaser-img" :style="{ backgroundImage: `url('/neutral-teaser.png')` }"></div>

      <p class="text">
        If you activate a giveaway by going from <span class="var">EVIL</span>, or <span class="var">NEUTRAL</span>
        to <span class="var">GOOD</span>, <span class="quote-text">COOPER</span> runs a giveaway which gives random
        members of the COOP a random item in quite a large quantity and sends this message in the chat:
      </p>
      <pre class="quote-text">

<strong>Cooper's good mood makes him iconic!</strong>

<span class="mention">@Rewardee</span>: <span class="var">'🥚'</span> x <span class="var">4</span>, <span class="mention">@Rewardee2</span>: <span class="var">'🍎'</span> x <span class="var">5</span> ...<em class="note">It sends such for every rewardee</em>
      </pre>

      <p class="text">
        But if you somehow activate "takeaway", <span class="quote-text">COOPER</span> sends the following instead:
      </p>
      <p class="quote-text">I taketh as I giveth...</p>
      <p class="text">
        Not much is known if <span class="quote-text">COOPER</span> actually takes anything... 🧐
      </p>
    </div>
  </div>
</template>

<script>
  import API from '~/lib/api/api';
  export default {
  }
</script>

<style>
  .content-container > hr {
    margin: 3rem 0;
  }
</style>
