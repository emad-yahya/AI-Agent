import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { AIModule } from 'src/ai/ai.module';
import { AlertsModule } from 'src/alerts/alerts.module';
import { ScanController } from './scans.controller';
import { ScansService } from './scans.service';
import { ScanEventsService } from './scan-events.service';
import { ScanProcessor } from './scan.processor';
import { SCAN_QUEUE } from './scan-queue.constants';

const redisUrl = process.env.REDIS_URL;

@Module({
  imports: [
    AIModule,
    AlertsModule,
    ...(redisUrl ? [BullModule.registerQueue({ name: SCAN_QUEUE })] : []),
  ],
  controllers: [ScanController],
  providers: [
    ScansService,
    ScanEventsService,
    ...(redisUrl ? [ScanProcessor] : []),
  ],
  exports: [ScansService],
})
export class ScansModule {}
