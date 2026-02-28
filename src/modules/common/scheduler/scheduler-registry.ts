import { logger } from "../logger/logger";

// Import all jobs - they self-register on import
import "../../user/jobs/auto-register.job";

export async function registerScheduledJobs(): Promise<void> {
  const log = logger.child({ label: "scheduler-registry" });

  log.info("Scheduled jobs registration completed");
}
