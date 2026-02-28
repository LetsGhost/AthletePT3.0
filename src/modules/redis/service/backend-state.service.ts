import { redisService } from "./redis.service";
import { logger } from "../../common/logger/logger";

export interface RegisteredRoute {
  method: string;
  path: string;
  module: string;
}

export interface RegisteredJob {
  name: string;
  schedule: string;
  enabled: boolean;
  running: boolean;
}

export interface BackendState {
  routes: RegisteredRoute[];
  jobs: RegisteredJob[];
  timestamp: string;
  uptime: number;
}

const REDIS_KEYS = {
  ROUTES: "backend:routes",
  JOBS: "backend:jobs",
  HEALTH: "backend:health",
} as const;

export class BackendStateService {
  /**
   * Register a route for tracking
   */
  async registerRoute(
    method: string,
    path: string,
    module: string
  ): Promise<void> {
    try {
      await redisService.hSet(REDIS_KEYS.ROUTES, `${method}:${path}`, {
        method,
        path,
        module,
      });
    } catch (error) {
      logger.warn("Failed to register route in Redis", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Get all registered routes
   */
  async getRoutes(): Promise<RegisteredRoute[]> {
    try {
      const routes = await redisService.hGetAll<Record<string, RegisteredRoute>>(
        REDIS_KEYS.ROUTES
      );
      return Object.values(routes);
    } catch (error) {
      logger.warn("Failed to fetch routes from Redis", {
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  /**
   * Register a scheduled job for tracking
   */
  async registerJob(
    name: string,
    schedule: string,
    enabled: boolean
  ): Promise<void> {
    try {
      await redisService.hSet(REDIS_KEYS.JOBS, name, {
        name,
        schedule,
        enabled,
        running: false,
      });
    } catch (error) {
      logger.warn("Failed to register job in Redis", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Update job running status
   */
  async updateJobStatus(name: string, running: boolean): Promise<void> {
    try {
      const job = await redisService.hGet<RegisteredJob>(REDIS_KEYS.JOBS, name);
      if (job) {
        await redisService.hSet(REDIS_KEYS.JOBS, name, {
          ...job,
          running,
        });
      }
    } catch (error) {
      logger.warn("Failed to update job status in Redis", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Get all registered jobs
   */
  async getJobs(): Promise<RegisteredJob[]> {
    try {
      const jobs = await redisService.hGetAll<Record<string, RegisteredJob>>(
        REDIS_KEYS.JOBS
      );
      return Object.values(jobs);
    } catch (error) {
      logger.warn("Failed to fetch jobs from Redis", {
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  /**
   * Get complete backend state
   */
  async getBackendState(): Promise<BackendState> {
    const routes = await this.getRoutes();
    const jobs = await this.getJobs();

    return {
      routes,
      jobs,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };
  }

  /**
   * Record health check
   */
  async recordHealthCheck(): Promise<void> {
    try {
      await redisService.set(
        REDIS_KEYS.HEALTH,
        {
          timestamp: new Date().toISOString(),
          uptime: process.uptime(),
          memory: process.memoryUsage(),
        },
        3600 // 1 hour TTL
      );
    } catch (error) {
      logger.warn("Failed to record health check in Redis", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

export const backendStateService = new BackendStateService();
