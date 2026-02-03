import rateLimit, { Store, ipKeyGenerator } from "express-rate-limit";

import { env } from "../config/env";
import { logger } from "../modules/common/logger/logger";

/**
 * Custom store for rate limiter with logging
 */
class LoggingStore implements Store {
  private store: Map<string, { count: number; resetTime: number }> = new Map();

  async increment(key: string): Promise<{ totalHits: number; resetTime: Date }> {
    const now = Date.now();
    const entry = this.store.get(key) || { count: 0, resetTime: now + 15 * 60 * 1000 };

    // Reset if window has expired
    if (now > entry.resetTime) {
      entry.count = 0;
      entry.resetTime = now + 15 * 60 * 1000;
    }

    entry.count++;

    this.store.set(key, entry);

    return {
      totalHits: entry.count,
      resetTime: new Date(entry.resetTime),
    };
  }

  async decrement(key: string): Promise<void> {
    const entry = this.store.get(key);
    if (entry && entry.count > 0) {
      entry.count--;
    }
  }

  async resetKey(key: string): Promise<void> {
    this.store.delete(key);
  }

  async resetAll(): Promise<void> {
    this.store.clear();
  }
}

/**
 * API Rate Limiter Middleware
 * Enabled in production and staging, disabled in development
 */
export const createRateLimiter = () => {
  const isDev = env.NODE_ENV === "development";

  return rateLimit({
    store: new LoggingStore(),

    // 15 minutes window
    windowMs: 15 * 60 * 1000,

    // Limit each IP to 100 requests per windowMs
    max: 100,

    // Standardized response
    message: "Too many requests from this IP, please try again after 15 minutes",

    // Include retry-after header
    standardHeaders: true,

    // Log only on violations
    skip: (_req, _res) => {
      void _req;
      void _res;
      return isDev;
    },

    // Custom handler with logging
    handler: (req, res, _next, options) => {
      const ip = req.ip || "unknown";

      logger.warn("Rate limit exceeded", {
        ip,
        path: req.path,
        method: req.method,
        limit: options.max,
      });

      res.status(429).json({
        error: "Too Many Requests",
        message: options.message,
        retryAfter: options.windowMs / 1000,
      });
    },

    keyGenerator: (req, _res) => {
      void _res;
      return ipKeyGenerator(req, _res);
    },
  });
};

/**
 * Create a stricter rate limiter for authentication endpoints
 * More restrictive to prevent brute force attacks
 */
export const createAuthRateLimiter = () => {
  const isDev = env.NODE_ENV === "development";

  return rateLimit({
    skip: (_req, _res) => {
      void _req;
      void _res;
      return isDev;
    },

    store: new LoggingStore(),

    // 15 minutes window
    windowMs: 15 * 60 * 1000,

    // Limit each IP to 5 login attempts per windowMs
    max: 5,

    message: "Too many login attempts, please try again after 15 minutes",

    standardHeaders: true,

    handler: (req, res, _next, options) => {
      void _next;
      const ip = req.ip || "unknown";

      logger.warn("Authentication rate limit exceeded", {
        ip,
        path: req.path,
        method: req.method,
        limit: options.max,
      });

      res.status(429).json({
        error: "Too Many Requests",
        message: options.message,
        retryAfter: options.windowMs / 1000,
      });
    },

    keyGenerator: (req, _res) => {
      void _res;
      return ipKeyGenerator(req, _res);
    },
  });
};
