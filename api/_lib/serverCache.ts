import { Redis } from "@upstash/redis"
import { createClient, type RedisClientType } from "redis"

type LocalValue = {
  value: string
  expiresAt: number | null
}

const localCache = new Map<string, LocalValue>()
const localSets = new Map<string, Set<string>>()

const upstashRestUrl =
  process.env.UPSTASH_REDIS_KV_REST_API_URL ||
  process.env.UPSTASH_REDIS_REST_URL ||
  process.env.KV_REST_API_URL
const upstashRestToken =
  process.env.UPSTASH_REDIS_KV_REST_API_TOKEN ||
  process.env.UPSTASH_REDIS_REST_TOKEN ||
  process.env.KV_REST_API_TOKEN

const upstashRedis =
  upstashRestUrl && upstashRestToken
    ? new Redis({
        url: upstashRestUrl,
        token: upstashRestToken,
      })
    : null

const redisUrl = process.env.REDIS_URL?.trim()
const directRedisClient: RedisClientType | null = redisUrl
  ? createClient({
      url: redisUrl,
      socket: {
        reconnectStrategy: false,
      },
    })
  : null

let directRedisReady: Promise<RedisClientType> | null = null

function now() {
  return Date.now()
}

function getLocal(key: string) {
  const entry = localCache.get(key)
  if (!entry) return null
  if (entry.expiresAt !== null && entry.expiresAt <= now()) {
    localCache.delete(key)
    return null
  }
  return entry.value
}

function setLocal(key: string, value: string, ttlSeconds?: number) {
  localCache.set(key, {
    value,
    expiresAt: ttlSeconds ? now() + ttlSeconds * 1000 : null,
  })
}

export function isRedisConfigured() {
  return Boolean(upstashRedis || directRedisClient)
}

async function getDirectRedis() {
  if (!directRedisClient) return null
  if (directRedisClient.isOpen) return directRedisClient

  if (!directRedisReady) {
    directRedisReady = directRedisClient.connect().then(() => directRedisClient)
  }

  try {
    return await directRedisReady
  } catch {
    directRedisReady = null
    throw new Error("Direct Redis connection failed")
  }
}

export async function getCachedJson<T>(key: string) {
  try {
    if (upstashRedis) {
      const value = await upstashRedis.get<string>(key)
      if (!value) return null
      return JSON.parse(value) as T
    }

    const directRedis = await getDirectRedis()
    if (directRedis) {
      const value = await directRedis.get(key)
      if (!value) return null
      return JSON.parse(value) as T
    }
  } catch {
    // fall through to local cache
  }

  const local = getLocal(key)
  return local ? (JSON.parse(local) as T) : null
}

export async function setCachedJson(key: string, value: unknown, ttlSeconds?: number) {
  const encoded = JSON.stringify(value)

  try {
    if (upstashRedis) {
      if (ttlSeconds) {
        await upstashRedis.set(key, encoded, { ex: ttlSeconds })
      } else {
        await upstashRedis.set(key, encoded)
      }
      return
    }

    const directRedis = await getDirectRedis()
    if (directRedis) {
      if (ttlSeconds) {
        await directRedis.set(key, encoded, { EX: ttlSeconds })
      } else {
        await directRedis.set(key, encoded)
      }
      return
    }
  } catch {
    // fall through to local cache
  }

  setLocal(key, encoded, ttlSeconds)
}

export async function getCachedString(key: string) {
  try {
    if (upstashRedis) {
      return (await upstashRedis.get<string>(key)) ?? null
    }

    const directRedis = await getDirectRedis()
    if (directRedis) {
      return (await directRedis.get(key)) ?? null
    }
  } catch {
    // fall through to local cache
  }

  return getLocal(key)
}

export async function setCachedString(key: string, value: string, ttlSeconds?: number) {
  try {
    if (upstashRedis) {
      if (ttlSeconds) {
        await upstashRedis.set(key, value, { ex: ttlSeconds })
      } else {
        await upstashRedis.set(key, value)
      }
      return
    }

    const directRedis = await getDirectRedis()
    if (directRedis) {
      if (ttlSeconds) {
        await directRedis.set(key, value, { EX: ttlSeconds })
      } else {
        await directRedis.set(key, value)
      }
      return
    }
  } catch {
    // fall through to local cache
  }

  setLocal(key, value, ttlSeconds)
}

export async function deleteCachedKeys(...keys: string[]) {
  const filtered = keys.filter(Boolean)
  if (!filtered.length) return

  try {
    if (upstashRedis) {
      await upstashRedis.del(...filtered)
      return
    }

    const directRedis = await getDirectRedis()
    if (directRedis) {
      await directRedis.del(filtered)
      return
    }
  } catch {
    // fall through to local cache
  }

  for (const key of filtered) {
    localCache.delete(key)
  }
}

export async function acquireLock(key: string, ttlSeconds: number) {
  try {
    if (upstashRedis) {
      const result = await upstashRedis.set(key, String(now()), {
        nx: true,
        ex: ttlSeconds,
      })
      return result === "OK"
    }

    const directRedis = await getDirectRedis()
    if (directRedis) {
      const result = await directRedis.set(key, String(now()), {
        NX: true,
        EX: ttlSeconds,
      })
      return result === "OK"
    }
  } catch {
    // fall through to local cache
  }

  if (getLocal(key)) return false
  setLocal(key, String(now()), ttlSeconds)
  return true
}

export async function releaseLock(key: string) {
  await deleteCachedKeys(key)
}

export async function addToSet(key: string, value: string) {
  try {
    if (upstashRedis) {
      await upstashRedis.sadd(key, value)
      return
    }

    const directRedis = await getDirectRedis()
    if (directRedis) {
      await directRedis.sAdd(key, value)
      return
    }
  } catch {
    // fall through to local set
  }

  const set = localSets.get(key) || new Set<string>()
  set.add(value)
  localSets.set(key, set)
}

export async function removeFromSet(key: string, value: string) {
  try {
    if (upstashRedis) {
      await upstashRedis.srem(key, value)
      return
    }

    const directRedis = await getDirectRedis()
    if (directRedis) {
      await directRedis.sRem(key, value)
      return
    }
  } catch {
    // fall through to local set
  }

  localSets.get(key)?.delete(value)
}

export async function getSetMembers(key: string) {
  try {
    if (upstashRedis) {
      return ((await upstashRedis.smembers(key)) as string[]) || []
    }

    const directRedis = await getDirectRedis()
    if (directRedis) {
      return await directRedis.sMembers(key)
    }
  } catch {
    // fall through to local set
  }

  return Array.from(localSets.get(key) || [])
}
