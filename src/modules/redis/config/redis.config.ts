import { env } from "../../../config/env";

export interface RedisConfig {
  host: string;
  port: number;
  password?: string;
  db?: number;
}

export const redisConfig: RedisConfig = {
  host: env.REDIS_HOST || "localhost",
  port: env.REDIS_PORT ? Number(env.REDIS_PORT) : 6379,
  password: env.REDIS_PASSWORD || undefined,
  db: env.REDIS_DB ? Number(env.REDIS_DB) : 0,
};
