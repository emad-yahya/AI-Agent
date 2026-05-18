import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';
import { Brand } from 'src/common/types';
import { FirebaseService } from 'src/firebase/firebase.service';
import { ScansService } from 'src/scans/scans.service';

const JOB_NAME = 'scheduled-scans';

export interface SchedulerStatus {
  enabled: boolean;
  cron: string;
  nextRun: string | null;
  lastRun: string | null;
  lastRunResult: string | null;
}

@Injectable()
export class SchedulerService implements OnModuleInit {
  private readonly logger = new Logger(SchedulerService.name);
  private currentCron = '0 0 * * *';
  private lastRunIso: string | null = null;
  private lastRunResult: string | null = null;

  constructor(
    private firebase: FirebaseService,
    private scans: ScansService,
    private config: ConfigService,
    private schedulerRegistry: SchedulerRegistry,
  ) {}

  async onModuleInit() {
    // 1. Prefer Firestore-stored config (UI-controlled)
    let enabled = false;
    let cron = this.config.get<string>('SCAN_CRON_SCHEDULE', '0 0 * * *');
    try {
      const doc = await this.firebase.schedulerConfig().get();
      if (doc.exists) {
        const data = doc.data() as
          | { enabled?: boolean; cron?: string }
          | undefined;
        if (data?.enabled === true) enabled = true;
        if (data?.cron) cron = data.cron;
      } else {
        // Fallback to env on first boot
        enabled =
          this.config.get<string>('SCAN_SCHEDULE_ENABLED', 'false') === 'true';
      }
    } catch (err) {
      this.logger.warn(
        `Could not load scheduler config from Firestore: ${(err as Error).message}`,
      );
    }

    this.currentCron = cron;

    if (!enabled) {
      this.logger.log('Scheduled scans disabled');
      return;
    }
    this.startJob(cron);
  }

  getStatus(): SchedulerStatus {
    const enabled = this.isRunning();
    let nextRun: string | null = null;
    if (enabled) {
      try {
        const job = this.schedulerRegistry.getCronJob(JOB_NAME);
        const next = job.nextDate();
        nextRun = next ? next.toString() : null;
      } catch {
        nextRun = null;
      }
    }
    return {
      enabled,
      cron: this.currentCron,
      nextRun,
      lastRun: this.lastRunIso,
      lastRunResult: this.lastRunResult,
    };
  }

  async enable(cron: string): Promise<SchedulerStatus> {
    if (!this.isValidCron(cron)) {
      throw new Error(`Invalid cron expression: "${cron}"`);
    }
    this.stopJob();
    this.currentCron = cron;
    this.startJob(cron);
    await this.persistConfig({ enabled: true, cron });
    return this.getStatus();
  }

  async disable(): Promise<SchedulerStatus> {
    this.stopJob();
    await this.persistConfig({ enabled: false, cron: this.currentCron });
    return this.getStatus();
  }

  async runNow(): Promise<{ started: number }> {
    const count = await this.runScheduledScans();
    return { started: count };
  }

  async runScheduledScans(): Promise<number> {
    this.logger.log('Running scheduled scans for all tracked brands...');

    const snap = await this.firebase.brands().get();
    const brands = snap.docs
      .map((d) => ({ id: d.id, ...(d.data() as Brand) }))
      .filter(
        (b): b is Brand & { id: string; category: string } => !!b.category,
      );

    if (brands.length === 0) {
      this.logger.log('No brands with categories found — skipping');
      this.lastRunIso = new Date().toISOString();
      this.lastRunResult = 'No brands with category — nothing to run';
      return 0;
    }

    this.logger.log(`Scheduling ${brands.length} brand(s)...`);
    let started = 0;
    for (const brand of brands) {
      try {
        const result = await this.scans.createScan({
          brand: brand.name,
          category: brand.category,
        });
        started++;
        this.logger.log(
          `Scheduled scan started: ${brand.name} — scanId: ${result.scanId}`,
        );
      } catch (err) {
        this.logger.error(
          `Scheduled scan failed: ${brand.name} — ${(err as Error).message}`,
        );
      }
    }

    this.lastRunIso = new Date().toISOString();
    this.lastRunResult = `Started ${started}/${brands.length} scans`;
    this.logger.log(`Scheduled scan run complete — ${this.lastRunResult}`);
    return started;
  }

  private startJob(cron: string) {
    const job = new CronJob(cron, () => {
      void this.runScheduledScans();
    });
    this.schedulerRegistry.addCronJob(JOB_NAME, job);
    job.start();
    this.logger.log(`Scheduled scans started — cron: "${cron}"`);
  }

  private stopJob() {
    try {
      const job = this.schedulerRegistry.getCronJob(JOB_NAME);
      job.stop();
      this.schedulerRegistry.deleteCronJob(JOB_NAME);
      this.logger.log('Scheduled scans stopped');
    } catch {
      // Job not registered — nothing to stop
    }
  }

  private isRunning(): boolean {
    try {
      this.schedulerRegistry.getCronJob(JOB_NAME);
      return true;
    } catch {
      return false;
    }
  }

  private isValidCron(expr: string): boolean {
    // CronJob constructor throws on invalid expression — use that as validator
    try {
      const job = new CronJob(expr, () => {});
      job.stop();
      return true;
    } catch {
      return false;
    }
  }

  private async persistConfig(cfg: { enabled: boolean; cron: string }) {
    try {
      await this.firebase.schedulerConfig().set(cfg, { merge: true });
    } catch (err) {
      this.logger.warn(
        `Could not persist scheduler config: ${(err as Error).message}`,
      );
    }
  }
}
