<template>
    <div class="item">
        <div class="icon">
            <span class="unicode" v-if="unicode" :style="{ fontSize: width }">
                {{ unicode }}
            </span>
            <img v-else :style="{ width }" :src="image()" />
        </div>

        <span v-if="label">
            {{ label }}
        </span>
    </div>
</template>

<style scoped>
    .item {
        display: inline-flex;
        align-items: center;
    }
    .icon {
        margin-right: .5em;
    }
    .unicode {
        font-size: 1.75em;
    }
    .item img {
        width: 2rem;
    }
    
</style>

<script>
    import EmojiHelper from 'coopshared/helper/ui/EmojiHelper';

    // console.log(EmojiHelper);
  
    export default {
        props: ['code', 'label', 'width'],
        methods: {
            image() {
                return EmojiHelper.itemCodeToEmojiURL(this.code);
            }
        },
        data: ({ code }) => {
            return {
                unicode: EmojiHelper.itemCodeToUnicode(code),
                link: null
            }
        }
    }
</script>