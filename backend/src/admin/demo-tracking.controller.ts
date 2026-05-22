import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard, OwnerOnlyGuard } from 'src/auth/auth.guard';
import { DemoTrackingService } from './demo-tracking.service';

@Controller('admin/demo-sessions')
@UseGuards(JwtAuthGuard, OwnerOnlyGuard)
export class DemoTrackingController {
  constructor(private readonly tracking: DemoTrackingService) {}

  @Get()
  list(@Query('limit') limit?: string) {
    const n = limit ? parseInt(limit, 10) : 200;
    return this.tracking.listSessions(Number.isFinite(n) ? n : 200);
  }

  @Get('summary')
  summary() {
    return this.tracking.summary();
  }
}
