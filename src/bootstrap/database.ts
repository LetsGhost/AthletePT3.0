import mongoose from "mongoose";
import { logger } from "../modules/common/logger/logger";
import { env } from "../config/env";

export async function connectDatabase(uri: string) {
  await mongoose.connect(uri, {
    user: env.MONGO_USER,
    pass: env.MONGO_PASSWORD,
    authSource: env.MONGO_AUTH_SOURCE,
  });
  logger.info("MongoDB connected");
}
