export class RateLimiter {
    private timestamps: Record<string, number[]> = {};

    /**
     * Checks if an action is allowed based on the rate limit.
     * If allowed, it records the current timestamp and returns true.
     * If not allowed, it returns false.
     * @param key Unique key for the action (e.g., tool name)
     * @param limit Max number of allowed actions
     * @param windowMs Time window in milliseconds
     */
    check(key: string, limit: number, windowMs: number): boolean {
        const now = Date.now();
        if (!this.timestamps[key]) {
            this.timestamps[key] = [];
        }

        // Remove timestamps older than the window
        this.timestamps[key] = this.timestamps[key].filter(t => now - t < windowMs);

        if (this.timestamps[key].length >= limit) {
            return false;
        }

        this.timestamps[key].push(now);
        return true;
    }
}

export const rateLimiter = new RateLimiter();
