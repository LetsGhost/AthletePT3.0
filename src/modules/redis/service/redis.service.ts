import { redisBootstrap } from "../../../bootstrap/redis";

export class RedisService {
  private get client() {
    return redisBootstrap.getClient();
  }

  async set(key: string, value: unknown, ttlSeconds?: number): Promise<void> {
    const stringValue = typeof value === "string" ? value : JSON.stringify(value);

    if (ttlSeconds) {
      await this.client.setEx(key, ttlSeconds, stringValue);
    } else {
      await this.client.set(key, stringValue);
    }
  }

  async get<T>(key: string): Promise<T | null> {
    const value = await this.client.get(key);
    if (!value) return null;

    try {
      return JSON.parse(value) as T;
    } catch {
      return value as unknown as T;
    }
  }

  async del(key: string): Promise<void> {
    await this.client.del(key);
  }

  async keys(pattern: string): Promise<string[]> {
    return this.client.keys(pattern);
  }

  async hSet(
    key: string,
    field: string,
    value: unknown
  ): Promise<void> {
    const stringValue = typeof value === "string" ? value : JSON.stringify(value);
    await this.client.hSet(key, field, stringValue);
  }

  async hGet<T>(key: string, field: string): Promise<T | null> {
    const value = await this.client.hGet(key, field);
    if (!value) return null;

    try {
      return JSON.parse(value) as T;
    } catch {
      return value as unknown as T;
    }
  }

  async hGetAll<T extends Record<string, unknown>>(key: string): Promise<T> {
    const result = await this.client.hGetAll(key);
    const parsed: Record<string, unknown> = {};

    for (const [field, value] of Object.entries(result)) {
      try {
        parsed[field] = JSON.parse(value as string);
      } catch {
        parsed[field] = value;
      }
    }

    return parsed as T;
  }

  async hDel(key: string, field: string): Promise<void> {
    await this.client.hDel(key, field);
  }
}

export const redisService = new RedisService();
