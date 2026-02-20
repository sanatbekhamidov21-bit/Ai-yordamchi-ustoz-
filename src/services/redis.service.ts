// MOCKED REDIS SERVICE FOR LOCAL TESTING
class RedisMock {
    private store: Record<string, string> = {};

    async get(key: string) {
        return this.store[key] || null;
    }

    async set(key: string, value: string, mode?: string, duration?: number) {
        this.store[key] = value;
    }

    async del(key: string) {
        delete this.store[key];
    }

    on(event: string, callback: any) {
        // do nothing
    }
}

const redis = new RedisMock();

export const setCache = async (key: string, value: any) => {
    redis.set(key, JSON.stringify(value));
};

export const getCache = async (key: string) => {
    const val = await redis.get(key);
    return val ? JSON.parse(val) : null;
};

export const deleteCache = async (key: string) => {
    await redis.del(key);
};

export default redis;
