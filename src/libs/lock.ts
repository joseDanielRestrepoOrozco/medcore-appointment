// Use dynamic require so build doesn't fail when redlock is not installed
declare const require: any;
import redis from './redisClient';

let redlock: any;
try {
  const Redlock = require('redlock');
  // When running with real Redis and redlock available
  redlock = new Redlock([redis], { retryCount: 3, retryDelay: 200 });
  redlock.on('clientError', (err: any) => console.error('Redlock client error', err));
} catch (e) {
  // Fallback: simple in-process lock stub (NOT for production)
  console.warn('redlock not available; using in-memory lock stub (single-process only)');
  redlock = {
    acquire: async (resources: string[] = [], ttl: number = 1000) => {
      // return a fake lock object with release/unlock methods
      return {
        resources,
        ttl,
        release: async () => {},
        unlock: async () => {},
      };
    },
  };
}

export default redlock;
