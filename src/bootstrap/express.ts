import express from "express";
import cors from "cors";
import helmet from "helmet";
import swaggerUi from "swagger-ui-express";
import "express-async-errors";

import { httpLogger } from "../modules/common/logger/http.logger";
import { errorHandler } from "../middleware/error.middleware";
import { createRateLimiter, createAuthRateLimiter } from "../middleware/rate-limit.middleware";
import { registerControllers } from "../modules/common/registry/controller/registry.controller";
import { registerEventHandlers } from "../modules/common/messaging/event-handler-registry";
import { registerScheduledJobs } from "../modules/common/scheduler/scheduler-registry";
import { jobScheduler } from "../modules/common/scheduler/scheduler";
import { swaggerSpec } from "../config/swagger";
import { corsConfig } from "../config/cors";
import { env } from "../config/env";
import { logger } from "../modules/common/logger/logger";
import { redisService } from "../modules/redis/service/redis.service";
import { backendStateService } from "../modules/redis/service/backend-state.service";

export async function createApp() {
  const app = express();

  // Initialize Redis (non-blocking, logs warnings if fails)
  redisService
    .connect()
    .catch((err) => logger.warn("Redis initialization failed", { error: err.message }));

  // Security and parsing middleware
  app.use(cors(corsConfig));
  app.use(helmet());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Apply rate limiting to all API routes (disabled in dev mode)
  app.use("/api/", createRateLimiter());

  // More strict rate limiting for authentication endpoints
  app.use("/api/auth/", createAuthRateLimiter());

  app.use(httpLogger);

  // Swagger documentation (only in development)
  if (env.NODE_ENV === "development") {
    app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));
    app.get("/api-docs.json", (_req, res) => {
      res.setHeader("Content-Type", "application/json");
      res.send(swaggerSpec);
    });
  }

  // Health check endpoint
  app.get("/health", async (_req, res) => {
    const isRedisReady = redisService.isReady();
    await backendStateService.recordHealthCheck();
    
    res.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      redis: isRedisReady ? "connected" : "disconnected",
      environment: env.NODE_ENV,
    });
  });

  // Register all controllers, event handlers, and scheduled jobs
  await registerControllers(app);
  await registerEventHandlers();
  await registerScheduledJobs();
  await jobScheduler.startScheduler();

  // Error handler (must be last)
  app.use(errorHandler);

  // Graceful shutdown
  process.on("SIGTERM", async () => {
    logger.info("SIGTERM signal received: closing HTTP server");
    await jobScheduler.stopScheduler();
    await redisService.disconnect();
    process.exit(0);
  });

  return app;
}