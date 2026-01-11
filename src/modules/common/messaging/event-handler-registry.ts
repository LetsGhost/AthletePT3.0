import * as fs from "fs";
import * as path from "path";
import { eventBus } from "./event-bus";
import { EventHandler } from "./event-handler";
import { logger } from "../logger/logger";

export async function registerEventHandlers() {
  const modulesPath = path.join(__dirname, "../../");

  try {
    const modules = fs.readdirSync(modulesPath);

    for (const moduleName of modules) {
      const moduleDir = path.join(modulesPath, moduleName);

      // Skip common module and non-directories
      if (!fs.statSync(moduleDir).isDirectory() || moduleName === "common") {
        continue;
      }

      const eventsDir = path.join(moduleDir, "events");

      // Skip if events directory doesn't exist
      if (!fs.existsSync(eventsDir)) {
        continue;
      }

      const files = fs.readdirSync(eventsDir);

      for (const file of files) {
        if (!file.endsWith(".handler.ts") && !file.endsWith(".handler.js")) {
          continue;
        }

        try {
          const handlerPath = path.join(eventsDir, file);
          const module = await import(handlerPath);

          // Find the handler instance in the module exports
          const handler = Object.values(module).find(
            (exp: any) =>
              exp instanceof EventHandler || 
              (typeof exp === "object" && exp !== null && "handle" in exp && "getEventType" in exp)
          ) as EventHandler | undefined;

          if (handler) {
            const eventType = handler.getEventType();
            eventBus.subscribeToEvent(eventType, handler);
            logger.info(
              `Registered event handler: ${file} -> ${eventType}`,
              { module: moduleName }
            );
          }
        } catch (error) {
          logger.error(
            `Failed to register event handler: ${file}`,
            {
              module: moduleName,
              error: error instanceof Error ? error.message : String(error),
            }
          );
        }
      }
    }

    logger.info("Event handler registration completed");
  } catch (error) {
    logger.error(
      `Error registering event handlers: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}
