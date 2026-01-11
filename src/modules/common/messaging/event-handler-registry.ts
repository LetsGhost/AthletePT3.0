import * as fs from "fs";
import * as path from "path";
import { pathToFileURL } from "url";
import { eventBus } from "./event-bus";
import { EventHandler } from "./event-handler";
import { logger } from "../logger/logger";

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
          let module: any;
          try {
            const fileUrl = pathToFileURL(handlerPath).href;
            module = await import(fileUrl);
          } catch (importErr) {
            // Fallback to require for CommonJS/ts-node-dev environments
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            module = require(handlerPath);
          }

          // Find the handler instance in the module exports
          const handler = Object.values(module).find(
            (exp: any) =>
              exp instanceof EventHandler ||
              (typeof exp === "object" && exp !== null && "handle" in exp && "getEventType" in exp)
          ) as EventHandler | undefined;

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
