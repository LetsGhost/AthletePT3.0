import * as fs from "fs";
import * as path from "path";
import { createRequire } from "module";

import { eventBus } from "./event-bus";
import { EventHandler } from "./event-handler";
import { logger } from "../logger/logger";

const requireModule = createRequire(__filename);

const isEventHandler = (value: unknown): value is EventHandler => {
  if (value instanceof EventHandler) {
    return true;
  }

  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as { handle?: unknown; getEventType?: unknown };
  return typeof candidate.handle === "function" && typeof candidate.getEventType === "function";
};

export async function registerEventHandlers() {
  const log = logger.child({ label: "events" });
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

          // Prefer dynamic import with file URL (works in ESM/CommonJS under Node16 semantics)
          const module = requireModule(handlerPath) as Record<string, unknown>;

          // Find the handler instance in the module exports
          const handler = Object.values(module).find((exp) => isEventHandler(exp));

          if (handler) {
            const eventType = handler.getEventType();
            eventBus.subscribeToEvent(eventType, handler);
            log.info(`Registered event handler: ${file} -> ${eventType}`, {
              module: moduleName,
            });
          } else {
            log.warn(`No handler instance exported by: ${file}`, {
              module: moduleName,
              exports: Object.keys(module),
            });
          }
        } catch (error) {
          log.error(`Failed to register event handler: ${file}`, {
            module: moduleName,
            error: error instanceof Error ? error.stack ?? error.message : String(error),
          });
        }
      }
    }

    log.info("Event handler registration completed");
  } catch (error) {
    log.error(
      `Error registering event handlers: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}
