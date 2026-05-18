import { Module } from '@nestjs/common';
import { FirebaseModule } from 'src/firebase/firebase.module';
import { AlertsController } from './alerts.controller';
import { AlertsService } from './alerts.service';
import { ReportsService } from './reports.service';

@Module({
  imports: [FirebaseModule],
  controllers: [AlertsController],
  providers: [AlertsService, ReportsService],
  exports: [AlertsService],
})
export class AlertsModule {}
