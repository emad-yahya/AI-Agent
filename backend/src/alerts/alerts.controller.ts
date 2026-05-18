import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { AlertsService } from './alerts.service';
import { AlertSettingsDto } from './alert-settings.dto';

@Controller('alerts')
export class AlertsController {
  constructor(private alerts: AlertsService) {}

  @Get('settings/:brandId')
  getSettings(@Param('brandId') brandId: string) {
    return this.alerts.getAlertSettings(brandId);
  }

  @Post('settings/:brandId')
  saveSettings(
    @Param('brandId') brandId: string,
    @Body() dto: AlertSettingsDto,
  ) {
    return this.alerts.saveAlertSettings(brandId, dto);
  }

  @Post('test/:brandId')
  testWebhook(@Param('brandId') brandId: string) {
    return this.alerts.sendWebhookTest(brandId);
  }
}
