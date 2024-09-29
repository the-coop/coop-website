export default function guestMiddleware(ctx) {
    if (ctx.app.$auth.$state.loggedIn)
        return ctx.app.$auth.redirect('home');
}