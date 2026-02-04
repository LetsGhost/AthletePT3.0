import "dotenv/config";

export const env = {
  PORT: Number(process.env.PORT) || 3000,
  MONGO_URI: process.env.MONGO_URI!,
  NODE_ENV: process.env.NODE_ENV || "development",
  JWT_SECRET: process.env.JWT_SECRET!,
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET!,
  BYPASS_AUTH: process.env.BYPASS_AUTH || "false",

  MONGO_USER: process.env.MONGO_USER,
  MONGO_PASSWORD: process.env.MONGO_PASSWORD,
  MONGO_AUTH_SOURCE: process.env.MONGO_AUTH_SOURCE || "admin",

  // Redis config
  REDIS_HOST: process.env.REDIS_HOST || "localhost",
  REDIS_PORT: process.env.REDIS_PORT || "6379",
  REDIS_PASSWORD: process.env.REDIS_PASSWORD,
  REDIS_DB: process.env.REDIS_DB || "0",

  // CORS
  ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS,
};