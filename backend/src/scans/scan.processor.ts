import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { ScansService } from './scans.service';
import { SCAN_JOB, SCAN_QUEUE, ScanJobData } from './scan-queue.constants';

@Processor(SCAN_QUEUE)
export class ScanProcessor extends WorkerHost {
  private readonly logger = new Logger(ScanProcessor.name);

  constructor(private scans: ScansService) {
    super();
  }

  async process(job: Job<ScanJobData>): Promise<void> {
    if (job.name !== SCAN_JOB) return;
    const { scanId, brandId, brand, category } = job.data;
    this.logger.log(`Processing queued scan ${scanId} for brand ${brand}`);
    await this.scans.runScanInBackground(scanId, brandId, { brand, category });
  }
}
