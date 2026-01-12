import { ScheduledJob, JobContext } from "../../common/scheduler/job";
import { jobScheduler } from "../../common/scheduler/scheduler";
import { userService } from "../service/user.service";
import { logger } from "../../common/logger/logger";

/**
 * Auto-register users from external system or pending queue
 * Runs every day at 2 AM
 */
export class AutoRegisterJob extends ScheduledJob {
  constructor() {
    super({
      name: "auto-register-users",
      schedule: "0 2 * * *", // 2 AM daily
      enabled: true,
      runOnStartup: false,
    });
  }

  async execute(context: JobContext): Promise<void> {
    const log = logger.child({ label: "job" });

    log.info(`Executing auto-register job [attempt ${context.attempt}]`, {
      jobId: context.jobId,
    });

    // Example: Fetch pending users from external API
    const pendingUsers = await this.fetchPendingUsers();

    log.info(`Found ${pendingUsers.length} pending users`, {
      jobId: context.jobId,
    });

    for (const userData of pendingUsers) {
      try {
        await userService.createUser(userData.email, userData.password);

        log.info(`Auto-registered user: ${userData.email}`, {
          jobId: context.jobId,
        });
      } catch (error) {
        log.error(`Failed to auto-register user: ${userData.email}`, {
          jobId: context.jobId,
          error: error instanceof Error ? error.message : String(error),
        });
        // Continue with next user instead of failing the entire job
      }
    }

    log.info(`Auto-register job completed`, {
      jobId: context.jobId,
      registeredCount: pendingUsers.length,
    });
  }

  private async fetchPendingUsers(): Promise<
    Array<{ email: string; password: string }>
  > {
    // TODO: Implement fetching from external system
    // Example:
    // const response = await fetch('https://external-api.com/pending-users');
    // return response.json();

    return [];
  }
}

export const autoRegisterJob = new AutoRegisterJob();

// Auto-register when imported
jobScheduler.registerJob(autoRegisterJob);
