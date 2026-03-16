// ============================================================
// wa-service/lib/auth-state.js
// Custom Redis auth state for Baileys — NEVER use
// useMultiFileAuthState in production (heavy IO).
// Stores creds + keys as JSON strings in Redis with gym prefix.
// ============================================================
import { BufferJSON, initAuthCreds } from '@whiskeysockets/baileys';
import redis from './redis.js';

const KEY_MAP = {
  'pre-key':        'preKeys',
  'session':        'sessions',
  'sender-key':     'senderKeys',
  'app-state-sync-key': 'appStateSyncKeys',
  'app-state-sync-version': 'appStateVersions',
  'sender-key-memory': 'senderKeyMemory',
};

/**
 * Returns a Baileys-compatible auth state backed by Redis.
 * Each gym gets its own keyspace: wa:{gymId}:creds, wa:{gymId}:keys:{type}:{id}
 *
 * @param {string} gymId
 */
export async function useRedisAuthState(gymId) {
  const prefix = `wa:${gymId}`;

  async function readData(key) {
    const raw = await redis.get(`${prefix}:${key}`);
    if (!raw) return null;
    return JSON.parse(raw, BufferJSON.reviver);
  }

  async function writeData(key, value) {
    await redis.set(`${prefix}:${key}`, JSON.stringify(value, BufferJSON.replacer));
  }

  async function removeData(key) {
    await redis.del(`${prefix}:${key}`);
  }

  // Load or init creds
  const creds = (await readData('creds')) ?? initAuthCreds();

  return {
    state: {
      creds,
      keys: {
        get: async (type, ids) => {
          const mapped = KEY_MAP[type] ?? type;
          const data = {};
          await Promise.all(
            ids.map(async (id) => {
              data[id] = await readData(`keys:${mapped}:${id}`);
            })
          );
          return data;
        },
        set: async (data) => {
          const tasks = [];
          for (const [type, ids] of Object.entries(data)) {
            const mapped = KEY_MAP[type] ?? type;
            for (const [id, value] of Object.entries(ids)) {
              if (value) {
                tasks.push(writeData(`keys:${mapped}:${id}`, value));
              } else {
                tasks.push(removeData(`keys:${mapped}:${id}`));
              }
            }
          }
          await Promise.all(tasks);
        },
      },
    },
    saveCreds: () => writeData('creds', creds),
  };
}

/**
 * Wipes all Redis keys for a gym (full disconnect / re-pair).
 * @param {string} gymId
 */
export async function clearAuthState(gymId) {
  const prefix = `wa:${gymId}`;
  const keys = await redis.keys(`${prefix}:*`);
  if (keys.length > 0) await redis.del(...keys);
}
