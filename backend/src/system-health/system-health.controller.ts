import { Controller, Get } from '@nestjs/common';
import { SystemHealthService } from './system-health.service';

@Controller('system')
export class SystemHealthController {
  constructor(private health: SystemHealthService) {}

  @Get('health/integrations')
  async integrations() {
    return this.health.checkAll();
  }
}
