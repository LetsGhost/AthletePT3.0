import morgan from "morgan";
import { logger } from "./logger";

export const httpLogger = morgan("combined", {
  stream: {
    write: (message) => logger.info(message.trim()),
  },
});
