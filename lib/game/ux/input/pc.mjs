export default class PC {
    static fn = null

    static setup() {
        this.fn = e => window.dispatchEvent(new CustomEvent('key', { detail: e.key }))
        document.addEventListener('keydown', this.fn)
    }

    static end() {
        this.fn && document.removeEventListener('keydown', this.fn)
        this.fn = null
    }
}
