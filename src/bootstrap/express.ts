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
import { env } from "../config/env";
import { logger } from "../modules/common/logger/logger";

export async function createApp() {
  const app = express();

  app.use(cors());
  app.use(helmet());
  app.use(express.json());

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

  await registerControllers(app);
  await registerEventHandlers();
  await registerScheduledJobs();
  await jobScheduler.startScheduler();

  // Graceful shutdown
  process.on("SIGTERM", async () => {
    logger.info("SIGTERM signal received: closing HTTP server");
    await jobScheduler.stopScheduler();
    process.exit(0);
  });

  app.use(errorHandler);

  return app;
}