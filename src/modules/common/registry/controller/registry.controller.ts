import fs from "fs";
import path from "path";
import { createRequire } from "module";

import { Express, Router } from "express";

import { logger } from "../../logger/logger";

const requireModule = createRequire(__filename);

export async function registerControllers(app: Express) {
  const modulesPath = path.join(__dirname, "../../../");

  for (const moduleName of fs.readdirSync(modulesPath)) {
    const moduleDir = path.join(modulesPath, moduleName);
    
    if (!fs.statSync(moduleDir).isDirectory() || moduleName === "common") {
      continue;
    }

    const controllerDir = path.join(moduleDir, "controller");
    
    if (!fs.existsSync(controllerDir)) {
      continue;
    }

    const controllerFiles = fs.readdirSync(controllerDir).filter(
      file => file.endsWith(".controller.ts") || file.endsWith(".controller.js")
    );

    for (const file of controllerFiles) {
      const controllerPath = path.join(controllerDir, file);
      const controller = requireModule(controllerPath) as Record<string, unknown>;
      const instance = Object.values(controller)[0] as { router?: Router } | undefined;

      if (instance?.router) {
        const basePath = `/api/${moduleName}s`;
        app.use(basePath, instance.router);

        // Log registered endpoints
        const routes = getRoutes(instance.router);
        logger.info(`Registered controller: ${moduleName.toUpperCase()}`);
        routes.forEach(route => {
          logger.info(`  ${route.method.toUpperCase().padEnd(6)} ${basePath}${route.path}`);
        });
      }
    }
  }
}

function getRoutes(router: Router): Array<{ method: string; path: string }> {
  const routes: Array<{ method: string; path: string }> = [];

  router.stack.forEach((layer) => {
    if (layer.route) {
      const methods = Object.keys(layer.route.methods);
      methods.forEach(method => {
        routes.push({
          method,
          path: layer.route.path,
        });
      });
    }
  });

  return routes;
}