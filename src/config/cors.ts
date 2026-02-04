import { CorsOptions } from "cors";

import { env } from "./env";

const isDevelopment = env.NODE_ENV === "development";

export const corsConfig: CorsOptions = {
  origin: isDevelopment 
    ? "*"  // Allow all origins in development
    : process.env.ALLOWED_ORIGINS?.split(",") || ["https://yourdomain.com"],
  
  credentials: true,
  
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "X-Requested-With",
    "X-Request-ID",
    "Accept",
  ],
  
  exposedHeaders: [
    "X-Total-Count",
    "X-Page-Number",
    "X-Page-Size",
    "X-RateLimit-Limit",
    "X-RateLimit-Remaining",
    "X-RateLimit-Reset",
    "Retry-After",
  ],
  
  maxAge: 86400, // 24 hours
  
  preflightContinue: false,
};
