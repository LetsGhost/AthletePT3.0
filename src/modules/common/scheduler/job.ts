import { randomUUID } from "crypto";

export interface JobConfig {
  name: string;
  schedule: string; // cron expression
  enabled?: boolean;
  runOnStartup?: boolean;
}

export interface JobContext {
  jobId: string;
  jobName: string;
  startedAt: Date;
  attempt: number;
  maxRetries: number;
}

export abstract class ScheduledJob {
  protected config: JobConfig;
  protected jobId: string;

  constructor(config: JobConfig) {
    this.config = { enabled: true, runOnStartup: false, ...config };
    this.jobId = randomUUID();
  }

  abstract execute(context: JobContext): Promise<void>;

  getConfig(): JobConfig {
    return this.config;
  }

  getJobId(): string {
    return this.jobId;
  }
}
