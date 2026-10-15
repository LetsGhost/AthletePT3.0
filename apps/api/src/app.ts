import cookieParser from "cookie-parser";
import cors from "cors";
import express, { Router } from "express";
import helmet from "helmet";
import mongoose from "mongoose";
import swaggerUi from "swagger-ui-express";

import { env } from "./config/env";
import { httpLogger } from "./lib/logger/http.logger";
import { API_PREFIX, getOpenApiDocument } from "./lib/openapi";
import { errorHandler, notFoundHandler } from "./middleware/error-handler";
import { apiLimiter } from "./middleware/rate-limit";
import { requestId } from "./middleware/request-id";
import { athleteRouter, myPermissionsRouter } from "./modules/athletes/athlete.routes";
import { authRouter } from "./modules/auth/auth.routes";
import { coachRouter } from "./modules/coaches/coach.routes";
import { exerciseRouter } from "./modules/exercises/exercise.routes";
import { myPlanRouter, planRouter, planTemplateRouter } from "./modules/plans/plan.routes";
import { athleteStatsRouter, myStatsRouter } from "./modules/stats/exercise-stats.routes";
import { athleteWorkoutRouter, myWorkoutRouter } from "./modules/workouts/workout.routes";

/** Alle Modul-Router. Neue Module hier eintragen. */
const modules = [
  authRouter,
  coachRouter,
  athleteRouter,
  myPermissionsRouter,
  exerciseRouter,
  planRouter,
  planTemplateRouter,
  myPlanRouter,
  myWorkoutRouter,
  athleteWorkoutRouter,
  myStatsRouter,
  athleteStatsRouter,
];

export function createApp() {
  const app = express();

  app.disable("x-powered-by");
  app.set("trust proxy", env.TRUST_PROXY);

  app.use(requestId);
  app.use(helmet());
  if (env.CORS_ORIGINS.length > 0) {
    app.use(cors({ origin: env.CORS_ORIGINS, credentials: true }));
  }
  app.use(express.json({ limit: "100kb" }));
  app.use(cookieParser());
  if (!env.isTest) {
    app.use(httpLogger);
  }

  app.get("/health", (_req, res) => {
    const dbReady = mongoose.connection.readyState === 1;
    res.status(dbReady ? 200 : 503).json({
      status: dbReady ? "ok" : "degraded",
      db: dbReady ? "connected" : "disconnected",
      uptime: Math.round(process.uptime()),
    });
  });

  const api = Router();
  api.use(apiLimiter);
  for (const module of modules) {
    api.use(module.prefix, module.router);
  }

  if (env.apiDocsEnabled) {
    api.get("/openapi.json", (_req, res) => {
      res.json(getOpenApiDocument());
    });
    api.use(
      "/docs",
      swaggerUi.serveFiles(getOpenApiDocument()),
      swaggerUi.setup(getOpenApiDocument()),
    );
  }

  api.use(notFoundHandler);
  app.use(API_PREFIX, api);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
