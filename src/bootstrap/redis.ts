import { createClient, RedisClientType } from "redis";

import { logger } from "../modules/common/logger/logger";
import { redisConfig } from "../config/redis.config";

export class RedisBootstrap {
  private client: RedisClientType | null = null;
  private isConnected = false;

  async connect(): Promise<void> {
    if (this.client && this.isConnected) {
      return;
    }

    try {
      const url = `redis://:${redisConfig.password}@${redisConfig.host}:${redisConfig.port}/${redisConfig.db}`;

      this.client = createClient({
        url,
      });

      this.client.on("error", (err) =>
        logger.error("Redis error", { error: err.message })
      );
      this.client.on("connect", () =>
        logger.info("Redis connected", {
          host: redisConfig.host,
          port: redisConfig.port,
        })
      );

      await this.client.connect();
      this.isConnected = true;
    } catch (error) {
      logger.error("Failed to connect to Redis", {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (this.client && this.isConnected) {
      await this.client.quit();
      this.isConnected = false;
      logger.info("Redis disconnected");
    }
  }

  isReady(): boolean {
    return this.isConnected;
  }

  getClient(): RedisClientType {
    if (!this.client || !this.isConnected) {
      throw new Error("Redis not connected");
    }

    return this.client;
  }
}

export const redisBootstrap = new RedisBootstrap();
