import express from "express";
import cors from "cors";
import helmet from "helmet";
import swaggerUi from "swagger-ui-express";
import "express-async-errors";

import { httpLogger } from "../modules/common/logger/http.logger";
import { errorHandler } from "../middleware/error.middleware";
import { registerControllers } from "../modules/common/registry/controller/registry.controller";
import { registerEventHandlers } from "../modules/common/messaging/event-handler-registry";
import { swaggerSpec } from "../config/swagger";
import { env } from "../config/env";

export async function createApp() {
  const app = express();

  app.use(cors());
  app.use(helmet());
  app.use(express.json());

  app.use(httpLogger);

  // Swagger documentation (only in development)
  if (env.NODE_ENV === "development") {
    app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));
    app.get("/api-docs.json", (_req, res) => {
      res.setHeader("Content-Type", "application/json");
      res.send(swaggerSpec);
    });
  }

  registerControllers(app);
  await registerEventHandlers();

  app.use(errorHandler);

  return app;
}