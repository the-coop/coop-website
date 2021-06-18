<style scoped>
    .login-options {
        display: flex;
        align-items: center;
        margin-top: 1.5rem;
    }
    .login-option-button {
        display: inline-flex;
        align-items: center;
        margin: 1rem;
        text-decoration: none;
        padding: .75rem 2rem;
        border-radius: .75rem;
        font-size: 1.125em;
        font-weight: bold;

        background: #ff6565;
        color: #4a4a4a;
    }
    .login-option-button:hover {
        background: #111111;
        color: white;
    }
    .login-option-button.secondary {
        background: #e65f5f;
        color: white;
    }
    .login-option-button.secondary:hover {
        background: #ff6565;
        color: #4a4a4a;
    }
    .login-option-button .button-icon {
        margin-right: 1.5rem;
    }
</style>

<template>
    <div class="content-container">
        <h1 class="title">Login</h1>
        <p>We value privacy so this session will be forgotten/discarded when you close your browser, if you wish to be remembered for convenience - click here:</p>

        <p>
            Privacy policy for data: As little as possibly required to function is used and deleted on/every logout. 
            Discord login permissions/privacy: We request/use only "identity" (user ID) data attribute - as visible on Discord's (private&amp;secure) authorisation screen and by our permanent configuration (external preview) visible here: <a target="_blank" href="/privacy/discord-oauth-permissions.png">permissions image.</a>
        </p>

        <p>There is still time to join our _LINK_ NEWSLETTER _LINK_.</p>

        
        <div class="login">
            <div class="upgrade-session-promo">
                <label for="remember-toggle">Save until manual logout?</label>
                <input id="remember-toggle" type="checkbox" v-on:click="toggleRemember" v-model="remembered" />
            </div>

            <div class="login-options">
                <a class="login-option-button" :href="discordAuthURL">
                    <svg class="button-icon" width="71" height="55" viewBox="0 0 71 55" fill="none">
                        <g clip-path="url(#clip0)">
                            <path d="M60.1045 4.8978C55.5792 2.8214 50.7265 1.2916 45.6527 0.41542C45.5603 0.39851 45.468 0.440769 45.4204 0.525289C44.7963 1.6353 44.105 3.0834 43.6209 4.2216C38.1637 3.4046 32.7345 3.4046 27.3892 4.2216C26.905 3.0581 26.1886 1.6353 25.5617 0.525289C25.5141 0.443589 25.4218 0.40133 25.3294 0.41542C20.2584 1.2888 15.4057 2.8186 10.8776 4.8978C10.8384 4.9147 10.8048 4.9429 10.7825 4.9795C1.57795 18.7309 -0.943561 32.1443 0.293408 45.3914C0.299005 45.4562 0.335386 45.5182 0.385761 45.5576C6.45866 50.0174 12.3413 52.7249 18.1147 54.5195C18.2071 54.5477 18.305 54.5139 18.3638 54.4378C19.7295 52.5728 20.9469 50.6063 21.9907 48.5383C22.0523 48.4172 21.9935 48.2735 21.8676 48.2256C19.9366 47.4931 18.0979 46.6 16.3292 45.5858C16.1893 45.5041 16.1781 45.304 16.3068 45.2082C16.679 44.9293 17.0513 44.6391 17.4067 44.3461C17.471 44.2926 17.5606 44.2813 17.6362 44.3151C29.2558 49.6202 41.8354 49.6202 53.3179 44.3151C53.3935 44.2785 53.4831 44.2898 53.5502 44.3433C53.9057 44.6363 54.2779 44.9293 54.6529 45.2082C54.7816 45.304 54.7732 45.5041 54.6333 45.5858C52.8646 46.6197 51.0259 47.4931 49.0921 48.2228C48.9662 48.2707 48.9102 48.4172 48.9718 48.5383C50.038 50.6034 51.2554 52.5699 52.5959 54.435C52.6519 54.5139 52.7526 54.5477 52.845 54.5195C58.6464 52.7249 64.529 50.0174 70.6019 45.5576C70.6551 45.5182 70.6887 45.459 70.6943 45.3942C72.1747 30.0791 68.2147 16.7757 60.1968 4.9823C60.1772 4.9429 60.1437 4.9147 60.1045 4.8978ZM23.7259 37.3253C20.2276 37.3253 17.3451 34.1136 17.3451 30.1693C17.3451 26.225 20.1717 23.0133 23.7259 23.0133C27.308 23.0133 30.1626 26.2532 30.1066 30.1693C30.1066 34.1136 27.28 37.3253 23.7259 37.3253ZM47.3178 37.3253C43.8196 37.3253 40.9371 34.1136 40.9371 30.1693C40.9371 26.225 43.7636 23.0133 47.3178 23.0133C50.9 23.0133 53.7545 26.2532 53.6986 30.1693C53.6986 34.1136 50.9 37.3253 47.3178 37.3253Z" fill="#23272A"/>
                        </g>
                        <defs>
                            <clipPath id="clip0">
                                <rect width="71" height="55" fill="white"/>
                            </clipPath>
                        </defs>
                    </svg>

                    LOGIN VIA DISCORD
                </a>

                <a :href="discordAuthURL" class="login-option-button secondary">
                    <svg class="button-icon" width="41" height="50" viewBox="0 0 41 54" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <circle cx="13.285" cy="24.2351" r="4.02576" fill="white"></circle>
                        <path class="beak" d="M28.583 14.1707H40.6603L34.0178 20.2093L40.6603 26.2479H28.583V14.1707Z" fill="white"></path>
                        <path d="M1.93237 16.103H24.6377V46.0547H1.93237V16.103Z" stroke="white" stroke-width="3.86473"></path>
                        <path class="beard" d="M28.583 28.261L40.6603 39.9357V47.9872H28.583V28.261Z" fill="#FF6565"></path>
                        <path d="M0 12.0774L11.6747 9.91821e-05L19.7262 9.91821e-05V12.0774L0 12.0774Z" fill="#FF6565"></path>
                    </svg>
                    COOPER DM (DISABLED)
                </a>
            </div>

        </div>
    </div>
</template>

<script>
    export default {
        middleware: 'guest',
        data() {
            return {
                discordAuthURL: "https://discord.com/api/oauth2/authorize?client_id=799695179623432222&redirect_uri=https%3A%2F%2Fthecoop.group%2Fauth%2Fdiscord-oauth&response_type=code&scope=identify",
            }
        }
    }
</script>