import figlet from "figlet";
import packageJson from "../../../../package.json";
import { env } from "../../../config/env";
import { logger } from "./logger";

// Prints an ASCII banner with version and environment info at startup.
export function printStartupBanner(port: number) {
  const text = "AthletePT-Backend";

  const banner = figlet.textSync(text, {
    font: "Standard",
    horizontalLayout: "default",
    verticalLayout: "default",
    whitespaceBreak: true,
  });

  const divider = "-".repeat(65);

  const meta = [
    `:: AthletePT Backend :: v${packageJson.version} ::`,
    `Env: ${env.NODE_ENV}`,
    `Port: ${port}`,
    `Node: ${process.version}`,
    `Started: ${new Date().toISOString()}`,
  ].join("\n");

  logger.info(`\n${divider}\n${banner}\n${meta}\n${divider}`);
}
