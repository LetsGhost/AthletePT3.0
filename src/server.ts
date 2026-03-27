import { createApp } from "./bootstrap/express";
import { connectDatabase } from "./bootstrap/database";
import { redisBootstrap } from "./bootstrap/redis";
import { env } from "./config/env";
import { logger } from "./modules/common/logger/logger";
import { printStartupBanner } from "./modules/common/logger/banner";

(async () => {
  await Promise.all([
    connectDatabase(env.MONGO_URI),
    redisBootstrap.connect(),
  ]);

  printStartupBanner(env.PORT);

  const app = await createApp();

  app.listen(env.PORT, () => {
    logger.info(`Server running on port ${env.PORT}`);
    logger.info(`API Documentation available at http://localhost:${env.PORT}/api-docs`);
  });
})();
