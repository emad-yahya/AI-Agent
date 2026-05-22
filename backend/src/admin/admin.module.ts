import { Global, Module } from '@nestjs/common';
import { DemoTrackingService } from './demo-tracking.service';
import { DemoTrackingController } from './demo-tracking.controller';

@Global()
@Module({
  providers: [DemoTrackingService],
  controllers: [DemoTrackingController],
  exports: [DemoTrackingService],
})
export class AdminModule {}
