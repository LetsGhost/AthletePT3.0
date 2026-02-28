import cron from "node-cron";
import cronParser from "cron-parser";

import { logger } from "../logger/logger";
import { ScheduledJob, JobContext } from "./job";

export interface SchedulerConfig {
  maxConcurrentJobs?: number;
  defaultMaxRetries?: number;
}

export class JobScheduler {
  private jobs: Map<string, ScheduledJob> = new Map();
  private tasks: Map<string, cron.ScheduledTask> = new Map();
  private runningJobs: Set<string> = new Set();
  private config: Required<SchedulerConfig>;

  constructor(config: SchedulerConfig = {}) {
    this.config = {
      maxConcurrentJobs: config.maxConcurrentJobs ?? 5,
      defaultMaxRetries: config.defaultMaxRetries ?? 3,
    };
  }

  private getCronDescription(schedule: string): string {
    try {
      const interval = cronParser.parseExpression(schedule);
      const nextRun = interval.next().toDate();
      const timeStr = nextRun.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: true,
      });

      // Determine frequency
      const parts = schedule.split(" ");
      const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;

      if (hour === "*" && dayOfMonth === "*" && month === "*" && dayOfWeek === "*") {
        return `Every hour at ${minute} minutes`;
      } else if (dayOfMonth === "*" && month === "*" && dayOfWeek === "*") {
        return `Daily at ${timeStr}`;
      } else if (dayOfWeek !== "*" && dayOfMonth === "*") {
        return `Weekly at ${timeStr}`;
      } else if (hour === "*/" || hour.includes("/")) {
        const hours = hour.split("/")[1];
        return `Every ${hours} hour(s) at ${minute} minutes`;
      }
      return schedule;
    } catch {
      return schedule;
    }
  }

  registerJob(job: ScheduledJob): void {
    const jobName = job.getConfig().name;

    if (this.jobs.has(jobName)) {
      logger.warn(`Job already registered: ${jobName}`);
      return;
    }

    this.jobs.set(jobName, job);
    logger.info(`Job registered: ${jobName}`);
  }

  async startScheduler(): Promise<void> {
    const log = logger.child({ label: "scheduler" });
    log.info("Starting job scheduler");

    const scheduledJobs: Array<{ name: string; schedule: string }> = [];

    for (const [jobName, job] of this.jobs) {
      const config = job.getConfig();

      if (!config.enabled) {
        log.debug(`Job disabled: ${jobName}`);
        continue;
      }

      // Run on startup if configured
      if (config.runOnStartup) {
        this.executeJob(job).catch((err) =>
          log.error(`Startup job failed: ${jobName}`, { error: err.message })
        );
      }

      // Schedule the job
      try {
        const task = cron.schedule(config.schedule, () => {
          this.executeJob(job).catch((err) =>
            log.error(`Scheduled job failed: ${jobName}`, { error: err.message })
          );
        });

        this.tasks.set(jobName, task);
        const description = this.getCronDescription(config.schedule);
        log.info(`Job scheduled: ${jobName} [${description}]`);
        scheduledJobs.push({ name: jobName, schedule: description });
      } catch (error) {
        log.error(`Failed to schedule job: ${jobName}`, {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    // Display all scheduled jobs
    if (scheduledJobs.length > 0) {
      log.info("Active scheduled jobs:");
      scheduledJobs.forEach((job) => {
        log.info(`   ${job.name}: ${job.schedule}`);
      });
    } else {
      log.warn("No jobs scheduled");
    }

    log.info("Job scheduler started");
  }

  async stopScheduler(): Promise<void> {
    const log = logger.child({ label: "scheduler" });
    log.info("Stopping job scheduler");

    for (const [jobName, task] of this.tasks) {
      task.stop();
      log.debug(`Job stopped: ${jobName}`);
    }

    this.tasks.clear();
    log.info("Job scheduler stopped");
  }

  private async executeJob(job: ScheduledJob): Promise<void> {
    const jobName = job.getConfig().name;

    // Check if already running and respect max concurrent jobs
    if (this.runningJobs.size >= this.config.maxConcurrentJobs) {
      logger.warn(`Job queue full: ${jobName} skipped`);
      return;
    }

    if (this.runningJobs.has(jobName)) {
      logger.warn(`Job already running: ${jobName} skipped`);
      return;
    }

    this.runningJobs.add(jobName);
    const startTime = Date.now();
    let attempt = 0;

    try {
      while (attempt < this.config.defaultMaxRetries) {
        attempt++;

        try {
          const context: JobContext = {
            jobId: job.getJobId(),
            jobName,
            startedAt: new Date(),
            attempt,
            maxRetries: this.config.defaultMaxRetries,
          };

          await job.execute(context);

          logger.info(`Job executed successfully: ${jobName}`, {
            durationMs: Date.now() - startTime,
            attempt,
          });

          return;
        } catch (error) {
          if (attempt < this.config.defaultMaxRetries) {
            const delayMs = Math.pow(2, attempt) * 1000; // exponential backoff
            logger.warn(`Job failed, retrying: ${jobName}`, {
              attempt,
              nextRetryMs: delayMs,
              error: error instanceof Error ? error.message : String(error),
            });
            await new Promise((resolve) => setTimeout(resolve, delayMs));
          }
        }
      }

      throw new Error(
        `Job failed after ${this.config.defaultMaxRetries} attempts`
      );
    } catch (error) {
      logger.error(`Job execution failed: ${jobName}`, {
        durationMs: Date.now() - startTime,
        attempts: attempt,
        error: error instanceof Error ? error.stack : String(error),
      });
      throw error;
    } finally {
      this.runningJobs.delete(jobName);
    }
  }

  getJobStatus(jobName: string): {
    registered: boolean;
    running: boolean;
    enabled: boolean;
  } {
    const job = this.jobs.get(jobName);
    return {
      registered: !!job,
      running: this.runningJobs.has(jobName),
      enabled: job?.getConfig().enabled ?? false,
    };
  }

  getAllJobsStatus(): Map<
    string,
    { registered: boolean; running: boolean; enabled: boolean }
  > {
    const status = new Map();
    for (const jobName of this.jobs.keys()) {
      status.set(jobName, this.getJobStatus(jobName));
    }
    return status;
  }
}

export const jobScheduler = new JobScheduler();
