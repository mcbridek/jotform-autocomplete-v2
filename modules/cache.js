export const Cache = {
    data: null,
    lastFetchTime: 0,
    EXPIRY: 5 * 60 * 1000, // 5 minutes

    isValid() {
        return this.data && (Date.now() - this.lastFetchTime) < this.EXPIRY;
    },

    set(data) {
        this.data = data;
        this.lastFetchTime = Date.now();
    },

    get() {
        return this.isValid() ? this.data : null;
    },

    clear() {
        this.data = null;
        this.lastFetchTime = 0;
    }
};