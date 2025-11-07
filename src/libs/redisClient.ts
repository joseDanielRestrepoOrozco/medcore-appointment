// Use dynamic require so build doesn't fail when ioredis is not installed in the environment
declare const require: any;
import { REDIS_URL } from './config';

let redis: any;
try {
  const IORedis = require('ioredis');
  redis = new IORedis(REDIS_URL);
  redis.on('error', (err: any) => {
    console.error('Redis error', err);
  });
} catch (e) {
  // Fallback: simple in-memory stub for local dev if ioredis isn't installed
  console.warn('ioredis not available; using in-memory Redis stub (not for production)');
  const store = new Map<string, any>();
  redis = {
    get: async (k: string) => store.get(k),
    set: async (k: string, v: any) => store.set(k, v),
    del: async (k: string) => store.delete(k),
    on: () => {},
    quit: async () => {},
  };
}

export default redis;
