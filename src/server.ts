import { createApp } from "./bootstrap/express";
import { connectDatabase } from "./bootstrap/database";
import { env } from "./config/env";
import { logger } from "./modules/common/logger/logger";

(async () => {
  await connectDatabase(env.MONGO_URI);

  createApp().listen(env.PORT, () => {
    logger.info(`Server running on port ${env.PORT}`);
    logger.info(`API Documentation available at http://localhost:${env.PORT}/api-docs`);
  });
})();
